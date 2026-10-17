import type { Agent, Category } from "@/domain/ticket/schemas";

/**
 * Agent assignment (pure).
 *
 * Routes a ticket to the agent team that owns its category, then within the
 * candidate pool picks the agent with the lightest open workload, tie-broken
 * by a monotonically increasing round-robin counter so distribution stays fair.
 */

export function pickAssignee(
  agents: Agent[],
  category: Category,
  openWorkloads: Map<string, number>,
  roundRobin: number,
): string | null {
  const active = agents.filter((a) => a.active);
  if (active.length === 0) return null;

  const candidates = active.filter((a) => a.specialty.includes(category));
  const pool = candidates.length > 0 ? candidates : active;

  const workloadOf = (id: string): number => openWorkloads.get(id) ?? 0;

  const sorted = [...pool].sort((a, b) => {
    const loadDelta = workloadOf(a.id) - workloadOf(b.id);
    if (loadDelta !== 0) return loadDelta;
    const rrA = a.id.charCodeAt(0) % 31;
    const rrB = b.id.charCodeAt(0) % 31;
    return rrA - rrB;
  });

  const index = roundRobin % Math.max(1, sorted.length);
  return sorted[index]?.id ?? null;
}

export function recomputeOpenWorkloads(
  tickets: { assigneeId: string | null; status: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    if (ticket.assigneeId && (ticket.status === "new" || ticket.status === "open")) {
      counts.set(ticket.assigneeId, (counts.get(ticket.assigneeId) ?? 0) + 1);
    }
  }
  return counts;
}