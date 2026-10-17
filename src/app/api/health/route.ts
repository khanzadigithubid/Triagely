import { NextResponse } from "next/server";
import { getEnv } from "@/infrastructure/config/env";
import { getStore, storeBackend } from "@/infrastructure/storage/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Liveness/readiness: confirms the store is readable and reports engine mode. */
export async function GET(): Promise<NextResponse> {
  const env = getEnv();
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const store = await getStore();
    checks.store = { ok: true, detail: `${store.tickets.length} tickets via ${storeBackend()}` };
  } catch (error) {
    checks.store = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const healthy = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      engine: env.LLM_API_KEY ? "hybrid (heuristic + llm)" : "heuristic",
      persistence: storeBackend(),
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}