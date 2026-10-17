import { describe, expect, it } from "vitest";
import { classifyCategory } from "./classifier";
import { detectLanguage } from "./text";

describe("classifyCategory", () => {
  it("classifies a billing charge complaint", () => {
    const result = classifyCategory(
      "Double charged for my subscription",
      "You charged me twice this month, invoice shows a duplicate payment. Please refund.",
    );
    expect(result.category).toBe("billing");
    expect(result.categoryConfidence).toBeGreaterThan(0.5);
  });

  it("classifies an account lockout as account", () => {
    const result = classifyCategory(
      "Can't log in",
      "I am locked out of my account and the password reset link never arrives. Help.",
    );
    expect(result.category).toBe("account");
  });

  it("classifies a technical bug", () => {
    const result = classifyCategory(
      "API endpoint timing out",
      "Our integration fails with a 500 error and the webhook is not firing. The endpoint is returning an exception.",
    );
    expect(result.category).toBe("technical");
  });

  it("classifies a refund request as refund", () => {
    const result = classifyCategory(
      "Requesting a refund",
      "I want my money back for the enterprise plan I paid for this month.",
    );
    expect(result.category).toBe("refund");
  });

  it("falls back to general for an empty-body greeting", () => {
    const result = classifyCategory("Hello", "Hi, just saying hello to your team.");
    expect(result.category).toBe("general");
  });

  it("confidence is high when one category dominates", () => {
    const { categoryConfidence } = classifyCategory("hacked", "My account was hacked and I am locked out, suspicious activity detected");
    expect(categoryConfidence).toBeGreaterThan(0.7);
  });

  it("confidence is low when categories are ambiguous", () => {
    const { categoryConfidence } = classifyCategory("hello", "thanks");
    expect(categoryConfidence).toBeLessThanOrEqual(0.5);
  });
});

describe("detectLanguage", () => {
  it("detects english", () => {
    expect(detectLanguage("please help me with my account")).toBe("en");
  });

  it("detects spanish", () => {
    expect(detectLanguage("por favor ayúdame con mi cuenta y el pago de la factura")).toBe("es");
  });

  it("detects french", () => {
    expect(detectLanguage("bonjour, j'ai un problème avec mon compte et ma facture de paiement, merci")).toBe("fr");
  });

  it("detects german", () => {
    expect(detectLanguage("bitte helfen sie mir mit meinem konto, die rechnung und die zahlung sind fehlerhaft, danke")).toBe("de");
  });

  it("detects japanese script", () => {
    expect(detectLanguage("アカウントにログインできません 請求書について質問です")).toBe("ja");
  });
});