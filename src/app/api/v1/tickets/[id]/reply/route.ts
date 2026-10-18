import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendReply, TicketActionError } from "@/application/tickets/actions";
import { authenticateApiRequest } from "@/infrastructure/auth/api-key-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ body: z.string().min(1).max(20_000) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const principal = await authenticateApiRequest(request);
  if (!principal) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "A reply body is required" }, { status: 400 });
  }

  try {
    const ticket = await sendReply(id, parsed.data.body, principal.name);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    if (error instanceof TicketActionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    return NextResponse.json({ error: "Reply failed" }, { status: 500 });
  }
}
