import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

/**
 * Integration test for accounts + sign-in against a real Postgres engine
 * (PGlite over the wire protocol): schema bootstrap, bcrypt-free scrypt
 * hashing, bootstrap-admin seeding and credential verification.
 */

const PORT = 55434;
const CONNECTION = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

let db: PGlite;
let server: PGLiteSocketServer;

describe("auth (postgres backend)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.waitReady;
    server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 2 });
    await server.start();
    process.env.DATABASE_URL = CONNECTION;
    process.env.ADMIN_EMAIL = "boss@triagely.test";
    process.env.ADMIN_PASSWORD = "hunter2-bootstrap";
    process.env.AUTH_SECRET = "integration-secret";
  }, 60_000);

  afterAll(async () => {
    const { closeDb } = await import("@/infrastructure/storage/db");
    await closeDb();
    await server.stop();
    await db.close();
    delete process.env.DATABASE_URL;
  });

  it("seeds a bootstrap admin and authenticates it", async () => {
    const { authenticate, AuthError } = await import("@/application/auth/authenticate");

    const user = await authenticate("boss@triagely.test", "hunter2-bootstrap");
    expect(user.email).toBe("boss@triagely.test");
    expect(user.role).toBe("admin");

    await expect(authenticate("boss@triagely.test", "wrong")).rejects.toBeInstanceOf(AuthError);
    await expect(authenticate("nobody@triagely.test", "hunter2-bootstrap")).rejects.toBeInstanceOf(AuthError);
  }, 60_000);

  it("creates and finds users", async () => {
    const { createUser, findUserByEmail, countUsers } = await import(
      "@/infrastructure/auth/user-store"
    );

    const before = await countUsers();
    const created = await createUser({
      email: "Agent@Triagely.Test",
      name: "Support Agent",
      password: "s3cret-pass",
      role: "agent",
    });
    expect(created.email).toBe("agent@triagely.test");

    const found = await findUserByEmail("AGENT@triagely.test");
    expect(found?.id).toBe(created.id);
    expect(await countUsers()).toBe(before + 1);
  }, 60_000);
});
