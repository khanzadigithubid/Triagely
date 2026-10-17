import type { Language } from "@/domain/ticket/schemas";

/**
 * Text normalization and language detection.
 *
 * Pure functions; the classifier, sentiment and urgency engines all consume the
 * normalized token stream produced here so phrase matching is consistent.
 */

export interface NormalizedText {
  /** Lowercased full text, trimmed. */
  raw: string;
  /** Single-word tokens (unicode letters/numbers). */
  words: string[];
  /** Lowercased whitespace-normalized text for phrase matching. */
  haystack: string;
  language: Language;
}

const WORD_RE = /[\p{L}\p{N}]+/gu;

export function normalize(text: string): NormalizedText {
  const raw = text.toLowerCase().trim();
  const words = Array.from(raw.matchAll(WORD_RE), (m) => m[0]);
  const haystack = words.join(" ");
  return { raw, words, haystack, language: detectLanguage(raw) };
}

const LANGUAGE_SIGNATURES: Record<Language, string[]> = {
  en: [
    "the", "and", "with", "please", "thank", "you", "can't", "not", "email",
    "account", "should", "would", "this", "that",
  ],
  es: [
    "el", "la", "los", "las", "por", "favor", "gracias", "cuenta", "error",
    "problema", "factura", "pago", "para", "con", "usted",
  ],
  fr: [
    "le", "la", "les", "je", "vous", "merci", "bonjour", "erreur", "problème",
    "probleme", "compte", "facture", "paiement", "avec", "pour",
  ],
  de: [
    "ich", "sie", "die", "der", "das", "danke", "bitte", "fehler", "problem",
    "konto", "rechnung", "zahlung", "mit", "und",
  ],
  ja: [],
  other: [],
};

const JAPANESE_RE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

export function detectLanguage(raw: string): Language {
  if (JAPANESE_RE.test(raw)) return "ja";

  const counts = new Map<Language, number>();
  for (const [lang, words] of Object.entries(LANGUAGE_SIGNATURES)) {
    let score = 0;
    for (const word of words) {
      if (raw.includes(word)) score += 1;
    }
    if (lang !== "other") counts.set(lang as Language, score);
  }

  let best: Language = "other";
  let bestScore = 0;
  for (const [lang, score] of counts) {
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Multi-word phrase matching against the normalized text. Phrases longer than
 * one token are matched as case-insensitive substrings of the whitespace-
 * normalized haystack (word-boundary safe because both sides are tokenized).
 */
export function matchesPhrase(haystack: string, words: string[], phrase: string): boolean {
  const tokens = phrase.toLowerCase().split(/\s+/);
  if (tokens.length === 1) return words.includes(tokens[0]!);
  return haystack.includes(tokens.join(" "));
}

export function countPhraseHits(haystack: string, words: string[], phrases: string[]): number {
  return phrases.reduce((acc, phrase) => acc + (matchesPhrase(haystack, words, phrase) ? 1 : 0), 0);
}

/** Score a weighted phrase table: returns total score and the matched phrases. */
export function scorePhrases(
  haystack: string,
  words: string[],
  table: Record<string, number>,
): { score: number; matches: string[] } {
  let score = 0;
  const matches: string[] = [];
  for (const [phrase, weight] of Object.entries(table)) {
    if (matchesPhrase(haystack, words, phrase)) {
      score += weight;
      matches.push(phrase);
    }
  }
  return { score, matches };
}

export function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

export function excerpt(text: string, maxLength = 200): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}