import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/infrastructure/config/env";
import { log } from "@/infrastructure/observability/logger";
import type { AuthUser } from "@/infrastructure/auth/types";

/**
 * Pure session-token signing and verification (no request context, no
 * `next/headers`), so it can be unit tested in isolation. A token is a
 * base64url JSON payload plus an HMAC-SHA256 signature.
 */

export const SESSION_COOKIE = "triagely_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

interface TokenPayload {
  uid: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  exp: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function sessionSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (getEnv().NODE_ENV === "production") {
    log.warn(
      "AUTH_SECRET is not set; sessions are signed with the insecure dev default. Set AUTH_SECRET in production.",
    );
  }
  return "triagely-insecure-development-secret";
}

export function createSessionToken(user: AuthUser, nowMs: number = Date.now()): string {
  const payload: TokenPayload = {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, sessionSecret())}`;
}

export function verifySessionToken(
  token: string | undefined,
  nowMs: number = Date.now(),
): AuthUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, sessionSecret());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<TokenPayload>;
    if (!data.uid || !data.email || !data.exp) return null;
    if (data.exp * 1000 < nowMs) return null;
    return {
      id: data.uid,
      email: data.email,
      name: data.name ?? data.email,
      role: data.role ?? "agent",
    };
  } catch {
    return null;
  }
}
