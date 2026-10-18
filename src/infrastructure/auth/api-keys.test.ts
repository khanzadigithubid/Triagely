import { afterEach, describe, expect, it } from "vitest";
import { verifyApiKey } from "./api-keys";

describe("verifyApiKey (env bootstrap key)", () => {
  afterEach(() => {
    delete process.env.API_BOOTSTRAP_KEY;
  });

  it("accepts the env bootstrap key as an admin principal", async () => {
    process.env.API_BOOTSTRAP_KEY = "tgk_env_bootstrap-secret";
    const record = await verifyApiKey("tgk_env_bootstrap-secret");
    expect(record?.role).toBe("admin");
  });

  it("rejects wrong, malformed or empty keys", async () => {
    process.env.API_BOOTSTRAP_KEY = "tgk_env_bootstrap-secret";
    expect(await verifyApiKey("tgk_env_other")).toBeNull();
    expect(await verifyApiKey("nonsense")).toBeNull();
    expect(await verifyApiKey("")).toBeNull();
  });

  it("rejects any key when no environment is configured", async () => {
    delete process.env.API_BOOTSTRAP_KEY;
    expect(await verifyApiKey("tgk_abc_123")).toBeNull();
  });
});
