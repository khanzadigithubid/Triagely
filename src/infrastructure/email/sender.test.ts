import { beforeEach, describe, expect, it } from "vitest";
import { emailFrom, emailMode, sendEmail } from "./sender";

describe("email sender", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("defaults to dry-run without an API key", () => {
    expect(emailMode()).toBe("dry-run");
    expect(emailFrom()).toContain("@");
  });

  it("does not deliver in dry-run mode", async () => {
    const result = await sendEmail({ to: "customer@example.com", subject: "Re: Hi", body: "Hello" });
    expect(result).toEqual({ delivered: false, mode: "dry-run" });
  });
});
