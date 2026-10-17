import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { StoreSchema, type Store } from "@/domain/ticket/schemas";
import { buildSeedStore } from "@/infrastructure/storage/seed";
import { log } from "@/infrastructure/observability/logger";

/**
 * File-backed JSON store.
 *
 * The whole dataset (agents, tickets, audit trail, counters) is small enough
 * to hold in memory and persist as a single JSON document. Reads are cached;
 * every mutation rewrites the file atomically-ish (write temp, rename) so a
 * crash mid-write cannot leave a half-written store behind.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

let cache: Store | null = null;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readFromDisk(): Store {
  const raw = readFileSync(STORE_PATH, "utf8");
  return StoreSchema.parse(JSON.parse(raw));
}

export function getStore(): Store {
  if (cache) return cache;

  if (!existsSync(STORE_PATH)) {
    ensureDataDir();
    const seeded = buildSeedStore();
    writeAtomic(seeded);
    cache = seeded;
    log.info(`Seeded ${seeded.tickets.length} tickets into ${STORE_PATH}`);
    return seeded;
  }

  cache = readFromDisk();
  return cache;
}

function writeAtomic(store: Store): void {
  ensureDataDir();
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function saveStore(store: Store): Store {
  const validated = StoreSchema.parse(store);
  writeAtomic(validated);
  cache = validated;
  return validated;
}

/**
 * Read-mutate-write in one call. The callback mutates the draft in place and
 * may return a value that is passed back to the caller.
 */
export function mutateStore<T>(fn: (store: Store) => T): T {
  const store = structuredClone(getStore());
  const result = fn(store);
  saveStore(store);
  return result;
}

/** Drop the in-memory cache (used by tests and the reset script). */
export function invalidateStoreCache(): void {
  cache = null;
}

export function storePath(): string {
  return STORE_PATH;
}