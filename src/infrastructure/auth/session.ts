import { cookies } from "next/headers";
import { getEnv } from "@/infrastructure/config/env";
import type { AuthUser } from "@/infrastructure/auth/types";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "@/infrastructure/auth/token";

/**
 * Request-context session helpers. Reads the signed cookie during render and
 * writes/deletes it in Route Handlers. The signing logic lives in `token.ts`.
 */

export { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, verifySessionToken };

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function getSession(): Promise<AuthUser | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(user: AuthUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function requireSession(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) throw new UnauthorizedError();
  return user;
}
