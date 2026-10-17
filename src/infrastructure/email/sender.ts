import { getEnv } from "@/infrastructure/config/env";
import { log } from "@/infrastructure/observability/logger";

/**
 * Outbound email delivery.
 *
 * Uses Resend's HTTP API when `RESEND_API_KEY` is set (free tier works). With no
 * key configured it runs in "dry-run" mode: the message is logged and recorded
 * in the audit trail but nothing is sent, so the app stays fully usable without
 * a mail account. Swap in another provider by editing `deliver`.
 */

export interface OutboundEmail {
  to: string;
  toName?: string;
  subject: string;
  body: string;
}

export type EmailMode = "resend" | "dry-run";

export interface SendResult {
  delivered: boolean;
  mode: EmailMode;
  providerId?: string;
  error?: string;
}

export function emailMode(): EmailMode {
  return getEnv().RESEND_API_KEY ? "resend" : "dry-run";
}

export function emailFrom(): string {
  const env = getEnv();
  return env.EMAIL_FROM;
}

function formatRecipient(email: OutboundEmail): string {
  return email.toName ? `${email.toName} <${email.to}>` : email.to;
}

export async function sendEmail(email: OutboundEmail): Promise<SendResult> {
  const env = getEnv();
  const mode = emailMode();

  if (!env.RESEND_API_KEY) {
    log.info(
      `[dry-run email] to=${email.to} subject="${email.subject}" (set RESEND_API_KEY to deliver)`,
    );
    return { delivered: false, mode: "dry-run" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [formatRecipient(email)],
        subject: email.subject,
        text: email.body,
        ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const message = `Resend responded ${response.status}: ${detail.slice(0, 200)}`;
      log.warn(`Email delivery failed: ${message}`);
      return { delivered: false, mode, error: message };
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    log.info(`Email delivered to ${email.to} via Resend (${data.id ?? "no-id"})`);
    return { delivered: true, mode, providerId: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Email delivery error: ${message}`);
    return { delivered: false, mode, error: message };
  }
}

export function inboundWebhookConfigured(): boolean {
  return Boolean(getEnv().INBOUND_WEBHOOK_SECRET);
}
