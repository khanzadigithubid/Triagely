import { NextResponse, type NextRequest } from "next/server";
import { computeAnalytics } from "@/application/tickets/queries";
import { authenticateApiRequest } from "@/infrastructure/auth/api-key-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await authenticateApiRequest(request))) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  return NextResponse.json({ analytics: await computeAnalytics() });
}
