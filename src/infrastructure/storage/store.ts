import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { StoreSchema, type Store } from "@/domain/ticket/schemas";
import { buildSeedStore } from "@/infrastructure/storage/seed";
import { log } from "@/infrastructure/observability/logger";
import { ensureSchema, getDb, isDatabaseEnabled } from "@/infrastructure/storage/db";

/**
 * Durable store for the single-document aggregate (agents, tickets, audit trail,
 * counters).
 *
 * Backends, chosen at runtime:
 *  - Postgres when `DATABASE_URL` is set — durable across redeploys and shared
 *    across serverless instances. Mutations run inside a `for update` row lock so
 *    concurrent writers cannot clobber each other.
 *  - A JSON file under `./data` otherwise (local development).
 *  - If that file is not writable (e.g. a read-only serverless FS with no DB
 *    configured) the store degrades to in-memory instead of throwing.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const ROW_ID = "default";

let cache: Store | null = null;
let persistenceDisabled = false;

/* ---------- File backend ---------- */

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readFromDisk(): Store {
  const raw = readFileSync(STORE_PATH, "utf8");
  return StoreSchema.parse(JSON.parse(raw));
}

function writeAtomic(store: Store): void {
  if (persistenceDisabled) return;
  try {
    ensureDataDir();
    const payload = JSON.stringify(store, null, 2);
    const tmp = `${STORE_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, payload, "utf8");
    writeFileSync(STORE_PATH, payload, "utf8");
  } catch (error) {
    persistenceDisabled = true;
    log.warn(
      `File store disabled (not writable at ${DATA_DIR}); running in memory: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/* ---------- Postgres backend ---------- */

/** jsonb may arrive as a parsed object or a JSON string depending on the driver. */
function parseStoreData(data: unknown): Store {
  return StoreSchema.parse(typeof data === "string" ? JSON.parse(data) : data);
}

async function dbLoad(): Promise<Store | null> {
  const rows = await getDb()<{ data: unknown }[]>`
    select data from triagely_store where id = ${ROW_ID}
  `;
  return rows.length > 0 ? parseStoreData(rows[0].data) : null;
}

async function dbSave(store: Store): Promise<void> {
  const payload = JSON.stringify(store);
  await getDb()`
    insert into triagely_store (id, data, updated_at)
    values (${ROW_ID}, ${payload}::jsonb, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()
  `;
}

/* ---------- Public API ---------- */

export type StoreBackend = "postgres" | "file" | "memory";

export function storeBackend(): StoreBackend {
  if (isDatabaseEnabled()) return "postgres";
  return persistenceDisabled ? "memory" : "file";
}

export async function getStore(): Promise<Store> {
  if (isDatabaseEnabled()) {
    await ensureSchema();
    const existing = await dbLoad();
    if (existing) return existing;

    const seeded = buildSeedStore();
    await dbSave(seeded);
    log.info(`Seeded ${seeded.tickets.length} tickets into Postgres`);
    return seeded;
  }

  if (cache) return cache;

  if (!existsSync(STORE_PATH)) {
    const seeded = buildSeedStore();
    writeAtomic(seeded);
    cache = seeded;
    log.info(`Seeded ${seeded.tickets.length} tickets into ${STORE_PATH}`);
    return seeded;
  }

  cache = readFromDisk();
  return cache;
}

export async function saveStore(store: Store): Promise<Store> {
  const validated = StoreSchema.parse(store);

  if (isDatabaseEnabled()) {
    await ensureSchema();
    await dbSave(validated);
    return validated;
  }

  writeAtomic(validated);
  cache = validated;
  return validated;
}

/**
 * Read-mutate-write in one call. The callback mutates the draft in place and
 * may return a value that is passed back to the caller. On Postgres the row is
 * locked for the duration so concurrent mutations serialise.
 */
export async function mutateStore<T>(fn: (store: Store) => T): Promise<T> {
  if (isDatabaseEnabled()) {
    await ensureSchema();
    let output!: T;
    await getDb().begin(async (tx) => {
      const rows = await tx<{ data: unknown }[]>`
        select data from triagely_store where id = ${ROW_ID} for update
      `;
      const store: Store = rows.length > 0 ? parseStoreData(rows[0].data) : buildSeedStore();
      output = fn(store);
      const payload = JSON.stringify(StoreSchema.parse(store));
      await tx`
        insert into triagely_store (id, data, updated_at)
        values (${ROW_ID}, ${payload}::jsonb, now())
        on conflict (id) do update set data = excluded.data, updated_at = now()
      `;
    });
    return output;
  }

  const store = structuredClone(await getStore());
  const result = fn(store);
  await saveStore(store);
  return result;
}

/** Drop the in-memory cache (used by tests and the reset script). No-op on Postgres. */
export function invalidateStoreCache(): void {
  cache = null;
}

export function storePath(): string {
  return isDatabaseEnabled() ? "postgres:triagely_store#default" : STORE_PATH;
}
