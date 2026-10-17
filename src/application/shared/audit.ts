import type { AuditEvent, Store } from "@/domain/ticket/schemas";

/** Append an audit event to a draft store. Mutates in place, returns the event. */
export function appendAudit(
  store: Store,
  event: Omit<AuditEvent, "id" | "at"> & { at?: string },
): AuditEvent {
  const full: AuditEvent = {
    id: `aud_${store.audit.length + 1}_${Math.random().toString(36).slice(2, 8)}`,
    at: event.at ?? new Date().toISOString(),
    ticketId: event.ticketId,
    actor: event.actor,
    action: event.action,
    detail: event.detail,
  };
  store.audit.push(full);
  return full;
}