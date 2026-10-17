import type { InboundMessage } from "@/domain/ticket/schemas";

/**
 * Normalise an inbound email webhook payload into the pipeline's `InboundMessage`.
 *
 * Pure and provider-tolerant: understands the generic webhook fields, form-style
 * payloads (Mailgun/SendGrid) and Resend's `email.received` event envelope. The
 * webhook route stays thin; all parsing is unit-tested here.
 */

type Rec = Record<string, unknown>;

function str(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

function record(value: unknown): Rec | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : undefined;
}

/** Parse `"Jane Doe" <jane@x.com>` or `jane@x.com` into a name + email pair. */
export function parseAddress(input: string | undefined): { name: string; email: string } | null {
  if (!input) return null;
  const angle = input.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (angle) {
    const email = angle[2].trim().toLowerCase();
    if (!email.includes("@")) return null;
    const name = angle[1].trim();
    return { name: name || email.split("@")[0], email };
  }
  const bare = input.trim().toLowerCase();
  if (!bare.includes("@")) return null;
  return { name: bare.split("@")[0], email: bare };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeInbound(payload: Rec): InboundMessage | null {
  const event = record(payload.data) ?? payload;

  const fromRaw =
    str(event.from) ??
    str(event.sender) ??
    str(event.fromEmail) ??
    str(event.from_email) ??
    str(payload.from);
  const parsed = parseAddress(fromRaw);
  if (!parsed) return null;

  const fromName = str(event.fromName) ?? str(event.from_name) ?? parsed.name;
  const fromEmail = str(event.fromEmail) ?? str(event.from_email) ?? parsed.email;

  const subject = str(event.subject) ?? str(event.Subject) ?? "(no subject)";

  const body =
    str(event.text) ??
    str(event.body) ??
    str(event["body-plain"]) ??
    str(event.body_plain) ??
    str(event["stripped-text"]) ??
    (str(event.html) ? stripHtml(str(event.html)!) : undefined) ??
    "";
  if (!body) return null;

  const messageId =
    str(event.messageId) ??
    str(event["message-id"]) ??
    str(event["Message-Id"]) ??
    str(event.email_id) ??
    str(event.id);

  return {
    messageId: messageId ?? `inbound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromName,
    fromEmail,
    subject,
    body,
    channel: "email",
  };
}
