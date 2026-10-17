import type { ReactNode } from "react";
import type { Category, Priority, Sentiment, SlaStatus, Status } from "@/domain/ticket/schemas";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/domain/ticket/schemas";
import {
  categoryStyle,
  cn,
  priorityStyle,
  sentimentStyle,
  slaLabel,
  slaStyle,
  statusStyle,
} from "@/lib/styles";
import { initials } from "@/lib/format";

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("pill", className)}>{children}</span>;
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return <Pill className={priorityStyle[priority]}>{PRIORITY_LABELS[priority]}</Pill>;
}

export function SentimentPill({ sentiment }: { sentiment: Sentiment }) {
  const icon = sentiment === "negative" ? "▼" : sentiment === "positive" ? "▲" : "●";
  return (
    <Pill className={sentimentStyle[sentiment]}>
      <span aria-hidden>{icon}</span>
      {sentiment}
    </Pill>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const dot =
    status === "new" ? "bg-violet-400" : status === "open" ? "bg-sky-400" : status === "pending" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <Pill className={statusStyle[status]}>
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {STATUS_LABELS[status]}
    </Pill>
  );
}

export function SlaPill({ status }: { status: SlaStatus }) {
  return <Pill className={slaStyle[status]}>{slaLabel[status]}</Pill>;
}

export function CategoryPill({ category }: { category: Category }) {
  return <Pill className={cn("bg-white/5", categoryStyle[category])}>{CATEGORY_LABELS[category]}</Pill>;
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-emerald-500/20 text-[10px] font-semibold text-ink ring-1 ring-inset ring-white/10",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}