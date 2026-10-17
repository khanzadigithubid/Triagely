import type { Priority } from "@/domain/ticket/schemas";
import { normalize, scorePhrases } from "@/domain/triage/text";

/**
 * Urgency scoring.
 *
 * Explicit urgency language (deadlines, outages, blockers) is converted to a
 * 0-100 score. This is a hard-to-game input for the priority engine: anger is
 * not urgency, but a deadline or outage is, even from an otherwise calm user.
 */

const URGENT: Record<string, number> = {
  "urgent": 5,
  "asap": 4,
  "as soon as possible": 4,
  "immediately": 4,
  "right away": 3,
  "emergency": 5,
  "critical": 5,
  "blocker": 5,
  "blocking": 4.5,
  "stopped working": 4.5,
  "service is down": 5,
  "service down": 5,
  "outage": 5,
  "down for": 4,
  "production": 3,
  "deadline": 3,
  "due today": 4,
  "due tomorrow": 3,
  "until the end of the day": 3,
  "today": 2,
  "now": 1.5,
  "can't work": 4,
  "cannot work": 4,
  "completely blocked": 5,
  "no access": 4,
  "no longer access": 4,
  "can't access": 4,
  "cancelled": 3,
  "cancel immediately": 4,
  "stop charging": 4,
  "keep charging": 4,
  "charge again": 4,
  "hacked": 5,
  "security breach": 5,
  "unauthorized": 4,
  "privacy": 3,
  "legal": 3,
  "refund today": 4,
  "waiting for my money": 3,
  "billing error": 3,
  "payment deadline": 3,
  "suspension": 3.5,
  "shut down": 3.5,
  "closing": 3,
  "1 hour": 3,
  "within the hour": 4,
  "first thing monday": 2,
  "as soon as": 3,
};

export interface UrgencyResult {
  urgencyScore: number;
  urgency: Priority;
  matches: string[];
}

export function analyzeUrgency(subject: string, body: string): UrgencyResult {
  const { haystack, words } = normalize(`${subject}\n${body}`);
  const { score, matches } = scorePhrases(haystack, words, URGENT);

  const urgencyScore = Math.min(100, Math.round((score / 5) * 100));

  const urgency: Priority =
    urgencyScore >= 80 ? "urgent" : urgencyScore >= 50 ? "high" : "medium";

  return { urgencyScore, urgency, matches };
}