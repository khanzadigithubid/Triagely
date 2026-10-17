import { z } from "zod";
import {
  CATEGORIES,
  PRIORITIES,
  type Category,
  type Classification,
  type Priority,
} from "@/domain/ticket/schemas";
import { getEnv } from "@/infrastructure/config/env";
import { log } from "@/infrastructure/observability/logger";
import { LlmClient, LlmError } from "./client";

/**
 * Optional LLM refinement.
 *
 * The heuristic engine always produces a full classification and a template
 * draft. When an API key is configured AND the heuristic is not confident, the
 * model is asked to (a) confirm or correct category/priority, (b) write a
 * one-line summary, and (c) draft a reply. Its output is validated and merged;
 * any failure falls back silently to the heuristic result.
 */

const SYSTEM_PROMPT = `You are a customer-support triage engine for an international SaaS company.

Given an inbound ticket, return a single JSON object with:
- "category": one of ${CATEGORIES.map((c) => `"${c}"`).join(", ")}
- "priority": one of ${PRIORITIES.map((p) => `"${p}"`).join(", ")}
- "summary": one short factual sentence (< 30 words), no greetings
- "draftReply": a warm, professional first response in the customer's language. Do not promise refunds, compensation, or specific deadlines. Tell them the next step.
- "confidence": number 0-1 for your category+priority decision

Rules: trust explicit urgency (outages, deadlines, security) over tone. Money and
account-security issues rank higher. Never invent facts about the account.`;

const RESPONSE_SHAPE = `{ "category": string, "priority": string, "summary": string, "draftReply": string, "confidence": number }`;

const RefinementSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  summary: z.string().min(1).max(400),
  draftReply: z.string().min(1).max(4000),
  confidence: z.coerce.number().min(0).max(1),
});

export interface RefinementResult {
  category: Category;
  priority: Priority;
  summary: string;
  draftReply: string;
  confidence: number;
  model: string;
  latencyMs: number;
}

export interface RefinementInput {
  subject: string;
  body: string;
  fromName: string;
  language: string;
  heuristic: Classification;
}

export async function refineWithLlm(
  input: RefinementInput,
  options: { client?: LlmClient } = {},
): Promise<RefinementResult | null> {
  const client = options.client ?? new LlmClient();
  if (!client.isConfigured) return null;

  const env = getEnv();
  if (
    input.heuristic.categoryConfidence >= env.LLM_CONFIDENCE_THRESHOLD &&
    !isBorderline(input.heuristic)
  ) {
    return null;
  }

  const user = [
    `Language: ${input.language}`,
    `Heuristic guess: category=${input.heuristic.category} priority=${input.heuristic.priority} (confidence ${input.heuristic.categoryConfidence})`,
    `Required JSON shape: ${RESPONSE_SHAPE}`,
    "",
    "--- SUBJECT ---",
    input.subject,
    "--- BODY ---",
    input.body,
    "--- END ---",
  ].join("\n");

  try {
    const response = await client.extractJson({
      system: SYSTEM_PROMPT,
      user,
      validate: (raw) => RefinementSchema.parse(raw),
    });

    log.info(
      `LLM refinement: ${response.data.category}/${response.data.priority} (model ${response.model})`,
    );

    return {
      ...response.data,
      model: response.model,
      latencyMs: response.latencyMs,
    };
  } catch (error) {
    const message = error instanceof LlmError ? error.message : "unexpected error";
    log.warn(`LLM refinement skipped: ${message}`);
    return null;
  }
}

/** Mid-band priorities are worth a second opinion even at high category confidence. */
function isBorderline(classification: Classification): boolean {
  return classification.priorityScore >= 44 && classification.priorityScore <= 58;
}