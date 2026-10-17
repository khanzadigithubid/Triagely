import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/infrastructure/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
