import type { Priority } from "@/domain/ticket/schemas";
import { slaDeadline } from "@/domain/sla/policy";
import { runTriage } from "@/application/triage/run-triage";
import { appendAudit } from "@/application/shared/audit";
import { getStore, mutateStore } from "@/infrastructure/storage/store";
import { getTicketById, type TicketView } from "@/application/tickets/queries";

/**
 * Ticket mutations. Every write goes through `mutateStore` and leaves an audit
 * trail entry, so the UI can show exactly what the automation did versus what a
 * human did.
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

function requireTicket(store: ReturnType<typeof getStore>, id: string) {
  const ticket = store.tickets.find((t) => t.id === id);
  if (!ticket) throw new TicketActionError(`Ticket ${id} not found`, "not_found");
  return ticket;
}

export function sendReply(id: string, body: string, actor = "Agent"): TicketView {
  const trimmed = body.trim();
  if (!trimmed) throw new TicketActionError("Reply body is empty", "empty_reply");

  const ticketId = mutateStore((store) => {
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
    return ticket.id;
  });

  return getTicketById(ticketId)!;
}

export function resolveTicket(id: string, actor = "Agent"): TicketView {
  const ticketId = mutateStore((store) => {
    const ticket = requireTicket(store, id);
    ticket.status = "resolved";
    ticket.updatedAt = nowIso();
    appendAudit(store, { ticketId: ticket.id, actor, action: "resolved" });
    return ticket.id;
  });
  return getTicketById(ticketId)!;
}

export function reopenTicket(id: string, actor = "Agent"): TicketView {
  const ticketId = mutateStore((store) => {
    const ticket = requireTicket(store, id);
    ticket.status = "open";
    ticket.updatedAt = nowIso();
    appendAudit(store, { ticketId: ticket.id, actor, action: "reopened" });
    return ticket.id;
  });
  return getTicketById(ticketId)!;
}

export function reassignTicket(id: string, agentId: string | null, actor = "Agent"): TicketView {
  const ticketId = mutateStore((store) => {
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
  return getTicketById(ticketId)!;
}

export function setPriority(id: string, priority: Priority, actor = "Agent"): TicketView {
  const ticketId = mutateStore((store) => {
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
  return getTicketById(ticketId)!;
}

/** Re-run triage to refresh the draft reply (e.g. after a manual priority change). */
export async function regenerateDraft(id: string, actor = "Agent"): Promise<TicketView> {
  const snapshot = getStore();
  const ticket = snapshot.tickets.find((t) => t.id === id);
  if (!ticket) throw new TicketActionError(`Ticket ${id} not found`, "not_found");

  const agent = snapshot.agents.find((a) => a.id === ticket.assigneeId);
  const triaged = await runTriage(
    { subject: ticket.subject, body: ticket.body, fromName: ticket.fromName },
    { agent, org: snapshot.org },
  );

  const ticketId = mutateStore((store) => {
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
  return getTicketById(ticketId)!;
}

export function assignNextAgent(id: string, actor = "Agent"): TicketView {
  const snapshot = getStore();
  const ticket = snapshot.tickets.find((t) => t.id === id);
  if (!ticket) throw new TicketActionError(`Ticket ${id} not found`, "not_found");

  const currentIndex = snapshot.agents.findIndex((a) => a.id === ticket.assigneeId);
  const next = snapshot.agents[(currentIndex + 1) % snapshot.agents.length];
  return next ? reassignTicket(id, next.id, actor) : reassignTicket(id, null, actor);
}