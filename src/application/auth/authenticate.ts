import { verifyPassword } from "@/infrastructure/auth/password";
import { ensureAdminUser, findUserByEmail } from "@/infrastructure/auth/user-store";
import { toAuthUser, type AuthUser } from "@/infrastructure/auth/types";

/** Credential check for the support console. */

export class AuthError extends Error {
  readonly code: string;
  constructor(message: string, code = "invalid_credentials") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export async function authenticate(email: string, password: string): Promise<AuthUser> {
  if (!email || !password) throw new AuthError("Email and password are required", "missing_fields");

  await ensureAdminUser();

  const user = await findUserByEmail(email);
  if (!user) throw new AuthError("Invalid email or password");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new AuthError("Invalid email or password");

  return toAuthUser(user);
}
