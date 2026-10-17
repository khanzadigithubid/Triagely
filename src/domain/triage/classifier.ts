import type { Category } from "@/domain/ticket/schemas";
import { CATEGORIES } from "@/domain/ticket/schemas";
import { normalize, scorePhrases } from "@/domain/triage/text";

/**
 * Rule-based category classifier.
 *
 * Weighted phrase tables per category. The score is the sum of matched phrase
 * weights. Confidence blends dominance (top / (top + second)) with evidence
 * strength (top / 6), so a single weak match on a greeting is not reported as a
 * confident classification.
 */

const TABLES: Record<Category, Record<string, number>> = {
  billing: {
    "charged": 3,
    "charged twice": 4,
    "double charged": 4,
    "charge": 2,
    "overcharged": 4,
    "overcharge": 4,
    "invoice": 3,
    "receipt": 2,
    "payment failed": 3,
    "payment": 2,
    "declined": 2,
    "credit card": 3,
    "debit card": 3,
    "subscription fee": 3,
    "subscription price": 3,
    "renewal": 2,
    "billing": 3,
    "billed": 3,
    "billing statement": 3,
    "annual plan": 2,
    "monthly plan": 2,
    "tax": 1,
    "upgrade my plan": 2,
    "downgrade": 2,
    "cancel my subscription": 3,
    "cancel subscription": 3,
  },
  technical: {
    "error": 3,
    "error message": 3,
    "bug": 4,
    "crash": 4,
    "crashes": 4,
    "not working": 4,
    "isn't working": 4,
    "doesn't work": 4,
    "broken": 4,
    "fails": 3,
    "failed to": 3,
    "issue": 2,
    "technical": 3,
    "white screen": 4,
    "freeze": 3,
    "frozen": 3,
    "slow": 2,
    "won't load": 4,
    "will not load": 4,
    "timeout": 3,
    "timing out": 3,
    "api": 3,
    "endpoint": 3,
    "webhook": 3,
    "integration": 2,
    "sync": 2,
    "synchronization": 3,
    "glitch": 3,
    "gdpr": 3,
    "css": 2,
    "javascript": 2,
    "404": 3,
    "500": 3,
    "exception": 3,
    "stack trace": 4,
    "access token": 2,
    "authentication failed": 3,
    "oauth": 3,
    "upload": 2,
    "download": 2,
  },
  account: {
    "login": 3,
    "log in": 3,
    "log in to": 3,
    "sign in": 3,
    "password": 3,
    "reset password": 4,
    "forgot my password": 4,
    "locked out": 4,
    "account locked": 4,
    "can't log in": 4,
    "cannot log in": 4,
    "access my account": 3,
    "two factor": 4,
    "two-factor": 4,
    "2fa": 4,
    "verification code": 3,
    "otp": 3,
    "unverified": 3,
    "verify my account": 3,
    "account hacked": 5,
    "hacked": 5,
    "unauthorized": 4,
    "suspicious activity": 4,
    "change my email": 3,
    "change my password": 3,
    "delete my account": 3,
    "profile": 1,
    "username": 2,
  },
  refund: {
    "refund": 4,
    "refunded": 4,
    "money back": 4,
    "refund request": 4,
    "reimburse": 3,
    "reimbursed": 3,
    "chargeback": 4,
    "dispute": 3,
    "want my money": 4,
    "return my": 2,
    "credit note": 3,
    "cash back": 3,
  },
  product: {
    "how do i": 3,
    "how can i": 3,
    "how to": 3,
    "does it support": 4,
    "does your product": 3,
    "does the": 1,
    "is it possible": 3,
    "feature": 3,
    "feature request": 4,
    "request a feature": 4,
    "roadmap": 2,
    "documentation": 2,
    "tutorial": 2,
    "guide": 1,
    "question about": 2,
    "compatible with": 3,
    "import": 2,
    "export": 2,
    "zapier": 3,
    "notion": 3,
    "salesforce": 3,
    "slack integration": 2,
    "mobile app": 2,
    "desktop app": 2,
  },
  request: {
    "demo": 3,
    "book a demo": 4,
    "walkthrough": 3,
    "pricing": 3,
    "price": 2,
    "quote": 3,
    "proposal": 3,
    "partnership": 4,
    "partner": 2,
    "white label": 3,
    "whitelabel": 3,
    "reseller": 3,
    "trial": 3,
    "enterprise plan": 3,
    "rfi": 4,
    "rfc": 3,
    "security questionnaire": 4,
    "sales team": 3,
    "speak to sales": 4,
    "roi": 2,
    "vendor": 2,
    "supplier": 2,
  },
  general: {
    "thanks": 1,
    "hello": 1,
    "hi": 1,
    "feedback": 2,
    "suggestion": 2,
    "comment": 1,
    "spoke with": 1,
    "talk to someone": 2,
    "someone from": 1,
  },
};

export interface ClassificationResult {
  category: Category;
  categoryConfidence: number;
  scores: Record<Category, number>;
}

export function classifyCategory(
  subject: string,
  body: string,
): ClassificationResult {
  const text = `${subject}\n${body}`;
  const { haystack, words } = normalize(text);

  const scores = {} as Record<Category, number>;
  for (const category of CATEGORIES) {
    scores[category] = scorePhrases(haystack, words, TABLES[category]).score;
  }

  const ranked = (Object.entries(scores) as [Category, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const top = ranked[0]!;
  const second = ranked[1]!;

  let category: Category = top[0];
  if (top[1] === 0) category = "general";

  const confidence =
    top[1] + second[1] > 0
      ? Math.round((top[1] / (top[1] + second[1])) * Math.min(1, top[1] / 6) * 10000) / 10000
      : 0;

  return { category, categoryConfidence: confidence, scores };
}