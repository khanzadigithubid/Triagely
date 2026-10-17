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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Patch = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("reassign"), agentId: z.string().nullable() }),
  z.object({ action: z.literal("priority"), priority: z.enum(PRIORITIES) }),
  z.object({ action: z.literal("regenerate_draft") }),
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const ticket = getTicketById(id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Patch.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid action", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const data = parsed.data;
    const ticket =
      data.action === "resolve"
        ? resolveTicket(id)
        : data.action === "reopen"
          ? reopenTicket(id)
          : data.action === "reassign"
            ? reassignTicket(id, data.agentId)
            : data.action === "priority"
              ? setPriority(id, data.priority)
              : await regenerateDraft(id);

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