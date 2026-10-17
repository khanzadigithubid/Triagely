import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { InboundMessage } from "@/domain/ticket/schemas";

/**
 * Integration test for the Postgres-backed store.
 *
 * Runs a real Postgres engine (PGlite, WASM) behind the actual wire protocol so
 * the production `postgres` client code path — schema bootstrap, seeding,
 * locked read-modify-write, and durability across connections — is exercised
 * exactly as it runs in production.
 */

const PORT = 55432;
const CONNECTION = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

let db: PGlite;
let server: PGLiteSocketServer;

const MESSAGE: InboundMessage = {
  messageId: "pg-test-1",
  fromName: "Ada Tester",
  fromEmail: "ada@example.com",
  subject: "URGENT: charged twice, money gone",
  body: "I was double charged and this is urgent, please fix immediately!",
  channel: "email",
  receivedAt: "2026-01-01T12:00:00.000Z",
};

describe("store (postgres backend)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.waitReady;
    server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 2 });
    await server.start();
    process.env.DATABASE_URL = CONNECTION;
  }, 60_000);

  afterAll(async () => {
    const { closeDb } = await import("@/infrastructure/storage/db");
    await closeDb();
    await server.stop();
    await db.close();
    delete process.env.DATABASE_URL;
  });

  it("seeds, mutates and reads back through the database", async () => {
    const store = await import("@/infrastructure/storage/store");
    const { ingestTicket } = await import("@/application/ingest/ingest-ticket");
    const { resolveTicket, sendReply } = await import("@/application/tickets/actions");
    const { computeAnalytics } = await import("@/application/tickets/queries");

    expect(store.storeBackend()).toBe("postgres");

    const seeded = await store.getStore();
    const baseline = seeded.tickets.length;
    expect(baseline).toBeGreaterThan(0);

    const created = await ingestTicket(MESSAGE);
    expect(created.action).toBe("created");

    const afterIngest = await store.getStore();
    expect(afterIngest.tickets.length).toBe(baseline + 1);
    const ticket = afterIngest.tickets.find((t) => t.id === created.ticketId);
    expect(ticket?.classification.category).toBe("billing");
    expect(ticket?.classification.priority).toBe("high");

    await sendReply(created.ticketId, "Refunding the duplicate now.");
    await resolveTicket(created.ticketId);

    const analytics = await computeAnalytics();
    expect(analytics.totals.all).toBe(baseline + 1);

    // Durability: drop the pooled connection and read again — the row survives.
    const { closeDb } = await import("@/infrastructure/storage/db");
    await closeDb();
    const reloaded = await store.getStore();
    const persisted = reloaded.tickets.find((t) => t.id === created.ticketId);
    expect(persisted?.status).toBe("resolved");
    expect(persisted?.thread).toHaveLength(2);
  }, 60_000);
});
