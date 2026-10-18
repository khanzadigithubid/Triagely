import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ROLES } from "@/infrastructure/auth/types";
import { getSession } from "@/infrastructure/auth/session";
import { createApiKey, listApiKeys } from "@/infrastructure/auth/api-keys";
import { log } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin-only key management. Requires a signed-in operator session. */

const Create = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(ROLES).optional(),
});

export async function GET(): Promise<NextResponse> {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  return NextResponse.json({ keys: await listApiKeys() });
}

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

  const parsed = Create.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "A name is required", issues: parsed.error.issues }, { status: 400 });
  }

  const created = await createApiKey(parsed.data);
  log.info(`Created API key "${created.key.name}" (${created.key.prefix})`);
  return NextResponse.json(created, { status: 201 });
}
