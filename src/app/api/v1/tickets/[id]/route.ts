import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PRIORITIES } from "@/domain/ticket/schemas";
import { getTicketById } from "@/application/tickets/queries";
import {
  TicketActionError,
  reassignTicket,
  regenerateDraft,
  reopenTicket,
  resolveTicket,
  setPriority,
} from "@/application/tickets/actions";
import { authenticateApiRequest } from "@/infrastructure/auth/api-key-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Patch = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("reassign"), agentId: z.string().nullable() }),
  z.object({ action: z.literal("priority"), priority: z.enum(PRIORITIES) }),
  z.object({ action: z.literal("regenerate_draft") }),
]);

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await authenticateApiRequest(request))) return unauthorized();

  const { id } = await params;
  const ticket = await getTicketById(id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const principal = await authenticateApiRequest(request);
  if (!principal) return unauthorized();

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Patch.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const data = parsed.data;
    const actor = principal.name;
    const ticket = await (data.action === "resolve"
      ? resolveTicket(id, actor)
      : data.action === "reopen"
        ? reopenTicket(id, actor)
        : data.action === "reassign"
          ? reassignTicket(id, data.agentId, actor)
          : data.action === "priority"
            ? setPriority(id, data.priority, actor)
            : regenerateDraft(id, actor));

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof TicketActionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
