import type { Metadata } from "next";
import { computeAnalytics } from "@/application/tickets/queries";
import { BarList, Columns, Meter } from "@/components/ui/charts";
import { Card, KpiCard, SectionHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/pills";
import { categoryBar, priorityBar } from "@/lib/styles";
import { CATEGORY_LABELS, PRIORITY_LABELS } from "@/domain/ticket/schemas";
import { formatDuration, formatPercent, weekday } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Analytics" };

const SENTIMENT_LABEL: Record<string, string> = {
  negative: "Negative",
  neutral: "Neutral",
  positive: "Positive",
};
const SENTIMENT_BAR: Record<string, string> = {
  negative: "bg-rose-500",
  neutral: "bg-zinc-500",
  positive: "bg-emerald-500",
};

export default function AnalyticsPage() {
  const analytics = computeAnalytics();
  const { totals } = analytics;
  const resolutionRate = totals.all > 0 ? (totals.resolved / totals.all) * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);

  const maxAgent = Math.max(
    1,
    ...analytics.agents.map((a) => a.open + a.resolved),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Insights</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Aggregates computed live from the store: automation coverage, SLA performance, category
          and sentiment mix, and per-agent workload.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total tickets" value={totals.all} sub="all time" tone="accent" />
        <KpiCard
          label="Resolution rate"
          value={formatPercent(resolutionRate)}
          sub={`${totals.resolved} resolved`}
          tone="positive"
        />
        <KpiCard
          label="Avg first response"
          value={analytics.avgFirstResponseMinutes === null ? "—" : formatDuration(analytics.avgFirstResponseMinutes)}
          sub="across replied tickets"
        />
        <KpiCard
          label="Unassigned"
          value={totals.unassigned}
          sub={`${totals.new} brand new`}
          tone={totals.unassigned > 0 ? "warning" : "positive"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Category mix" hint="Classification across all tickets" />
          <BarList
            items={analytics.byCategory.map((c) => ({
              label: CATEGORY_LABELS[c.key],
              value: c.count,
              barClass: categoryBar[c.key],
            }))}
          />
        </Card>

        <Card>
          <SectionHeader title="Priority distribution" hint="Engine-assigned" />
          <BarList
            items={analytics.byPriority.map((p) => ({
              label: PRIORITY_LABELS[p.key],
              value: p.count,
              barClass: priorityBar[p.key],
              hint: `${p.open} open`,
            }))}
          />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-4 text-xs sm:grid-cols-4">
            {analytics.byPriority.map((p) => (
              <div key={p.key}>
                <p className="font-mono text-sm tabular-nums text-ink">{p.open}</p>
                <p className="text-faint">{PRIORITY_LABELS[p.key]} open</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Sentiment" hint="Tone of inbound messages" />
          <BarList
            items={analytics.bySentiment.map((s) => ({
              label: SENTIMENT_LABEL[s.key],
              value: s.count,
              barClass: SENTIMENT_BAR[s.key],
            }))}
          />
          <div className="mt-5 border-t border-line-soft pt-4">
            <p className="eyebrow mb-2">SLA compliance (open queue)</p>
            <Meter value={analytics.slaCompliance ?? 0} tone="positive" />
            <p className="mt-2 text-xs text-muted">
              {formatPercent(analytics.slaCompliance)} of open tickets are still within their
              response target — {totals.breached} breached, {totals.atRisk} at risk.
            </p>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Volume" hint="Last 7 days" />
          <Columns
            items={analytics.volumeByDay.map((d) => ({
              label: weekday(d.day),
              value: d.count,
              active: d.day === today,
            }))}
          />
          <p className="mt-4 border-t border-line-soft pt-4 text-xs text-muted">
            Automation coverage is 100% — every inbound message is classified, scored, routed and
            given a draft reply without human input.
          </p>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Agent performance" hint="Workload and throughput" />
        <ul className="space-y-3">
          {analytics.agents.map(({ agent, open, resolved, urgent }) => (
            <li key={agent.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <Avatar name={agent.name} className="size-8" />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-sm text-ink">{agent.name}</p>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-faint">
                    {agent.specialty.join(" · ") || "frontline"}
                  </span>
                </div>
                <Meter
                  className="mt-2"
                  value={((open + resolved) / maxAgent) * 100}
                  tone="accent"
                />
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="font-mono text-sm tabular-nums text-ink">{open}</p>
                  <p className="font-mono text-[10px] text-faint">open</p>
                </div>
                <div>
                  <p className="font-mono text-sm tabular-nums text-ink">{resolved}</p>
                  <p className="font-mono text-[10px] text-faint">done</p>
                </div>
                <div>
                  <p className="font-mono text-sm tabular-nums text-rose-300">{urgent}</p>
                  <p className="font-mono text-[10px] text-faint">urgent</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}