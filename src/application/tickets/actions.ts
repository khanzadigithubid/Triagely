import type { Priority, Store } from "@/domain/ticket/schemas";
import { slaDeadline } from "@/domain/sla/policy";
import { runTriage } from "@/application/triage/run-triage";
import { appendAudit } from "@/application/shared/audit";
import { getStore, mutateStore } from "@/infrastructure/storage/store";
import { getTicketById, type TicketView } from "@/application/tickets/queries";
import { sendEmail } from "@/infrastructure/email/sender";

/**
 * Ticket mutations. Every write goes through `mutateStore` and leaves an audit
 * trail entry, so the UI can show exactly what the automation did versus what a
 * human did. Mutations are async because the store may be backed by Postgres.
 */

export class TicketActionError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "TicketActionError";
    this.code = code;
  }
}

const PRIORITY_REPRESENTATIVE: Record<Priority, number> = {
  urgent: 80,
  high: 60,
  medium: 40,
  low: 20,
};

function nowIso(): string {
  return new Date().toISOString();
}

function requireTicket(store: Store, id: string) {
  const ticket = store.tickets.find((t) => t.id === id);
  if (!ticket) throw new TicketActionError(`Ticket ${id} not found`, "not_found");
  return ticket;
}

export async function sendReply(id: string, body: string, actor = "Agent"): Promise<TicketView> {
  const trimmed = body.trim();
  if (!trimmed) throw new TicketActionError("Reply body is empty", "empty_reply");

  const planned = await mutateStore((store) => {
    const ticket = requireTicket(store, id);
    const at = nowIso();
    ticket.thread.push({
      id: `${ticket.id}_r${ticket.thread.length}`,
      at,
      from: "agent",
      body: trimmed,
    });
    ticket.updatedAt = at;
    ticket.status = "pending";
    appendAudit(store, {
      ticketId: ticket.id,
      actor,
      action: "replied",
      detail: `${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}`,
    });
    return { ticketId: ticket.id, to: ticket.fromEmail, toName: ticket.fromName, subject: ticket.subject };
  });

  // Deliver the reply by email. Best-effort: a delivery failure is recorded but
  // never rolls back the reply that the agent already sent.
  const delivery = await sendEmail({
    to: planned.to,
    toName: planned.toName,
    subject: `Re: ${planned.subject}`,
    body: trimmed,
  });

  await mutateStore((store) => {
    appendAudit(store, {
      ticketId: planned.ticketId,
      actor: "triagely",
      action: delivery.delivered ? "email_sent" : delivery.mode === "dry-run" ? "email_dry_run" : "email_failed",
      detail: delivery.delivered
        ? `${delivery.mode} → ${planned.to}`
        : delivery.error ?? `${delivery.mode} → ${planned.to}`,
    });
  });

  return (await getTicketById(planned.ticketId))!;
}

export async function resolveTicket(id: string, actor = "Agent"): Promise<TicketView> {
  const ticketId = await mutateStore((store) => {
    const ticket = requireTicket(store, id);
    ticket.status = "resolved";
    ticket.updatedAt = nowIso();
    appendAudit(store, { ticketId: ticket.id, actor, action: "resolved" });
    return ticket.id;
  });
  return (await getTicketById(ticketId))!;
}

export async function reopenTicket(id: string, actor = "Agent"): Promise<TicketView> {
  const ticketId = await mutateStore((store) => {
    const ticket = requireTicket(store, id);
    ticket.status = "open";
    ticket.updatedAt = nowIso();
    appendAudit(store, { ticketId: ticket.id, actor, action: "reopened" });
    return ticket.id;
  });
  return (await getTicketById(ticketId))!;
}

export async function reassignTicket(
  id: string,
  agentId: string | null,
  actor = "Agent",
): Promise<TicketView> {
  const ticketId = await mutateStore((store) => {
    const ticket = requireTicket(store, id);
    const agent = agentId ? store.agents.find((a) => a.id === agentId) : null;
    ticket.assigneeId = agent ? agent.id : null;
    if (agent && ticket.status === "new") ticket.status = "open";
    ticket.updatedAt = nowIso();
    appendAudit(store, {
      ticketId: ticket.id,
      actor,
      action: "reassigned",
      detail: agent ? agent.name : "unassigned",
    });
    return ticket.id;
  });
  return (await getTicketById(ticketId))!;
}

export async function setPriority(id: string, priority: Priority, actor = "Agent"): Promise<TicketView> {
  const ticketId = await mutateStore((store) => {
    const ticket = requireTicket(store, id);
    ticket.classification.priority = priority;
    ticket.classification.priorityScore = PRIORITY_REPRESENTATIVE[priority];
    ticket.classification.tags = [...new Set([...ticket.classification.tags, "human-priority"])];
    ticket.priorityLocked = true;
    ticket.sla = { ...slaDeadline(Date.parse(ticket.receivedAt), priority) };
    ticket.updatedAt = nowIso();
    appendAudit(store, {
      ticketId: ticket.id,
      actor,
      action: "priority_overridden",
      detail: priority,
    });
    return ticket.id;
  });
  return (await getTicketById(ticketId))!;
}

/** Re-run triage to refresh the draft reply (e.g. after a manual priority change). */
export async function regenerateDraft(id: string, actor = "Agent"): Promise<TicketView> {
  const snapshot = await getStore();
  const ticket = snapshot.tickets.find((t) => t.id === id);
  if (!ticket) throw new TicketActionError(`Ticket ${id} not found`, "not_found");

  const agent = snapshot.agents.find((a) => a.id === ticket.assigneeId);
  const triaged = await runTriage(
    { subject: ticket.subject, body: ticket.body, fromName: ticket.fromName },
    { agent, org: snapshot.org },
  );

  const ticketId = await mutateStore((store) => {
    const draft = requireTicket(store, id);
    draft.draftReply = triaged.draftReply;
    draft.draftReplyEngine = triaged.draftReplyEngine;
    draft.updatedAt = nowIso();
    appendAudit(store, {
      ticketId: draft.id,
      actor,
      action: "draft_regenerated",
      detail: triaged.draftReplyEngine,
    });
    return draft.id;
  });
  return (await getTicketById(ticketId))!;
}

export async function assignNextAgent(id: string, actor = "Agent"): Promise<TicketView> {
  const snapshot = await getStore();
  const ticket = snapshot.tickets.find((t) => t.id === id);
  if (!ticket) throw new TicketActionError(`Ticket ${id} not found`, "not_found");

  const currentIndex = snapshot.agents.findIndex((a) => a.id === ticket.assigneeId);
  const next = snapshot.agents[(currentIndex + 1) % snapshot.agents.length];
  return reassignTicket(id, next ? next.id : null, actor);
}
