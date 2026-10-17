import { z } from "zod";

/** Authenticated operator accounts for the support console. */

export const ROLES = ["admin", "agent"] as const;
export type Role = (typeof ROLES)[number];

export const UserRecordSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(ROLES).default("agent"),
  passwordHash: z.string(),
  createdAt: z.string().datetime(),
});
export type UserRecord = z.infer<typeof UserRecordSchema>;

/** The subset safe to expose to the client (never includes the password hash). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export function toAuthUser(user: UserRecord): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
