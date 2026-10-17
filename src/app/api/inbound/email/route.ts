import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeInbound } from "@/application/ingest/parse-inbound";
import { ingestTicket } from "@/application/ingest/ingest-ticket";
import { getEnv } from "@/infrastructure/config/env";
import { log } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Inbound email webhook. Point a provider's inbound route (Resend, Mailgun,
 * SendGrid, …) at this endpoint and each delivered message is auto-triaged.
 *
 * Auth is a shared secret in the `x-triagely-signature` header (or
 * `Authorization: Bearer <secret>`). Set INBOUND_WEBHOOK_SECRET to enable it.
 */

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function authorized(request: NextRequest): boolean {
  const secret = getEnv().INBOUND_WEBHOOK_SECRET;
  if (!secret) return true;

  const header = request.headers.get("x-triagely-signature");
  if (header && constantTimeEqual(header, secret)) return true;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(bearer && constantTimeEqual(bearer, secret));
}

async function readPayload(request: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return (await request.json()) as Record<string, unknown>;
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(await request.text());
      return Object.fromEntries(params.entries());
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Invalid or missing webhook signature" }, { status: 401 });
  }

  const payload = await readPayload(request);
  if (!payload) {
    return NextResponse.json({ error: "Unsupported or invalid body" }, { status: 400 });
  }

  const message = normalizeInbound(payload);
  if (!message) {
    return NextResponse.json({ error: "Could not parse an email from the payload" }, { status: 400 });
  }

  try {
    const result = await ingestTicket(message);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 202 });
  } catch (error) {
    log.error(`Inbound ingest failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
