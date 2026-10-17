import { NextResponse } from "next/server";
import { getSession } from "@/infrastructure/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const user = await getSession();
  return NextResponse.json(
    { user },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
