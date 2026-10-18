import { NextResponse } from "next/server";
import { getSession } from "@/infrastructure/auth/session";
import { revokeApiKey } from "@/infrastructure/auth/api-keys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  const revoked = await revokeApiKey(id);
  if (!revoked) return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
