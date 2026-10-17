"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Category, Priority, Status } from "@/domain/ticket/schemas";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "@/domain/ticket/schemas";
import type { TicketView } from "@/application/tickets/queries";
import { Avatar, PriorityPill, SlaPill } from "@/components/ui/pills";
import { categoryStyle, cn } from "@/lib/styles";
import { timeAgo } from "@/lib/format";
import { formatRemaining } from "@/domain/sla/policy";

const OPEN_STATUSES: Status[] = ["new", "open", "pending"];

export function InboxView({ tickets }: { tickets: TicketView[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "all">("open");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status === "open") {
        if (!OPEN_STATUSES.includes(t.status)) return false;
      } else if (status !== "all" && t.status !== status) {
        return false;
      }
      if (priority !== "all" && t.classification.priority !== priority) return false;
      if (category !== "all" && t.classification.category !== category) return false;
      if (q) {
        const haystack = `${t.subject} ${t.fromName} ${t.fromEmail} ${t.number}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, query, status, priority, category]);

  const counts = useMemo(
    () => ({
      open: tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length,
      breached: tickets.filter((t) => t.open && t.sla.status === "breached").length,
      urgent: tickets.filter((t) => t.open && t.classification.priority === "urgent").length,
    }),
    [tickets],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Queue</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Inbox</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span>
            <span className="text-ink">{counts.open}</span> open
          </span>
          <span>
            <span className="text-rose-300">{counts.breached}</span> breached
          </span>
          <span>
            <span className="text-amber-300">{counts.urgent}</span> urgent
          </span>
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2">
          <Search className="size-4 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject, sender or ticket number…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={status}
            onChange={(v) => setStatus(v as Status | "all")}
            options={[
              { value: "open", label: "Active" },
              { value: "all", label: "All" },
              ...STATUSES.filter((s) => s !== "open").map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
              })),
            ]}
          />
          <FilterSelect
            value={priority}
            onChange={(v) => setPriority(v as Priority | "all")}
            options={[
              { value: "all", label: "Any priority" },
              ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
            ]}
          />
          <FilterSelect
            value={category}
            onChange={(v) => setCategory(v as Category | "all")}
            options={[
              { value: "all", label: "Any category" },
              ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel py-14 text-center text-sm text-muted">No tickets match these filters.</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/inbox/${ticket.id}`}
                className="panel flex items-center gap-3 p-3.5 transition-colors hover:border-line hover:bg-white/[0.03]"
              >
                <Avatar name={ticket.fromName} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{ticket.subject}</span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
                    {ticket.number} · {ticket.fromName} · {timeAgo(ticket.receivedAt)}
                  </p>
                </div>

                <span className={cn("hidden text-xs md:inline", categoryStyle[ticket.classification.category])}>
                  {CATEGORY_LABELS[ticket.classification.category]}
                </span>

                <div className="hidden lg:block">
                  <PriorityPill priority={ticket.classification.priority} />
                </div>

                <div className="w-24 text-right">
                  {ticket.open ? (
                    <>
                      <SlaPill status={ticket.sla.status} />
                      <p className="mt-1 font-mono text-[10px] text-faint">
                        {formatRemaining(ticket.sla.remainingMinutes)} left
                      </p>
                    </>
                  ) : (
                    <span className="pill bg-emerald-500/10 text-emerald-300">Resolved</span>
                  )}
                </div>

                <div className="hidden w-28 items-center justify-end gap-2 lg:flex">
                  {ticket.agent ? (
                    <span className="truncate text-right text-xs text-muted">{ticket.agent.name}</span>
                  ) : (
                    <span className="text-xs text-faint">unassigned</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-xs text-ink focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-panel-2">
          {option.label}
        </option>
      ))}
    </select>
  );
}
