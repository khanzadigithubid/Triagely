import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CATEGORIES, STATUSES } from "@/domain/ticket/schemas";
import { listTickets } from "@/application/tickets/queries";
import { ingestTicket } from "@/application/ingest/ingest-ticket";
import { getSession } from "@/infrastructure/auth/session";
import { log } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Inbound = z.object({
  messageId: z.string().min(1).optional(),
  fromName: z.string().min(1).max(200),
  fromEmail: z.string().email(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20_000),
  channel: z.enum(["email", "web", "api", "slack"]).optional(),
  receivedAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const category = params.get("category");
  const priority = params.get("priority");
  const q = params.get("q")?.toLowerCase();

  let tickets = await listTickets();

  if (status && (STATUSES as readonly string[]).includes(status)) {
    tickets = tickets.filter((t) => t.status === status);
  }
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    tickets = tickets.filter((t) => t.classification.category === category);
  }
  if (priority) {
    tickets = tickets.filter((t) => t.classification.priority === priority);
  }
  if (q) {
    tickets = tickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.fromName.toLowerCase().includes(q) ||
        t.fromEmail.toLowerCase().includes(q),
    );
  }

  return NextResponse.json({ count: tickets.length, tickets });
}

/** Webhook-style ingest endpoint: POST a raw inbound message to auto-triage it. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Inbound.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid inbound message", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const messageId =
    parsed.data.messageId ?? `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const result = await ingestTicket({ ...parsed.data, messageId });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    log.error(`Ingest failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}