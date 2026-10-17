import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export function BarList({
  items,
}: {
  items: { label: string; value: number; barClass: string; hint?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3">
          <span className="truncate text-xs text-muted">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/5">
            <span
              className={cn("block h-full rounded-full", item.barClass)}
              style={{ width: `${Math.round((item.value / max) * 100)}%` }}
            />
          </span>
          <span className="text-right font-mono text-xs tabular-nums text-ink">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function Donut({
  segments,
  total,
  centerLabel,
  centerValue,
}: {
  segments: { value: number; color: string }[];
  total: number;
  centerLabel: string;
  centerValue: ReactNode;
}) {
  const size = 148;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = Math.max(1, total);

  const arcs = segments.map((segment, index) => {
    const length = (segment.value / safeTotal) * circumference;
    const offset = segments
      .slice(0, index)
      .reduce((sum, s) => sum + (s.value / safeTotal) * circumference, 0);
    return { key: index, length, offset };
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segments[arc.key].color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-ink">{centerValue}</span>
        <span className="eyebrow mt-0.5">{centerLabel}</span>
      </div>
    </div>
  );
}

export function Columns({
  items,
}: {
  items: { label: string; value: number; active?: boolean }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-40 items-end gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="font-mono text-[10px] tabular-nums text-muted">{item.value}</span>
          <div
            className={cn(
              "w-full rounded-t-md transition-all",
              item.active ? "bg-accent-strong" : "bg-white/10",
            )}
            style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
          />
          <span className="font-mono text-[10px] text-faint">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Meter({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: "accent" | "positive" | "warning" | "danger";
  className?: string;
}) {
  const toneClass: Record<string, string> = {
    accent: "bg-indigo-400",
    positive: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
  };
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-white/5", className)}>
      <span
        className={cn("block h-full rounded-full", toneClass[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </span>
  );
}

export function ScoreRow({ label, value, tone }: { label: string; value: number; tone?: "accent" | "positive" | "warning" | "danger" }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3">
      <span className="text-xs text-muted">{label}</span>
      <Meter value={value} tone={tone} />
      <span className="text-right font-mono text-xs tabular-nums text-ink">{Math.round(value)}</span>
    </div>
  );
}