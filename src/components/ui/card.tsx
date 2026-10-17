import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={cn("panel p-5", className)}>{children}</Tag>;
}

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "positive" | "warning" | "danger" | "accent";
  icon?: ReactNode;
}) {
  const toneClass: Record<string, string> = {
    default: "text-ink",
    positive: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
    accent: "text-indigo-300",
  };
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon ? <span className="text-faint">{icon}</span> : null}
      </div>
      <div className={cn("mt-3 text-3xl font-semibold tracking-tight tabular-nums", toneClass[tone])}>
        {value}
      </div>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted">{hint}</p> : null}
    </div>
  );
}