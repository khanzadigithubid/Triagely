import postgres, { type Sql } from "postgres";
import { log } from "@/infrastructure/observability/logger";

/**
 * Postgres connection for the durable store.
 *
 * One lazy singleton per server instance. `prepare: false` keeps it compatible
 * with transaction-pooling proxies (Neon, Supabase, pgBouncer), which cannot
 * reuse prepared statements across pooled connections.
 */

let client: Sql | null = null;
let schemaReady: Promise<void> | null = null;

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function isDatabaseEnabled(): boolean {
  return databaseUrl() !== null;
}

export function getDb(): Sql {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");

  if (!client) {
    client = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return client;
}

const SCHEMA_SQL = `
  create table if not exists triagely_store (
    id text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
  )
`;

/** Create the single-row table on first use. Cached so it runs once per instance. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getDb()
      .unsafe(SCHEMA_SQL)
      .then(() => {
        log.info("Postgres store schema ready");
      })
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

/** Close the pooled connection (used by tests and scripts). */
export async function closeDb(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  schemaReady = null;
  await current.end({ timeout: 5 });
}
