import type {
  Category,
  Priority,
  Sentiment,
  SlaStatus,
  Status,
} from "@/domain/ticket/schemas";

/**
 * Tailwind class maps for domain enums. Kept in one place so pills, charts and
 * tables stay visually consistent.
 */

export const priorityStyle: Record<Priority, string> = {
  urgent: "bg-rose-500/12 text-rose-300 ring-rose-500/30",
  high: "bg-amber-500/12 text-amber-300 ring-amber-500/30",
  medium: "bg-sky-500/12 text-sky-300 ring-sky-500/30",
  low: "bg-zinc-500/12 text-zinc-300 ring-zinc-500/30",
};

export const priorityBar: Record<Priority, string> = {
  urgent: "bg-rose-500",
  high: "bg-amber-500",
  medium: "bg-sky-500",
  low: "bg-zinc-500",
};

export const sentimentStyle: Record<Sentiment, string> = {
  negative: "bg-rose-500/12 text-rose-300 ring-rose-500/30",
  neutral: "bg-zinc-500/12 text-zinc-300 ring-zinc-500/30",
  positive: "bg-emerald-500/12 text-emerald-300 ring-emerald-500/30",
};

export const statusStyle: Record<Status, string> = {
  new: "bg-violet-500/12 text-violet-300 ring-violet-500/30",
  open: "bg-sky-500/12 text-sky-300 ring-sky-500/30",
  pending: "bg-amber-500/12 text-amber-300 ring-amber-500/30",
  resolved: "bg-emerald-500/12 text-emerald-300 ring-emerald-500/30",
};

export const slaStyle: Record<SlaStatus, string> = {
  within: "bg-emerald-500/12 text-emerald-300 ring-emerald-500/30",
  at_risk: "bg-amber-500/12 text-amber-300 ring-amber-500/30",
  breached: "bg-rose-500/12 text-rose-300 ring-rose-500/30",
};

export const slaLabel: Record<SlaStatus, string> = {
  within: "Within SLA",
  at_risk: "At risk",
  breached: "Breached",
};

export const categoryStyle: Record<Category, string> = {
  billing: "text-amber-300",
  technical: "text-sky-300",
  account: "text-violet-300",
  refund: "text-emerald-300",
  product: "text-cyan-300",
  request: "text-fuchsia-300",
  general: "text-zinc-300",
};

export const categoryBar: Record<Category, string> = {
  billing: "bg-amber-500",
  technical: "bg-sky-500",
  account: "bg-violet-500",
  refund: "bg-emerald-500",
  product: "bg-cyan-500",
  request: "bg-fuchsia-500",
  general: "bg-zinc-500",
};

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}