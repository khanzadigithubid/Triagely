import type { Category, Priority, Sentiment } from "@/domain/ticket/schemas";

/**
 * Template draft replies.
 *
 * These are first-responses the agent can send or edit. Greentext is injected
 * at render time by the caller (agent name, org), so this module stays pure.
 */

export interface DraftContext {
  customerFirstName: string;
  category: Category;
  priority: Priority;
  sentiment: Sentiment;
  agentName: string;
  org: string;
  signature: string;
}

const OPENERS: Record<Sentiment, string> = {
  negative:
    "Sorry to hear about this, {firstName} — that's not the experience we want you to have. I've picked this up personally.",
  neutral:
    "Hi {firstName}, thanks for reaching out. I'll get this sorted for you right away.",
  positive:
    "Hi {firstName}, thanks so much for your message — glad to hear from you!",
};

const BODIES: Record<Category, string> = {
  billing:
    "I'm reviewing the charge on your account now. I'll make sure the billing detail is correct and add any adjustment that's owed, then confirm back here.",
  technical:
    "I'm looking into this now. To narrow it down quickly, could you share your workspace/instance details and a timestamp or error ID if you have one? We'll follow up as soon as we've localized it.",
  account:
    "Your account security is the priority here. I'll verify access and get this resolved for you — if a password reset or security check is needed, I'll walk you through it step by step.",
  refund:
    "I've logged your refund request and started the review. If everything checks out, the amount should be processed on the original payment method shortly — I'll confirm the moment it's approved.",
  product:
    "That's a great question. Let me pull the specifics together for you and reply here with the details and any relevant docs.",
  request:
    "Thanks for getting in touch about this. Our team will prepare the details you asked for and follow up here — usually within a few hours.",
  general:
    "I've got your message and I'm on it. I'll reply here with an update shortly.",
};

const URGENT_LEADS: Record<Category, string> = {
  billing:
    "I've flagged this as urgent and escalated it to our billing team so it's handled first thing.",
  technical:
    "I've escalated this as urgent — our technical team is treating it as an incident and will update you here as we make progress.",
  account:
    "I've escalated this as urgent given the security implications — only the appropriate steps will be taken until we've confirmed it's fully resolved.",
  refund:
    "I've escalated this as urgent — our finance team is reviewing it now and you'll hear back here the moment it's done.",
  product: "I've escalated this for a prompt response from our product team.",
  request: "I've escalated this to the right team and they'll be in touch shortly.",
  general: "I've flagged this as urgent for you.",
};

const CLOSERS: Record<Priority, string> = {
  urgent: "We're treating this as a top priority — watch your inbox for our next update.",
  high: "We'll keep you updated as we go.",
  medium: "You should hear from us within a few hours.",
  low: "We'll be in touch soon.",
};

export function composeTemplateDraft(ctx: DraftContext): string {
  const opener = OPENERS[ctx.sentiment].replace("{firstName}", ctx.customerFirstName);
  const body =
    ctx.priority === "urgent" || ctx.priority === "high"
      ? `${URGENT_LEADS[ctx.category]} ${BODIES[ctx.category]}`
      : BODIES[ctx.category];
  const closer = CLOSERS[ctx.priority];

  return [
    opener,
    "",
    body,
    "",
    closer,
    "",
    `${ctx.signature}`.replace("{agentName}", ctx.agentName).replace("{org}", ctx.org),
  ].join("\n");
}

export function firstNameOf(fromName: string): string {
  return fromName.trim().split(/\s+/)[0] ?? "there";
}