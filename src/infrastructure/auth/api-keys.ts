import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb, isDatabaseEnabled } from "@/infrastructure/storage/db";
import { log } from "@/infrastructure/observability/logger";
import type { Role } from "@/infrastructure/auth/types";

/**
 * Machine-to-machine API keys for the public `/api/v1` surface.
 *
 * Only a SHA-256 hash of the secret is stored — the full key is shown once, at
 * creation. Keys look like `tgk_<prefix>_<secret>`; the prefix is indexed so
 * verification is a single lookup plus a constant-time compare.
 *
 * Backed by Postgres when `DATABASE_URL` is set, otherwise a JSON file.
 */

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  keyHash: string;
  role: Role;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Safe projection for admin listings — never includes the hash. */
export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  role: Role;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface CreatedApiKey {
  key: ApiKeyView;
  /** The full secret. Returned exactly once and never stored in plaintext. */
  secret: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const KEYS_PATH = path.join(DATA_DIR, "api-keys.json");

let fileCache: ApiKeyRecord[] | null = null;
let persistenceDisabled = false;

const KEYS_SCHEMA_SQL = `
  create table if not exists triagely_api_keys (
    id text primary key,
    name text not null,
    prefix text not null,
    key_hash text not null,
    role text not null default 'agent',
    created_at timestamptz not null default now(),
    last_used_at timestamptz,
    revoked_at timestamptz
  )
`;

function hashKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12) ?? Math.random().toString(36).slice(2, 14);
}

export function toApiKeyView(record: ApiKeyRecord): ApiKeyView {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    role: record.role,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revoked: record.revokedAt !== null,
  };
}

/* ---------- Postgres backend ---------- */

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  key_hash: string;
  role: string;
  created_at: Date | string;
  last_used_at: Date | string | null;
  revoked_at: Date | string | null;
}

function iso(value: Date | string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function rowToRecord(row: KeyRow): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    keyHash: row.key_hash,
    role: row.role as Role,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: iso(row.last_used_at),
    revokedAt: iso(row.revoked_at),
  };
}

export function ensureApiKeysSchema(): Promise<void> {
  return getDb().unsafe(KEYS_SCHEMA_SQL).then(() => undefined);
}

/* ---------- File backend ---------- */

function readKeysFile(): ApiKeyRecord[] {
  if (fileCache) return fileCache;
  if (!existsSync(KEYS_PATH)) {
    fileCache = [];
    return fileCache;
  }
  const parsed = JSON.parse(readFileSync(KEYS_PATH, "utf8")) as unknown;
  fileCache = Array.isArray(parsed) ? (parsed as ApiKeyRecord[]) : [];
  return fileCache;
}

function writeKeysFile(records: ApiKeyRecord[]): void {
  if (persistenceDisabled) {
    fileCache = records;
    return;
  }
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(KEYS_PATH, JSON.stringify(records, null, 2), "utf8");
    fileCache = records;
  } catch (error) {
    persistenceDisabled = true;
    fileCache = records;
    log.warn(
      `API key store disabled (not writable at ${DATA_DIR}); running in memory: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/* ---------- Public API ---------- */

export async function listApiKeys(): Promise<ApiKeyView[]> {
  if (isDatabaseEnabled()) {
    await ensureApiKeysSchema();
    const rows = await getDb()<KeyRow[]>`select * from triagely_api_keys order by created_at desc`;
    return rows.map((row) => toApiKeyView(rowToRecord(row)));
  }
  return readKeysFile()
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map(toApiKeyView);
}

export interface CreateApiKeyInput {
  name: string;
  role?: Role;
}

export async function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  const prefix = randomBytes(6).toString("hex");
  const secretPart = randomBytes(24).toString("hex");
  const secret = `tgk_${prefix}_${secretPart}`;
  const record: ApiKeyRecord = {
    id: `key_${newId()}`,
    name: input.name.trim() || "default",
    prefix,
    keyHash: hashKey(secret),
    role: input.role ?? "agent",
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };

  if (isDatabaseEnabled()) {
    await ensureApiKeysSchema();
    await getDb()`
      insert into triagely_api_keys (id, name, prefix, key_hash, role)
      values (${record.id}, ${record.name}, ${record.prefix}, ${record.keyHash}, ${record.role})
    `;
  } else {
    writeKeysFile([...readKeysFile(), record]);
  }

  return { key: toApiKeyView(record), secret };
}

/**
 * Resolve a presented secret to its key record, or null if invalid/revoked.
 *
 * An `API_BOOTSTRAP_KEY` env value is also accepted (as an admin key) so a key
 * can be provisioned straight from the host's environment without a DB write.
 */
export async function verifyApiKey(secret: string): Promise<ApiKeyRecord | null> {
  const trimmed = secret.trim();

  const bootstrap = process.env.API_BOOTSTRAP_KEY?.trim();
  if (bootstrap && trimmed.length === bootstrap.length && timingSafeEqual(Buffer.from(trimmed), Buffer.from(bootstrap))) {
    return {
      id: "env-bootstrap",
      name: "env-bootstrap",
      prefix: "env",
      keyHash: "",
      role: "admin",
      createdAt: new Date(0).toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };
  }

  const parts = trimmed.split("_");
  if (parts.length !== 3 || parts[0] !== "tgk") return null;
  const prefix = parts[1];

  let record: ApiKeyRecord | null = null;
  if (isDatabaseEnabled()) {
    await ensureApiKeysSchema();
    const rows = await getDb()<KeyRow[]>`
      select * from triagely_api_keys where prefix = ${prefix} and revoked_at is null limit 1
    `;
    record = rows.length > 0 ? rowToRecord(rows[0]) : null;
  } else {
    record = readKeysFile().find((k) => k.prefix === prefix && k.revokedAt === null) ?? null;
  }
  if (!record) return null;

  const presented = Buffer.from(hashKey(trimmed));
  const expected = Buffer.from(record.keyHash);
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return null;

  await touchApiKey(record.id);
  return record;
}

export async function touchApiKey(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (isDatabaseEnabled()) {
    await getDb()`update triagely_api_keys set last_used_at = now() where id = ${id}`;
    return;
  }
  const records = readKeysFile();
  const index = records.findIndex((k) => k.id === id);
  if (index >= 0) {
    records[index] = { ...records[index], lastUsedAt: now };
    writeKeysFile(records);
  }
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  if (isDatabaseEnabled()) {
    await ensureApiKeysSchema();
    const rows = await getDb()`
      update triagely_api_keys set revoked_at = now() where id = ${id} and revoked_at is null returning id
    `;
    return rows.length > 0;
  }
  const records = readKeysFile();
  const index = records.findIndex((k) => k.id === id && k.revokedAt === null);
  if (index < 0) return false;
  records[index] = { ...records[index], revokedAt: now };
  writeKeysFile(records);
  return true;
}

/** Test/reset helper. */
export function invalidateApiKeyCache(): void {
  fileCache = null;
}
