import { describe, expect, it } from "vitest";
import { normalizeInbound, parseAddress } from "./parse-inbound";

describe("parseAddress", () => {
  it("parses a display name and angle-addr", () => {
    expect(parseAddress('"Jane Doe" <jane@company.com>')).toEqual({
      name: "Jane Doe",
      email: "jane@company.com",
    });
  });

  it("parses a bare address", () => {
    expect(parseAddress("jane@company.com")).toEqual({
      name: "jane",
      email: "jane@company.com",
    });
  });

  it("derives a name from angle-addr without a display name", () => {
    expect(parseAddress("<ops@example.io>")).toEqual({ name: "ops", email: "ops@example.io" });
  });

  it("rejects non-addresses", () => {
    expect(parseAddress(undefined)).toBeNull();
    expect(parseAddress("not an email")).toBeNull();
  });
});

describe("normalizeInbound", () => {
  it("normalises a generic webhook payload", () => {
    const message = normalizeInbound({
      messageId: "msg-1",
      from: '"Jane Doe" <jane@company.com>',
      subject: "Cannot log in",
      body: "Please help me reset my password.",
      channel: "email",
    });
    expect(message).toMatchObject({
      messageId: "msg-1",
      fromName: "Jane Doe",
      fromEmail: "jane@company.com",
      subject: "Cannot log in",
      body: "Please help me reset my password.",
      channel: "email",
    });
  });

  it("normalises a Resend email.received event envelope", () => {
    const message = normalizeInbound({
      type: "email.received",
      data: {
        email_id: "resend-123",
        from: "Dmitri <dmitri@northwind.io>",
        subject: "URGENT: checkout down",
        text: "Our checkout is returning 500s for everyone.",
      },
    });
    expect(message?.messageId).toBe("resend-123");
    expect(message?.fromName).toBe("Dmitri");
    expect(message?.fromEmail).toBe("dmitri@northwind.io");
  });

  it("normalises Mailgun-style form fields and strips HTML", () => {
    const message = normalizeInbound({
      from: "Emma <emma@brightrete.com>",
      subject: "Double charge",
      "body-plain": "I was charged twice.",
      "Message-Id": "mg-42",
    });
    expect(message?.messageId).toBe("mg-42");
    expect(message?.body).toBe("I was charged twice.");
  });

  it("falls back to stripped html when no text part exists", () => {
    const message = normalizeInbound({
      from: "sam@example.com",
      subject: "Hi",
      html: "<p>Hello <b>there</b></p><br/>Second line",
    });
    expect(message?.body).toContain("Hello");
    expect(message?.body).toContain("Second line");
    expect(message?.body).not.toContain("<");
  });

  it("returns null when there is no usable sender or body", () => {
    expect(normalizeInbound({ from: "not-an-email", body: "hi" })).toBeNull();
    expect(normalizeInbound({ from: "a@b.com", subject: "x" })).toBeNull();
  });
});
