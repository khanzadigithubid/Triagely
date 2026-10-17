"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Languages,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Timer,
  UserCog,
} from "lucide-react";
import type { Agent, AuditEvent, Priority } from "@/domain/ticket/schemas";
import { PRIORITIES, PRIORITY_LABELS } from "@/domain/ticket/schemas";
import type { TicketView } from "@/application/tickets/queries";
import { Meter, ScoreRow } from "@/components/ui/charts";
import { Avatar, CategoryPill, PriorityPill, SlaPill, StatusPill, TagList } from "@/components/ui/pills";
import { cn, slaStyle } from "@/lib/styles";
import { timeAgo } from "@/lib/format";
import { formatRemaining } from "@/domain/sla/policy";

export function TicketDetail({
  ticket,
  agents,
  audit,
}: {
  ticket: TicketView;
  agents: Agent[];
  audit: AuditEvent[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(ticket.draftReply);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Request failed");
    }
    router.refresh();
  }

  function sendReply() {
    return run("reply", async () => {
      const res = await fetch(`/api/tickets/${ticket.id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      setNotice("Reply sent — ticket moved to awaiting customer.");
      router.refresh();
    });
  }

  function regenerate() {
    return run("regenerate", async () => {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "regenerate_draft" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to regenerate");
      setDraft(data.ticket.draftReply);
      setNotice(`Draft regenerated (${data.ticket.draftReplyEngine} engine).`);
      router.refresh();
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(draft);
    setNotice("Draft copied to clipboard.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
            {ticket.number} · {ticket.channel}
          </p>
          <h1 className="mt-1 text-xl font-semibold leading-snug tracking-tight text-balance">
            {ticket.subject}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Avatar name={ticket.fromName} className="size-5" />
              {ticket.fromName} · {ticket.fromEmail}
            </span>
            <span className="flex items-center gap-1">
              <Timer className="size-3" aria-hidden />
              received {timeAgo(ticket.receivedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Languages className="size-3" aria-hidden />
              {ticket.language.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={ticket.status} />
          <PriorityPill priority={ticket.classification.priority} />
          {ticket.open ? <SlaPill status={ticket.sla.status} /> : null}
        </div>
      </div>

      {(error || notice) && (
        <div
          className={cn(
            "panel px-4 py-2.5 text-xs",
            error ? "text-rose-300" : "text-emerald-300",
          )}
        >
          {error ?? notice}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Conversation */}
        <div className="space-y-3">
          <section className="panel p-0">
            <div className="border-b border-line-soft px-5 py-3">
              <h2 className="text-sm font-semibold">Conversation</h2>
            </div>
            <ul className="space-y-4 p-5">
              {ticket.thread.map((message) => (
                <li key={message.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[11px] text-faint">
                    <span className="font-medium text-muted">
                      {message.from === "customer" ? ticket.fromName : ticket.agent?.name ?? "Agent"}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(message.at)}</span>
                    {message.from === "agent" ? (
                      <span className="pill bg-white/5 text-faint">outbound</span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed",
                      message.from === "customer"
                        ? "bg-panel-2 text-ink"
                        : "bg-indigo-500/10 text-indigo-100 ring-1 ring-inset ring-indigo-500/20",
                    )}
                  >
                    {message.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-0">
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
              <h2 className="text-sm font-semibold">Suggested reply</h2>
              <span className="pill bg-white/5 text-faint">
                {ticket.draftReplyEngine === "llm" ? "llm draft" : "template draft"}
              </span>
            </div>
            <div className="p-5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                className="w-full resize-y rounded-lg border border-line bg-panel-2 p-3.5 text-sm leading-relaxed text-ink focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={busy !== null || !draft.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Send className="size-3.5" aria-hidden />
                  {busy === "reply" ? "Sending…" : "Send reply"}
                </button>
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink"
                >
                  <Copy className="size-3.5" aria-hidden />
                  Copy
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Triage panel */}
        <div className="space-y-3">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Automated triage</h2>
            <p className="mt-0.5 text-xs text-muted">
              Engine: <span className="text-ink">{ticket.classification.engine}</span>
            </p>

            <div className="mt-4 space-y-3">
              <ScoreRow
                label="Category"
                value={ticket.classification.categoryConfidence * 100}
                tone="accent"
              />
              <ScoreRow
                label="Priority"
                value={ticket.classification.priorityScore}
                tone={ticket.classification.priority === "urgent" ? "danger" : "warning"}
              />
              <ScoreRow label="Urgency" value={ticket.classification.urgencyScore} tone="warning" />
              <ScoreRow
                label="Sentiment"
                value={Math.abs(ticket.classification.sentimentScore) * 100}
                tone={ticket.classification.sentiment === "negative" ? "danger" : "positive"}
              />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line-soft pt-4 text-xs">
              <div>
                <dt className="text-faint">Category</dt>
                <dd className="mt-1">
                  <CategoryPill category={ticket.classification.category} />
                </dd>
              </div>
              <div>
                <dt className="text-faint">Sentiment</dt>
                <dd className="mt-1 font-mono tabular-nums text-ink">
                  {ticket.classification.sentimentScore >= 0 ? "+" : ""}
                  {ticket.classification.sentimentScore.toFixed(2)}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <p className="eyebrow mb-2">Signals</p>
              <TagList tags={ticket.classification.tags} />
            </div>

            <p className="mt-4 border-t border-line-soft pt-4 text-xs leading-relaxed text-muted">
              {ticket.classification.summary}
            </p>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold">SLA</h2>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className={cn("pill", slaStyle[ticket.sla.status])}>
                  {ticket.open ? `${formatRemaining(ticket.sla.remainingMinutes)} left` : "resolved"}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  target {ticket.sla.targetMinutes}m
                </span>
              </div>
              <Meter
                className="mt-3"
                value={ticket.sla.progress * 100}
                tone={ticket.sla.status === "breached" ? "danger" : ticket.sla.status === "at_risk" ? "warning" : "positive"}
              />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-faint">
                {ticket.sla.status === "breached" ? "deadline passed" : "respond before deadline"}
              </p>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <UserCog className="size-4 text-faint" aria-hidden />
              Assignment & priority
            </h2>

            <label className="mt-3 block text-xs text-faint">
              Assignee
              <select
                value={ticket.assigneeId ?? ""}
                onChange={(e) =>
                  run("assign", () => patch({ action: "reassign", agentId: e.target.value || null }))
                }
                disabled={busy !== null}
                className="mt-1 w-full rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-sm text-ink focus:outline-none"
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id} className="bg-panel-2">
                    {agent.name} — {agent.role}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs text-faint">
              Priority
              <select
                value={ticket.classification.priority}
                onChange={(e) =>
                  run("priority", () => patch({ action: "priority", priority: e.target.value as Priority }))
                }
                disabled={busy !== null}
                className="mt-1 w-full rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-sm text-ink focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="bg-panel-2">
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
              {ticket.priorityLocked ? (
                <span className="mt-1 block text-[10px] text-amber-300">
                  manually overridden — engine will not change this
                </span>
              ) : null}
            </label>

            <button
              type="button"
              onClick={() =>
                run("status", () =>
                  patch({ action: ticket.status === "resolved" ? "reopen" : "resolve" }),
                )
              }
              disabled={busy !== null}
              className={cn(
                "mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
                ticket.status === "resolved"
                  ? "border border-line text-muted hover:bg-white/5 hover:text-ink"
                  : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
              )}
            >
              {ticket.status === "resolved" ? (
                <>
                  <RotateCcw className="size-3.5" aria-hidden /> Reopen ticket
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" aria-hidden /> Mark resolved
                </>
              )}
            </button>
          </section>

          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <RefreshCw className="size-3.5 text-faint" aria-hidden />
              Audit trail
            </h2>
            <ol className="mt-3 space-y-3">
              {audit.slice(0, 8).map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs text-ink">
                      <span className="font-mono text-faint">{event.actor}</span> {event.action.replace(/_/g, " ")}
                    </p>
                    {event.detail ? (
                      <p className="truncate text-[11px] text-faint">{event.detail}</p>
                    ) : null}
                    <p className="font-mono text-[10px] text-faint">{timeAgo(event.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}