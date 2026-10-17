import type {
  Agent,
  AuditEvent,
  Category,
  Priority,
  Sentiment,
  Sla,
  Store,
  Ticket,
} from "@/domain/ticket/schemas";
import { CATEGORIES, PRIORITIES, SENTIMENTS } from "@/domain/ticket/schemas";
import { evaluateSla } from "@/domain/sla/policy";
import { getStore } from "@/infrastructure/storage/store";

/**
 * Read-side application queries. Pure transforms over the store plus a live
 * SLA evaluation against the current time.
 */

export interface TicketView extends Omit<Ticket, "sla"> {
  sla: Sla & { remainingMinutes: number; progress: number };
  agent: Agent | null;
  ageMinutes: number;
  open: boolean;
}

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function enrichTicket(ticket: Ticket, agents: Agent[], nowMs: number): TicketView {
  const receivedAtMs = Date.parse(ticket.receivedAt);
  const targetAtMs = Date.parse(ticket.sla.targetAt);
  const live = evaluateSla(receivedAtMs, targetAtMs, nowMs);

  return {
    ...ticket,
    sla: { ...ticket.sla, status: live.status, remainingMinutes: live.remainingMinutes, progress: live.progress },
    agent: agents.find((a) => a.id === ticket.assigneeId) ?? null,
    ageMinutes: Math.max(0, Math.round((nowMs - receivedAtMs) / 60_000)),
    open: ticket.status !== "resolved",
  };
}

export function listAgents(store: Store = getStore()): Agent[] {
  return store.agents;
}

export function listTickets(nowMs: number = Date.now()): TicketView[] {
  const store = getStore();
  return store.tickets
    .map((ticket) => enrichTicket(ticket, store.agents, nowMs))
    .sort((a, b) => {
      if (a.open !== b.open) return a.open ? -1 : 1;
      const rank = PRIORITY_RANK[a.classification.priority] - PRIORITY_RANK[b.classification.priority];
      if (rank !== 0) return rank;
      return Date.parse(b.receivedAt) - Date.parse(a.receivedAt);
    });
}

export function getTicketById(id: string, nowMs: number = Date.now()): TicketView | null {
  const store = getStore();
  const ticket = store.tickets.find((t) => t.id === id);
  return ticket ? enrichTicket(ticket, store.agents, nowMs) : null;
}

export function getTicketAudit(id: string): AuditEvent[] {
  return getStore()
    .audit.filter((event) => event.ticketId === id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export interface Analytics {
  totals: {
    all: number;
    open: number;
    new: number;
    pending: number;
    resolved: number;
    breached: number;
    atRisk: number;
    unassigned: number;
  };
  avgFirstResponseMinutes: number | null;
  slaCompliance: number | null;
  byCategory: { key: Category; count: number }[];
  byPriority: { key: Priority; count: number; open: number }[];
  bySentiment: { key: Sentiment; count: number }[];
  volumeByDay: { day: string; count: number }[];
  agents: { agent: Agent; open: number; resolved: number; urgent: number }[];
}

export function computeAnalytics(nowMs: number = Date.now()): Analytics {
  const store = getStore();
  const views = store.tickets.map((t) => enrichTicket(t, store.agents, nowMs));

  const open = views.filter((v) => v.open);
  const resolved = views.filter((v) => !v.open);

  const firstResponses: number[] = [];
  for (const ticket of store.tickets) {
    const firstAgent = ticket.thread.find((m) => m.from === "agent");
    if (firstAgent) {
      const delta = (Date.parse(firstAgent.at) - Date.parse(ticket.receivedAt)) / 60_000;
      if (delta >= 0) firstResponses.push(delta);
    }
  }
  const avgFirstResponseMinutes = firstResponses.length
    ? Math.round((firstResponses.reduce((a, b) => a + b, 0) / firstResponses.length) * 10) / 10
    : null;

  const slaCompliance =
    open.length > 0
      ? Math.round(
          (open.filter((v) => v.sla.status !== "breached").length / open.length) * 1000,
        ) / 10
      : null;

  const byCategory = CATEGORIES.map((key) => ({
    key,
    count: views.filter((v) => v.classification.category === key).length,
  })).sort((a, b) => b.count - a.count);

  const byPriority = PRIORITIES.map((key) => ({
    key,
    count: views.filter((v) => v.classification.priority === key).length,
    open: open.filter((v) => v.classification.priority === key).length,
  }));

  const bySentiment = SENTIMENTS.map((key) => ({
    key,
    count: views.filter((v) => v.classification.sentiment === key).length,
  }));

  const volumeByDay = lastNDays(7, nowMs).map((day) => ({
    day,
    count: views.filter((v) => v.receivedAt.slice(0, 10) === day).length,
  }));

  const agents = store.agents.map((agent) => {
    const mine = views.filter((v) => v.assigneeId === agent.id);
    return {
      agent,
      open: mine.filter((v) => v.open).length,
      resolved: mine.filter((v) => !v.open).length,
      urgent: mine.filter((v) => v.open && v.classification.priority === "urgent").length,
    };
  });

  return {
    totals: {
      all: views.length,
      open: open.length,
      new: views.filter((v) => v.status === "new").length,
      pending: views.filter((v) => v.status === "pending").length,
      resolved: resolved.length,
      breached: open.filter((v) => v.sla.status === "breached").length,
      atRisk: open.filter((v) => v.sla.status === "at_risk").length,
      unassigned: views.filter((v) => !v.assigneeId).length,
    },
    avgFirstResponseMinutes,
    slaCompliance,
    byCategory,
    byPriority,
    bySentiment,
    volumeByDay,
    agents,
  };
}

function lastNDays(n: number, nowMs: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(nowMs - i * 86_400_000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}