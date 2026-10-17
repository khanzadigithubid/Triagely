import { describe, expect, it } from "vitest";
import { SLA_TARGET_MINUTES } from "../ticket/schemas";
import { evaluateSla, formatRemaining, slaDeadline } from "./policy";

describe("slaDeadline", () => {
  it("targets 15 minutes for urgent tickets", () => {
    const received = Date.parse("2026-01-01T10:00:00Z");
    const { targetMinutes, targetAt } = slaDeadline(received, "urgent");
    expect(targetMinutes).toBe(15);
    expect(targetAt).toBe("2026-01-01T10:15:00.000Z");
  });

  it("uses the priority-specific target", () => {
    expect(SLA_TARGET_MINUTES.urgent).toBe(15);
    expect(SLA_TARGET_MINUTES.high).toBe(60);
    expect(SLA_TARGET_MINUTES.medium).toBe(240);
    expect(SLA_TARGET_MINUTES.low).toBe(1440);
  });
});

describe("evaluateSla", () => {
  const received = Date.parse("2026-01-01T10:00:00Z");
  const target = Date.parse("2026-01-01T11:00:00Z"); // 60 min later

  it("is within when well under the window", () => {
    const now = Date.parse("2026-01-01T10:10:00Z");
    const result = evaluateSla(received, target, now);
    expect(result.status).toBe("within");
    expect(result.remainingMinutes).toBeCloseTo(50, 0);
  });

  it("is at risk past 75% of the window", () => {
    const now = Date.parse("2026-01-01T10:46:00Z");
    const result = evaluateSla(received, target, now);
    expect(result.status).toBe("at_risk");
    expect(result.progress).toBeGreaterThanOrEqual(0.75);
  });

  it("is breached once the deadline passes", () => {
    const now = Date.parse("2026-01-01T11:01:00Z");
    const result = evaluateSla(received, target, now);
    expect(result.status).toBe("breached");
    expect(result.remainingMinutes).toBeLessThan(0);
  });

  it("clamps elapsed time to zero for future tickets", () => {
    const now = Date.parse("2026-01-01T09:00:00Z");
    const result = evaluateSla(received, target, now);
    expect(result.elapsedMinutes).toBe(0);
    expect(result.status).toBe("within");
  });
});

describe("formatRemaining", () => {
  it("formats minutes, hours and negatives", () => {
    expect(formatRemaining(14)).toBe("14m");
    expect(formatRemaining(185)).toBe("3h 05m");
    expect(formatRemaining(60)).toBe("1h");
    expect(formatRemaining(-8)).toBe("-8m");
  });
});