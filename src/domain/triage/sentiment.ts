import type { Sentiment } from "@/domain/ticket/schemas";
import { normalize, scorePhrases } from "@/domain/triage/text";

/**
 * Sentiment scoring.
 *
 * Weighted negative and positive phrase tables; the score is bounded to
 * [-1, 1] with a soft saturation so a handful of strong words can't push the
 * signal to the extreme.
 */

const NEGATIVE: Record<string, number> = {
  "can't": 2,
  "cannot": 2,
  "never": 1,
  "not": 0.5,
  "broken": 3,
  "terrible": 4,
  "awful": 4,
  "horrible": 4,
  "disappointed": 3,
  "frustrated": 3,
  "frustrating": 3,
  "unacceptable": 4,
  "charged twice": 4,
  "overcharged": 4,
  "fraud": 5,
  "error": 2,
  "bug": 2,
  "crash": 2,
  "failed": 2,
  "fails": 2,
  "problem": 1.5,
  "issue": 1.5,
  "mistake": 2,
  "wrong": 2,
  "angry": 4,
  "upset": 3,
  "waste": 3,
  "money back": 3,
  "refund": 2,
  "ridiculous": 4,
  "ridiculously": 4,
  "slow": 1.5,
  "down": 2,
  "unavailable": 2,
  "hacked": 5,
  "lock me out": 3,
  "ripped off": 4,
  "scam": 5,
  "disgusting": 5,
  "worst": 4,
  "horrendous": 4,
  "do not recommend": 3,
  "cancelling": 2,
  "complain": 3,
  "complaint": 3,
  "billing error": 3,
  "unfair": 3,
  "infuriating": 4,
};

const POSITIVE: Record<string, number> = {
  "thanks": 2,
  "thank you": 3,
  "great": 2.5,
  "awesome": 3,
  "amazing": 3.5,
  "love": 2.5,
  "works": 1.5,
  "working": 1,
  "perfect": 3,
  "excellent": 3.5,
  "appreciate": 2.5,
  "helpful": 2,
  "satisfied": 3,
  "happy": 2.5,
  "wonderful": 3.5,
  "best": 2,
  "best product": 3,
  "fantastic": 3.5,
  "brilliant": 3,
  "impressed": 3,
  "delighted": 3.5,
  "no complaints": 2,
  "works perfectly": 3.5,
  "love using": 2.5,
  "recommend": 2,
};

const SATURATION = 6;

export interface SentimentResult {
  sentiment: Sentiment;
  sentimentScore: number;
  negativeScore: number;
  positiveScore: number;
}

export function analyzeSentiment(subject: string, body: string): SentimentResult {
  const { haystack, words } = normalize(`${subject}\n${body}`);
  const negative = scorePhrases(haystack, words, NEGATIVE).score;
  const positive = scorePhrases(haystack, words, POSITIVE).score;

  const bounded = (value: number): number => Math.tanh(value / SATURATION);
  const sentimentScore =
    Math.round((bounded(positive) - bounded(negative)) * 10000) / 10000;

  const sentiment: Sentiment =
    sentimentScore < -0.12 ? "negative" : sentimentScore > 0.12 ? "positive" : "neutral";

  return { sentiment, sentimentScore, negativeScore: negative, positiveScore: positive };
}