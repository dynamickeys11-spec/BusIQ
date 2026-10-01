import { describe, expect, it } from "vitest";
import { resolveIntent } from "../bie/intent.js";
import { understandRequest } from "./semantic-understanding.js";

describe("semantic understanding", () => {
  it("preserves meaning and response strategy across varied natural language", () => {
    const cases = [
      ["What should I focus on when starting a small business?", "plan", "planning"],
      ["My sales have fallen. What's going on?", "investigate", "investigation"],
      ["Make me a business plan for a laundry service.", "plan", "planning"],
      ["How much did we sell last month?", "retrieve", "direct_answer"],
      ["Explain gross profit to me.", "explain", "explanation"],
      ["Which is better for this business, option A or B?", "compare", "comparison"],
    ] as const;
    for (const [request, expectedIntent, expectedMode] of cases) {
      const intent = resolveIntent(request);
      expect(intent.kind, request).toBe(expectedIntent);
      const understanding = understandRequest(request, intent);
      expect(understanding.normalizedText).toBe(request);
      expect(understanding.desiredOutcome ?? intent.desiredOutcome).toBeDefined();
      expect(understanding.answerMode).toBe(expectedMode);
    }
  });

  it("recognizes BUSIQ questions as system understanding rather than business-data requests", () => {
    const requests = [
      "How do you work?",
      "How does BUSIQ work?",
      "What can you do for me?",
      "What information do you need from me?",
      "What can keep you at your best performance?",
    ];
    for (const request of requests) {
      const baseline = resolveIntent(request);
      const understanding = understandRequest(request, {
        ...baseline,
        kind: "explain",
        answerMode: "system_explanation",
        purpose: "use_busiq",
        businessRelevance: "indirect",
        businessStage: "unknown",
        meaning: "Understand BUSIQ's operation and capabilities.",
        desiredOutcome: "Understand how BUSIQ works and how to use it effectively.",
      });
      expect(understanding.answerMode, request).toBe("system_explanation");
      expect(understanding.requiresBusinessData, request).toBe(false);
    }
  });

  it("detects pre-business constraints and conversation references", () => {
    const request = "I don't have a business idea. What can I start with ₦100,000?";
    const preBusiness = understandRequest(request, {
      ...resolveIntent(request),
      businessStage: "pre-business",
      answerMode: "planning",
      purpose: "discover",
    });
    expect(preBusiness.stage).toBe("pre-business");
    expect(preBusiness.quantities.some(value => value.includes("100,000"))).toBe(true);
    const followUp = understandRequest("What about the second option?", resolveIntent("What about the second option?"), "Compare three business ideas for me.");
    expect(followUp.operation).toBe("EXPANSION");
    expect(followUp.references.length).toBeGreaterThan(0);
  });
});
