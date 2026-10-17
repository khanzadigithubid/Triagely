import { describe, expect, it } from "vitest";
import { analyzeSentiment } from "./sentiment";
import { analyzeUrgency } from "./urgency";
import { scorePriority } from "./priority";
import { triageTicket } from "./engine";

describe("analyzeSentiment", () => {
  it("flags an angry complaint as negative", () => {
    const result = analyzeSentiment("terrible service", "This is absolutely unacceptable, I am furious about being overcharged twice fraudulently");
    expect(result.sentiment).toBe("negative");
    expect(result.sentimentScore).toBeLessThan(0);
  });

  it("flags gratitude as positive", () => {
    const result = analyzeSentiment("thanks!", "Just wanted to say thank you, the product works perfectly and I love it, great job");
    expect(result.sentiment).toBe("positive");
  });

  it("treats a neutral factual question as neutral", () => {
    const result = analyzeSentiment("question", "Could you tell me what time the office opens and how to reach someone there.");
    expect(result.sentiment).toBe("neutral");
  });
});

describe("analyzeUrgency / scorePriority", () => {
  it("treats a production outage as urgent", () => {
    const body = "Our production system is down for everyone, this is an emergency, treat this as P1 incident immediately";
    const urgency = analyzeUrgency("outage", body);
    expect(urgency.urgencyScore).toBeGreaterThanOrEqual(80);
    expect(urgency.urgency).toBe("urgent");
  });

  it("scores an angry charge complaint as high priority", () => {
    const body = "You keep charging my credit card without permission, stop this now";
    const sentiment = analyzeSentiment("unfair charge", body).sentiment;
    const result = scorePriority("unfair charge", body, "billing", analyzeSentiment("unfair charge", body));
    expect(result.priority).toBe("high");
    expect(result.priorityScore).toBeGreaterThanOrEqual(50);
    expect(sentiment).toBe("negative");
  });

  it("keeps a calm feature ask at medium/low", () => {
    const result = scorePriority(
      "feature request",
      "Is it possible for your product to support importing data from Notion? Just checking the roadmap.",
      "product",
      analyzeSentiment("feature request", "Is it possible for your product to support importing data from Notion?"),
    );
    expect(["medium", "low"]).toContain(result.priority);
  });

  it("explicit P0 trumps a calm tone", () => {
    const result = scorePriority(
      "incident",
      "P0 incident, severity critical, production blocker right now",
      "technical",
      analyzeSentiment("incident", "P0 incident, severity critical, production blocker right now"),
    );
    expect(result.priority).toBe("urgent");
    expect(result.priorityScore).toBeGreaterThanOrEqual(72);
  });
});

describe("triageTicket", () => {
  const result = triageTicket({
    subject: "Urgent: canceled my plan but you charged me again",
    body: "I canceled my subscription yesterday, yet you charged my credit card again today. This is unacceptable.",
    fromName: "Ayesha Khan",
  });

  it("produces a full classification", () => {
    expect(result.classification.category).toBe("billing");
    expect(result.classification.sentiment).toBe("negative");
    expect(result.classification.priority).toBe("high");
    expect(Array.isArray(result.classification.tags)).toBe(true);
    expect(result.classification.summary.length).toBeGreaterThan(0);
  });

  it("produces a personalized template draft", () => {
    expect(result.draftReply).toContain("Ayesha");
    expect(result.draftReply).toContain("billing");
    expect(result.draftReplyEngine).toBe("heuristic");
  });
});