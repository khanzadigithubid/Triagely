import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Inbox,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { computeAnalytics, listTickets } from "@/application/tickets/queries";
import { BarList, Columns, Donut } from "@/components/ui/charts";
import { Card, KpiCard, SectionHeader } from "@/components/ui/card";
import { Avatar, PriorityPill, SlaPill, StatusPill } from "@/components/ui/pills";
import { categoryBar, categoryStyle } from "@/lib/styles";
import { CATEGORY_LABELS, PRIORITY_LABELS } from "@/domain/ticket/schemas";
import { formatDuration, formatPercent, timeAgo, weekday } from "@/lib/format";

export const dynamic = "force-dynamic";

const PRIORITY_HEX: Record<string, string> = {
  urgent: "#fb7185",
  high: "#fbbf24",
  medium: "#38bdf8",
  low: "#71717a",
};

export default async function OverviewPage() {
  const analytics = await computeAnalytics();
  const tickets = await listTickets();
  const { totals } = analytics;

  const needingAttention = tickets
    .filter((t) => t.open && (t.sla.status === "breached" || t.sla.status === "at_risk"))
    .slice(0, 6);
  const recent = tickets.slice(0, 7);

  const today = new Date().toISOString().slice(0, 10);
  const prioritySegments = analytics.byPriority.map((p) => ({
    value: p.count,
    color: PRIORITY_HEX[p.key] ?? "#71717a",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Support overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Live triage across the inbound queue. Every ticket is classified, prioritized and
            routed automatically — SLA state updates the moment this page renders.
          </p>
        </div>
        <Link
          href="/simulate"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          <Sparkles className="size-3.5" aria-hidden />
          Simulate an inbound email
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Open queue"
          value={totals.open}
          sub={`${totals.new} new · ${totals.pending} awaiting customer`}
          tone="accent"
          icon={<Inbox className="size-4" aria-hidden />}
        />
        <KpiCard
          label="SLA breaches"
          value={totals.breached}
          sub={`${totals.atRisk} at risk right now`}
          tone={totals.breached > 0 ? "danger" : "positive"}
          icon={<AlertTriangle className="size-4" aria-hidden />}
        />
        <KpiCard
          label="SLA compliance"
          value={formatPercent(analytics.slaCompliance)}
          sub="open tickets not yet breached"
          tone="positive"
          icon={<ShieldCheck className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Avg first response"
          value={analytics.avgFirstResponseMinutes === null ? "—" : formatDuration(analytics.avgFirstResponseMinutes)}
          sub="median target 1h"
          icon={<Timer className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionHeader
            title="Volume by category"
            hint="Auto-classified across the whole inbox"
            action={
              <span className="eyebrow">
                {totals.all} total · {totals.resolved} resolved
              </span>
            }
          />
          <BarList
            items={analytics.byCategory.map((c) => ({
              label: CATEGORY_LABELS[c.key],
              value: c.count,
              barClass: categoryBar[c.key],
            }))}
          />
        </Card>

        <Card>
          <SectionHeader title="Priority mix" hint="Engine-assigned urgency" />
          <Donut
            segments={prioritySegments}
            total={totals.all}
            centerValue={totals.open}
            centerLabel="open"
          />
          <ul className="mt-5 grid grid-cols-2 gap-2">
            {analytics.byPriority.map((p) => (
              <li key={p.key} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: PRIORITY_HEX[p.key] }}
                  aria-hidden
                />
                <span className="text-muted">{PRIORITY_LABELS[p.key]}</span>
                <span className="ml-auto font-mono tabular-nums text-ink">{p.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionHeader
            title="Needs attention"
            hint="Breached or at-risk open tickets"
            action={
              <Link href="/inbox" className="flex items-center gap-1 text-xs text-accent hover:underline">
                Open inbox <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          {needingAttention.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">
              Nothing is breached or at risk. The queue is healthy.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {needingAttention.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/inbox/${ticket.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5"
                  >
                    <Avatar name={ticket.fromName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{ticket.subject}</p>
                      <p className="truncate font-mono text-[11px] text-faint">
                        {ticket.number} · {ticket.fromName} · {timeAgo(ticket.receivedAt)}
                      </p>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <PriorityPill priority={ticket.classification.priority} />
                    </div>
                    <SlaPill status={ticket.sla.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader title="Inbound volume" hint="Last 7 days" />
          <Columns
            items={analytics.volumeByDay.map((d) => ({
              label: weekday(d.day),
              value: d.count,
              active: d.day === today,
            }))}
          />
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line-soft pt-4 text-center">
            <div>
              <p className="font-mono text-lg tabular-nums text-emerald-300">
                {analytics.bySentiment.find((s) => s.key === "positive")?.count ?? 0}
              </p>
              <p className="eyebrow mt-0.5">positive</p>
            </div>
            <div>
              <p className="font-mono text-lg tabular-nums text-ink">
                {analytics.bySentiment.find((s) => s.key === "neutral")?.count ?? 0}
              </p>
              <p className="eyebrow mt-0.5">neutral</p>
            </div>
            <div>
              <p className="font-mono text-lg tabular-nums text-rose-300">
                {analytics.bySentiment.find((s) => s.key === "negative")?.count ?? 0}
              </p>
              <p className="eyebrow mt-0.5">negative</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader
          title="Recent tickets"
          hint="Newest activity across channels"
          action={<span className="eyebrow">showing {recent.length}</span>}
        />
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line-soft text-left">
                <th className="px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-faint">Ticket</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-faint">Category</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-faint">Priority</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-faint">Status</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-faint">SLA</th>
                <th className="px-5 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-faint">Received</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((ticket) => (
                <tr key={ticket.id} className="border-b border-line-soft last:border-0 hover:bg-white/[0.03]">
                  <td className="max-w-[22rem] px-5 py-3">
                    <Link href={`/inbox/${ticket.id}`} className="block truncate text-ink hover:text-accent">
                      {ticket.subject}
                    </Link>
                    <span className="font-mono text-[11px] text-faint">
                      {ticket.number} · {ticket.fromName}
                    </span>
                  </td>
                  <td className={`px-3 py-3 text-xs ${categoryStyle[ticket.classification.category]}`}>
                    {CATEGORY_LABELS[ticket.classification.category]}
                  </td>
                  <td className="px-3 py-3">
                    <PriorityPill priority={ticket.classification.priority} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={ticket.status} />
                  </td>
                  <td className="px-3 py-3">
                    <SlaPill status={ticket.sla.status} />
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[11px] text-faint">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" aria-hidden />
                      {timeAgo(ticket.receivedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Agent workload" hint="Open tickets per specialist" />
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...analytics.agents]
            .sort((a, b) => b.open - a.open)
            .map(({ agent, open, urgent }) => (
              <li key={agent.id} className="panel-2 flex items-center gap-3 p-3">
                <Avatar name={agent.name} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{agent.name}</p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-wide text-faint">
                    {agent.role}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm tabular-nums text-ink">{open}</p>
                  <p className="font-mono text-[10px] text-faint">
                    open{urgent > 0 ? ` · ${urgent} urg` : ""}
                  </p>
                </div>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
