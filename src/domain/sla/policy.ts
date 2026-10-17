import type { Priority, SlaStatus } from "@/domain/ticket/schemas";
import { SLA_TARGET_MINUTES } from "@/domain/ticket/schemas";

/**
 * SLA policy.
 *
 * Deterministic response-target computation. The domain module never reads the
 * clock; callers pass `now` in, which keeps tests exact and lets seeded data
 * simulate at-risk and breached tickets by offsetting `receivedAt`.
 */

export interface SlaDeadline {
  targetMinutes: number;
  targetAt: string;
  status: SlaStatus;
}

export interface SlaEval {
  status: SlaStatus;
  elapsedMinutes: number;
  remainingMinutes: number;
  progress: number; // 0-1 of the window consumed
}

export function slaDeadline(receivedAtMs: number, priority: Priority): SlaDeadline {
  const targetMinutes = SLA_TARGET_MINUTES[priority];
  return {
    targetMinutes,
    targetAt: new Date(receivedAtMs + targetMinutes * 60_000).toISOString(),
    status: "within",
  };
}

export function evaluateSla(
  receivedAtMs: number,
  targetAtMs: number,
  nowMs: number,
): SlaEval {
  const elapsedMinutes = Math.max(0, (nowMs - receivedAtMs) / 60_000);
  const remainingMinutes = (targetAtMs - nowMs) / 60_000;
  const window = targetAtMs - receivedAtMs;
  const progress = window > 0 ? Math.min(1, Math.max(0, (nowMs - receivedAtMs) / window)) : 1;

  let status: SlaStatus = "within";
  if (nowMs > targetAtMs) status = "breached";
  else if (progress >= 0.75) status = "at_risk";

  return { status, elapsedMinutes, remainingMinutes, progress };
}

/** Human-friendly remainder like "14m" or "3h 05m"; overshooting shows "-8m". */
export function formatRemaining(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  if (abs < 1) return `${sign}0m`;
  if (abs < 60) return `${sign}${Math.round(abs)}m`;
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${String(m).padStart(2, "0")}m`;
}