import type { Category, Priority, Sentiment } from "@/domain/ticket/schemas";
import { normalize, scorePhrases } from "@/domain/triage/text";
import type { SentimentResult } from "@/domain/triage/sentiment";
import { type UrgencyResult, analyzeUrgency } from "@/domain/triage/urgency";

/**
 * Priority engine.
 *
 * Combines urgency language, sentiment, and explicit priority words into a
 * single 0-100 score. The score is intentionally dominated by concrete urgency
 * (outages, deadlines, security) over tone, then the result is bucketed into
 * the four support priorities.
 */

const EXPLICIT: Record<string, number> = {
  "p0": 5,
  "p1": 4,
  "p2": 2,
  "critical": 5,
  "high priority": 4,
  "very important": 3,
  "blocker": 5,
  "emergency": 5,
  "incident": 4,
  "release": 3,
  "deployed today": 3,
  "breaking change": 4,
};

/** Category uplift: money + security problems are worth more than feature asks. */
const CATEGORY_UPLIFT: Record<Category, number> = {
  billing: 8,
  technical: 6,
  account: 12,
  refund: 8,
  product: 0,
  request: 0,
  general: 2,
};

const SATURATION = 7;

export interface PriorityResult {
  priority: Priority;
  priorityScore: number;
  components: {
    urgency: number;
    sentiment: number;
    explicit: number;
    category: number;
  };
}

export function scorePriority(
  subject: string,
  body: string,
  category: Category,
  sentiment: SentimentResult,
  urgency: UrgencyResult = analyzeUrgency(subject, body),
): PriorityResult {
  const { haystack, words } = normalize(`${subject}\n${body}`);
  const explicit = scorePhrases(haystack, words, EXPLICIT).score;

  // Sentiment term: positive tone pulls the score down, negative tone up.
  const sentimentTerm = (-sentiment.sentimentScore * SATURATION * 4) / 3; // [-8, +8]

  const uplift = {
    urgency: urgency.urgencyScore,
    sentiment: 50 + sentimentTerm,
    explicit: Math.min(100, (explicit / 5) * 100),
    category: Math.min(100, (CATEGORY_UPLIFT[category] / 12) * 100),
  };

  const priorityScore = Math.round(
    uplift.urgency * 0.5 + uplift.sentiment * 0.22 + uplift.explicit * 0.18 + uplift.category * 0.1,
  );
  const clamped = Math.max(0, Math.min(100, priorityScore));

  const priority: Priority =
    clamped >= 72 ? "urgent" : clamped >= 50 ? "high" : clamped >= 30 ? "medium" : "low";

  return { priority, priorityScore: clamped, components: uplift };
}

export function priorityFromScore(score: number): Priority {
  if (score >= 72) return "urgent";
  if (score >= 50) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export function sentimentLabel(sentiment: Sentiment): string {
  return sentiment[0]!.toUpperCase() + sentiment.slice(1);
}