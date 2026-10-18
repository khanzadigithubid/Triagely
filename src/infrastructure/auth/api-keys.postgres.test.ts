import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

/**
 * Integration test for API keys against a real Postgres engine (PGlite over the
 * wire protocol): minting (secret shown once, only the hash stored),
 * verification, last-used tracking and revocation.
 */

const PORT = 55435;
const CONNECTION = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

let db: PGlite;
let server: PGLiteSocketServer;

describe("api keys (postgres backend)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.waitReady;
    server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 2 });
    await server.start();
    process.env.DATABASE_URL = CONNECTION;
    delete process.env.API_BOOTSTRAP_KEY;
  }, 60_000);

  afterAll(async () => {
    const { closeDb } = await import("@/infrastructure/storage/db");
    await closeDb();
    await server.stop();
    await db.close();
    delete process.env.DATABASE_URL;
  });

  it("mints, verifies and revokes a key", async () => {
    const { createApiKey, verifyApiKey, revokeApiKey, listApiKeys } = await import(
      "@/infrastructure/auth/api-keys"
    );

    const created = await createApiKey({ name: "Zapier", role: "agent" });
    expect(created.secret.startsWith("tgk_")).toBe(true);
    expect(created.key.revoked).toBe(false);

    const verified = await verifyApiKey(created.secret);
    expect(verified?.id).toBe(created.key.id);
    expect(verified?.role).toBe("agent");

    expect(await verifyApiKey(created.secret.replace(/[a-f0-9]{4}$/, "dead"))).toBeNull();

    const listed = await listApiKeys();
    expect(listed.some((k) => k.id === created.key.id && k.lastUsedAt !== null)).toBe(true);

    expect(await revokeApiKey(created.key.id)).toBe(true);
    expect(await revokeApiKey(created.key.id)).toBe(false);
    expect(await verifyApiKey(created.secret)).toBeNull();
  }, 60_000);
});
