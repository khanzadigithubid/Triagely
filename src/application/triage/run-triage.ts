import type { Agent, Classification, InboundMessage } from "@/domain/ticket/schemas";
import { triageTicket } from "@/domain/triage/engine";
import { getEnv } from "@/infrastructure/config/env";
import { refineWithLlm } from "@/infrastructure/llm/triage";

/**
 * Run the full triage pipeline for one inbound message.
 *
 * Order of operations:
 *  1. Deterministic heuristic pass (always succeeds, no network).
 *  2. Optional LLM refinement when a key is configured and the heuristic is
 *     not confident enough (or is sitting on a priority boundary).
 *
 * The model may override category, priority, summary and the draft reply, but
 * it never replaces the numeric signals the rest of the system scores on.
 */

export interface RunTriageOptions {
  agent?: Agent;
  org?: string;
  signature?: string;
  /** Force-disable the LLM pass (used by tests / offline mode). */
  offline?: boolean;
}

export interface RunTriageResult {
  classification: Classification;
  draftReply: string;
  draftReplyEngine: Classification["engine"];
  refinedByLlm: boolean;
  model?: string;
  latencyMs?: number;
}

export async function runTriage(
  message: Pick<InboundMessage, "subject" | "body" | "fromName">,
  options: RunTriageOptions = {},
): Promise<RunTriageResult> {
  const env = getEnv();
  const org = options.org ?? env.SUPPORT_ORG;
  const signature = options.signature ?? env.SUPPORT_SIGNATURE;

  const base = triageTicket(
    { subject: message.subject, body: message.body, fromName: message.fromName },
    { agent: options.agent, org, signature },
  );

  if (options.offline) {
    return {
      classification: base.classification,
      draftReply: base.draftReply,
      draftReplyEngine: base.draftReplyEngine,
      refinedByLlm: false,
    };
  }

  const refinement = await refineWithLlm({
    subject: message.subject,
    body: message.body,
    fromName: message.fromName,
    language: base.classification.tags[0] ?? "en",
    heuristic: base.classification,
  });

  if (!refinement) {
    return {
      classification: base.classification,
      draftReply: base.draftReply,
      draftReplyEngine: base.draftReplyEngine,
      refinedByLlm: false,
    };
  }

  const override =
    refinement.category !== base.classification.category ||
    refinement.priority !== base.classification.priority;

  const classification: Classification = {
    ...base.classification,
    category: refinement.category,
    priority: refinement.priority,
    summary: refinement.summary,
    categoryConfidence: Math.max(base.classification.categoryConfidence, refinement.confidence),
    engine: "hybrid",
    tags: override
      ? [...new Set([...base.classification.tags, "ai-adjusted"])]
      : base.classification.tags,
  };

  return {
    classification,
    draftReply: refinement.draftReply,
    draftReplyEngine: "llm",
    refinedByLlm: true,
    model: refinement.model,
    latencyMs: refinement.latencyMs,
  };
}