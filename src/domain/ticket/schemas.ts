import { z } from "zod";

/**
 * Core ticket domain types and Zod schemas.
 *
 * This module is pure data: no I/O, no crypto, no time source. Everything
 * downstream (storage, use cases, UI) is typed against these shapes.
 */

export const CATEGORIES = [
  "billing",
  "technical",
  "account",
  "refund",
  "product",
  "request",
  "general",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  billing: "Billing",
  technical: "Technical",
  account: "Account & Security",
  refund: "Refund",
  product: "Product Question",
  request: "Sales & Request",
  general: "General",
};

export const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const SENTIMENTS = ["negative", "neutral", "positive"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const STATUSES = ["new", "open", "pending", "resolved"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  open: "Open",
  pending: "Awaiting reply",
  resolved: "Resolved",
};

export const CHANNELS = ["email", "web", "api", "slack"] as const;
export type Channel = (typeof CHANNELS)[number];

export const LANGUAGES = ["en", "es", "fr", "de", "ja", "other"] as const;
export type Language = (typeof LANGUAGES)[number];

export const SLA_STATUSES = ["within", "at_risk", "breached"] as const;
export type SlaStatus = (typeof SLA_STATUSES)[number];

export const ENGINES = ["heuristic", "llm", "hybrid"] as const;
export type Engine = (typeof ENGINES)[number];

/** Response-target SLA in minutes, keyed by priority. */
export const SLA_TARGET_MINUTES: Record<Priority, number> = {
  urgent: 15,
  high: 60,
  medium: 240,
  low: 1440,
};

export const ClassificationSchema = z.object({
  category: z.enum(CATEGORIES),
  categoryConfidence: z.number().min(0).max(1),
  sentiment: z.enum(SENTIMENTS),
  sentimentScore: z.number().min(-1).max(1),
  urgency: z.enum(PRIORITIES).optional(),
  urgencyScore: z.number().min(0).max(100),
  priority: z.enum(PRIORITIES),
  priorityScore: z.number().min(0).max(100),
  summary: z.string(),
  tags: z.array(z.string()).default([]),
  engine: z.enum(ENGINES),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const SlaSchema = z.object({
  targetMinutes: z.number().positive(),
  targetAt: z.string().datetime(),
  status: z.enum(SLA_STATUSES),
});
export type Sla = z.infer<typeof SlaSchema>;

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  specialty: z.array(z.enum(CATEGORIES)).default([]),
  languages: z.array(z.enum(LANGUAGES)).default(["en"]),
  active: z.boolean().default(true),
});
export type Agent = z.infer<typeof AgentSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  at: z.string().datetime(),
  from: z.enum(["customer", "agent"]),
  body: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const TicketSchema = z.object({
  id: z.string(),
  number: z.string(),
  messageId: z.string(),
  receivedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  channel: z.enum(CHANNELS),
  fromName: z.string(),
  fromEmail: z.string().email(),
  subject: z.string(),
  body: z.string(),
  language: z.enum(LANGUAGES),
  classification: ClassificationSchema,
  sla: SlaSchema,
  status: z.enum(STATUSES),
  assigneeId: z.string().nullable(),
  draftReply: z.string(),
  draftReplyEngine: z.enum(ENGINES),
  thread: z.array(MessageSchema).default([]),
  priorityLocked: z.boolean().default(false),
});
export type Ticket = z.infer<typeof TicketSchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  at: z.string().datetime(),
  ticketId: z.string(),
  actor: z.string(),
  action: z.string(),
  detail: z.string().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const StoreSchema = z.object({
  version: z.number(),
  seededAt: z.string().datetime(),
  org: z.string(),
  agents: z.array(AgentSchema),
  tickets: z.array(TicketSchema),
  audit: z.array(AuditEventSchema),
  counters: z.object({
    nextNumber: z.number(),
    roundRobin: z.number(),
  }),
});
export type Store = z.infer<typeof StoreSchema>;

export interface InboundMessage {
  messageId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  channel?: Channel;
  receivedAt?: string;
}

export const CATEGORY_TEAMS: Record<Category, string> = {
  billing: "Billing & Finance",
  technical: "Technical Support",
  account: "Account & Security",
  refund: "Billing & Finance",
  product: "Product & Sales",
  request: "Product & Sales",
  general: "Frontline Support",
};