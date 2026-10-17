import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb, isDatabaseEnabled } from "@/infrastructure/storage/db";
import { getEnv } from "@/infrastructure/config/env";
import { log } from "@/infrastructure/observability/logger";
import { hashPassword } from "@/infrastructure/auth/password";
import { UserRecordSchema, type Role, type UserRecord } from "@/infrastructure/auth/types";

/**
 * Operator accounts, backed by Postgres when `DATABASE_URL` is set, otherwise a
 * JSON file under `./data` (falling back to in-memory if the FS is read-only).
 *
 * Passwords are always stored as scrypt hashes — never plaintext.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

let fileCache: UserRecord[] | null = null;
let persistenceDisabled = false;
let adminReady: Promise<void> | null = null;

const USERS_SCHEMA_SQL = `
  create table if not exists triagely_users (
    id text primary key,
    email text not null unique,
    name text not null,
    role text not null default 'agent',
    password_hash text not null,
    created_at timestamptz not null default now()
  )
`;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* ---------- Postgres backend ---------- */

export function ensureUsersSchema(): Promise<void> {
  return getDb().unsafe(USERS_SCHEMA_SQL).then(() => undefined);
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  created_at: Date | string;
}

function rowToRecord(row: UserRow): UserRecord {
  return UserRecordSchema.parse({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at).toISOString(),
  });
}

/* ---------- File backend ---------- */

function readUsersFile(): UserRecord[] {
  if (fileCache) return fileCache;
  if (!existsSync(USERS_PATH)) {
    fileCache = [];
    return fileCache;
  }
  const parsed = JSON.parse(readFileSync(USERS_PATH, "utf8")) as unknown;
  fileCache = Array.isArray(parsed) ? parsed.map((u) => UserRecordSchema.parse(u)) : [];
  return fileCache;
}

function writeUsersFile(users: UserRecord[]): void {
  if (persistenceDisabled) {
    fileCache = users;
    return;
  }
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), "utf8");
    fileCache = users;
  } catch (error) {
    persistenceDisabled = true;
    fileCache = users;
    log.warn(
      `User store disabled (not writable at ${DATA_DIR}); running in memory: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/* ---------- Public API ---------- */

function newId(): string {
  return globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12) ?? Math.random().toString(36).slice(2, 14);
}

export async function countUsers(): Promise<number> {
  if (isDatabaseEnabled()) {
    await ensureUsersSchema();
    const rows = await getDb()<{ count: string }[]>`select count(*)::text as count from triagely_users`;
    return Number.parseInt(rows[0]?.count ?? "0", 10);
  }
  return readUsersFile().length;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const target = normalizeEmail(email);
  if (isDatabaseEnabled()) {
    await ensureUsersSchema();
    const rows = await getDb()<UserRow[]>`select * from triagely_users where email = ${target} limit 1`;
    return rows.length > 0 ? rowToRecord(rows[0]) : null;
  }
  return readUsersFile().find((u) => u.email === target) ?? null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role?: Role;
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim() || email;
  const role: Role = input.role ?? "agent";
  const passwordHash = await hashPassword(input.password);
  const record: UserRecord = {
    id: `usr_${newId()}`,
    email,
    name,
    role,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  if (isDatabaseEnabled()) {
    await ensureUsersSchema();
    await getDb()`
      insert into triagely_users (id, email, name, role, password_hash)
      values (${record.id}, ${record.email}, ${record.name}, ${record.role}, ${record.passwordHash})
    `;
    return record;
  }

  const users = readUsersFile();
  if (users.some((u) => u.email === email)) {
    throw new Error(`A user with email ${email} already exists`);
  }
  writeUsersFile([...users, record]);
  return record;
}

/**
 * Seed a bootstrap admin the first time the console is used, so there is always
 * a way in. Credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD`; without them
 * a documented default is used and logged.
 */
export async function ensureAdminUser(): Promise<void> {
  if (adminReady) return adminReady;

  adminReady = (async () => {
    if ((await countUsers()) > 0) return;

    const env = getEnv();
    const email = env.ADMIN_EMAIL ?? "admin@triagely.app";
    const password = env.ADMIN_PASSWORD ?? "triagely-admin";
    const name = env.ADMIN_NAME;

    await createUser({ email, name, password, role: "admin" });
    log.warn(
      `Seeded bootstrap admin (${email})${env.ADMIN_PASSWORD ? "" : ` with default password "${password}" — set ADMIN_PASSWORD in production`}`,
    );
  })();

  return adminReady;
}

/** Test/reset helper: clear the in-memory cache. */
export function invalidateUserCache(): void {
  fileCache = null;
}
