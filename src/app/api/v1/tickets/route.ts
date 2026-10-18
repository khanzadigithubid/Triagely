import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { filterTickets, getTicketById, listTickets } from "@/application/tickets/queries";
import { ingestTicket } from "@/application/ingest/ingest-ticket";
import { authenticateApiRequest } from "@/infrastructure/auth/api-key-auth";
import { log } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public API v1 — machine-to-machine access authenticated with an API key. */

const MAX_LIMIT = 200;

const Inbound = z.object({
  messageId: z.string().min(1).optional(),
  fromName: z.string().min(1).max(200),
  fromEmail: z.string().email(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20_000),
  channel: z.enum(["email", "web", "api", "slack"]).optional(),
  receivedAt: z.string().datetime().optional(),
});

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await authenticateApiRequest(request))) return unauthorized();

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "50", 10) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number.parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const all = filterTickets(await listTickets(), {
    status: params.get("status"),
    category: params.get("category"),
    priority: params.get("priority"),
    q: params.get("q"),
  });

  return NextResponse.json({
    count: all.length,
    limit,
    offset,
    tickets: all.slice(offset, offset + limit),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await authenticateApiRequest(request))) return unauthorized();

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
    const result = await ingestTicket({ ...parsed.data, channel: parsed.data.channel ?? "api", messageId });
    const ticket = await getTicketById(result.ticketId);
    return NextResponse.json({ ...result, ticket }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    log.error(`v1 ingest failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
