import type { Classification } from "@/domain/ticket/schemas";
import { classifyCategory } from "@/domain/triage/classifier";
import { analyzeSentiment } from "@/domain/triage/sentiment";
import { analyzeUrgency } from "@/domain/triage/urgency";
import { scorePriority } from "@/domain/triage/priority";
import { normalize, titleCase, excerpt } from "@/domain/triage/text";
import { composeTemplateDraft, firstNameOf, type DraftContext } from "@/domain/triage/draft";
import type { Agent } from "@/domain/ticket/schemas";

/**
 * Full deterministic triage pass.
 *
 * Runs classification, sentiment, urgency and priority, then produces tags,
 * a one-line summary and a template draft reply. Pure and deterministic — the
 * application layer may upgrade the result with an LLM refinement pass, but
 * every enhancement here must merge, never replace, these base signals.
 */

export interface TriageInput {
  subject: string;
  body: string;
  fromName: string;
}

export interface TriageOutput {
  classification: Classification;
  draftReply: string;
  draftReplyEngine: Classification["engine"];
}

export interface TriageOptions {
  agent?: Agent;
  org?: string;
  signature?: string;
}

export function triageTicket(input: TriageInput, options: TriageOptions = {}): TriageOutput {
  const text = `${input.subject}\n${input.body}`;
  const { language } = normalize(text);

  const categoryResult = classifyCategory(input.subject, input.body);
  const sentimentResult = analyzeSentiment(input.subject, input.body);
  const urgencyResult = analyzeUrgency(input.subject, input.body);
  const priorityResult = scorePriority(
    input.subject,
    input.body,
    categoryResult.category,
    sentimentResult,
    urgencyResult,
  );

  const tags = buildTags({
    category: categoryResult.category,
    priority: priorityResult.priority,
    sentiment: sentimentResult.sentiment,
    urgencyScore: urgencyResult.urgencyScore,
    language,
    subject: input.subject,
    body: input.body,
  });

  const summary = excerpt([input.subject, input.body].join(" — ").replace(/\s+/g, " "), 96);

  const classification: Classification = {
    category: categoryResult.category,
    categoryConfidence: categoryResult.categoryConfidence,
    sentiment: sentimentResult.sentiment,
    sentimentScore: sentimentResult.sentimentScore,
    urgency: urgencyResult.urgency,
    urgencyScore: urgencyResult.urgencyScore,
    priority: priorityResult.priority,
    priorityScore: priorityResult.priorityScore,
    summary,
    tags,
    engine: "heuristic",
  };

  const draftContext: DraftContext = {
    customerFirstName: firstNameOf(input.fromName),
    category: classification.category,
    priority: classification.priority,
    sentiment: classification.sentiment,
    agentName: options.agent?.name ?? "Support Agent",
    org: options.org ?? "Triagely",
    signature: options.signature ?? "The {org} Support Team",
  };

  return {
    classification,
    draftReply: composeTemplateDraft(draftContext),
    draftReplyEngine: "heuristic" as const,
  };
}

function buildTags(input: {
  category: Classification["category"];
  priority: Classification["priority"];
  sentiment: Classification["sentiment"];
  urgencyScore: number;
  language: string;
  subject: string;
  body: string;
}): string[] {
  const tags: string[] = [];
  const text = `${input.subject} ${input.body}`.toLowerCase();

  if (input.language !== "en") tags.push(input.language.toUpperCase());
  if (input.urgencyScore >= 50) tags.push("time-sensitive");
  if (input.sentiment === "negative") tags.push("at-risk");
  if (/\b(beta|new release|v2|migration)\b/.test(text)) tags.push("release-related");
  if (/payment|credit card|charged|charge|invoice/i.test(text)) tags.push("payment-touchpoint");
  if (/api|webhook|integration|endpoint/i.test(text)) tags.push("api");
  if (/slack|notion|zapier|salesforce|hubspot/i.test(text)) tags.push("ecosystem");
  if (!tags.includes("time-sensitive") && input.urgencyScore >= 80) tags.push("escalate");

  if (input.sentiment === "positive") tags.push("happy-customer");
  if (input.sentiment === "negative") tags.push("csat-risk");

  const canonical = input.category !== "general" ? titleCase(input.category) : "";
  if (canonical && !tags.includes(canonical)) tags.unshift(canonical);

  return [...new Set(tags)];
}