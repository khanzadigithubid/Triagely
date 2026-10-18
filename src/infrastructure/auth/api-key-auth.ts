import type { NextRequest } from "next/server";
import { verifyApiKey } from "@/infrastructure/auth/api-keys";
import type { Role } from "@/infrastructure/auth/types";

/** The caller identity behind a valid API key. */
export interface ApiPrincipal {
  keyId: string;
  name: string;
  role: Role;
}

/**
 * Authenticate a machine caller from `x-api-key` or `Authorization: Bearer`.
 * Returns null when the header is missing or the key is invalid/revoked.
 */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiPrincipal | null> {
  const header =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header) return null;

  const record = await verifyApiKey(header);
  if (!record) return null;
  return { keyId: record.id, name: record.name, role: record.role };
}
