import type { InboundMessage, Message, Ticket } from "@/domain/ticket/schemas";
import { pickAssignee, recomputeOpenWorkloads } from "@/domain/triage/assignment";
import { detectLanguage as detectTextLanguage } from "@/domain/triage/text";
import { slaDeadline } from "@/domain/sla/policy";
import { runTriage } from "@/application/triage/run-triage";
import { appendAudit } from "@/application/shared/audit";
import { getStore, mutateStore } from "@/infrastructure/storage/store";
import { log } from "@/infrastructure/observability/logger";

/**
 * Ingest a single inbound message and run the full automation: dedupe, triage,
 * route to an agent, set the SLA deadline and persist an audit trail.
 *
 * The async triage work (which may call an LLM) happens before the store
 * mutation, so the write is atomic and never interleaves with a network
 * round-trip.
 *
 * Idempotent on `messageId`: re-delivering the same message returns the
 * existing ticket instead of creating a duplicate.
 */

export interface IngestResult {
  ticketId: string;
  number: string;
  duplicate: boolean;
  action: "created" | "existing";
}

export async function ingestTicket(input: InboundMessage): Promise<IngestResult> {
  const receivedAt = input.receivedAt ?? new Date().toISOString();

  const snapshot = await getStore();
  const existing = snapshot.tickets.find((t) => t.messageId === input.messageId);
  if (existing) {
    return { ticketId: existing.id, number: existing.number, duplicate: true, action: "existing" };
  }

  // 1. Deterministic routing decision (no network) to pick the specialist.
  const provisional = await runTriage(
    { subject: input.subject, body: input.body, fromName: input.fromName },
    { offline: true, org: snapshot.org },
  );
  const workloads = recomputeOpenWorkloads(snapshot.tickets);
  const assigneeId = pickAssignee(
    snapshot.agents,
    provisional.classification.category,
    workloads,
    snapshot.counters.roundRobin,
  );
  const agent = snapshot.agents.find((a) => a.id === assigneeId);

  // 2. Full triage, optionally refined by the LLM.
  const triaged = await runTriage(
    { subject: input.subject, body: input.body, fromName: input.fromName },
    { agent, org: snapshot.org },
  );

  const deadline = slaDeadline(Date.parse(receivedAt), triaged.classification.priority);

  // 3. Persist atomically.
  return mutateStore((store) => {
    const dupe = store.tickets.find((t) => t.messageId === input.messageId);
    if (dupe) {
      return { ticketId: dupe.id, number: dupe.number, duplicate: true, action: "existing" as const };
    }

    const id = `tkt_${randomId()}`;
    const number = `TKT-${store.counters.nextNumber}`;
    store.counters.nextNumber += 1;
    store.counters.roundRobin += 1;

    const firstMessage: Message = {
      id: `${id}_m1`,
      at: receivedAt,
      from: "customer",
      body: input.body,
    };

    const ticket: Ticket = {
      id,
      number,
      messageId: input.messageId,
      receivedAt,
      updatedAt: receivedAt,
      channel: input.channel ?? "email",
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      subject: input.subject,
      body: input.body,
      language: detectTextLanguage(`${input.subject} ${input.body}`),
      classification: triaged.classification,
      sla: deadline,
      status: agent ? "open" : "new",
      assigneeId,
      draftReply: triaged.draftReply,
      draftReplyEngine: triaged.draftReplyEngine,
      thread: [firstMessage],
      priorityLocked: false,
    };

    store.tickets.push(ticket);

    appendAudit(store, {
      ticketId: id,
      actor: "triagely",
      action: "ingested",
      detail: `channel=${ticket.channel} messageId=${input.messageId}`,
    });
    appendAudit(store, {
      ticketId: id,
      actor: "triagely",
      action: "auto_triaged",
      detail: `${triaged.classification.category}/${triaged.classification.priority} via ${triaged.draftReplyEngine}${
        triaged.refinedByLlm ? ` (${triaged.model})` : ""
      }`,
    });
    appendAudit(store, {
      ticketId: id,
      actor: "triagely",
      action: "auto_assigned",
      detail: agent ? `${agent.name} · SLA ${deadline.targetMinutes}m` : "no agent available",
    });

    log.info(
      `Ingested ${number} → ${triaged.classification.category}/${triaged.classification.priority} (${agent?.name ?? "unassigned"})`,
    );

    return { ticketId: id, number, duplicate: false, action: "created" as const };
  });
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12) ?? Math.random().toString(36).slice(2, 14);
}