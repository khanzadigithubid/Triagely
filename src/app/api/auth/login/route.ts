import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticate, AuthError } from "@/application/auth/authenticate";
import { setSessionCookie } from "@/infrastructure/auth/session";
import { log } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Credentials = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Credentials.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email and password are required" }, { status: 400 });
  }

  try {
    const user = await authenticate(parsed.data.email, parsed.data.password);
    await setSessionCookie(user);
    log.info(`Sign-in: ${user.email}`);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
    }
    log.error(`Sign-in error: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "Sign-in failed" }, { status: 500 });
  }
}
