import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./token";
import type { AuthUser } from "./types";

const USER: AuthUser = { id: "usr_1", email: "admin@triagely.app", name: "Admin", role: "admin" };

describe("session tokens", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-value";
  });

  it("round-trips a user", () => {
    const token = createSessionToken(USER);
    expect(verifySessionToken(token)).toEqual(USER);
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken(USER);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ uid: "usr_1", email: "evil@x.com", name: "Evil", role: "admin", exp: 9_999_999_999 }),
    ).toString("base64url");
    expect(verifySessionToken(`${forged}.${signature}`)).toBeNull();
    expect(verifySessionToken(`${payload}.deadbeef`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(USER);
    process.env.AUTH_SECRET = "other-secret";
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(USER, 1_000_000);
    expect(verifySessionToken(token, 9_999_999_999)).toBeNull();
  });

  it("rejects empty or malformed tokens", () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
  });
});
