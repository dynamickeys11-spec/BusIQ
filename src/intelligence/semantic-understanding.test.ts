import { describe, expect, it } from "vitest";
import { semanticInterpretationToUnderstanding } from "./semantic-understanding.js";

function interpretation(overrides: Partial<Parameters<typeof semanticInterpretationToUnderstanding>[1]> = {}) {
  return {
    meaning: "The user wants a useful business-oriented answer.",
    purpose: "understand" as const,
    desiredOutcome: "Answer the user's requested outcome.",
    businessRelevance: "direct" as const,
    businessStage: "unknown" as const,
    answerMode: "direct_answer" as const,
    operation: "NEW_INTENT" as const,
    requiresEvidence: false,
    needsBusinessData: false,
    needsExternalResearch: false,
    requiresUserInput: false,
    domains: [],
    entities: [],
    constraints: [],
    time: undefined,
    quantities: [],
    references: [],
    possibleInterpretations: [],
    confidence: "high" as const,
    ...overrides,
  };
}

describe("semantic understanding", () => {
  it("accepts model-derived meaning and response strategy across varied requests", () => {
    const cases = [
      ["plan", "planning"],
      ["investigate", "investigation"],
      ["plan", "planning"],
      ["retrieve", "direct_answer"],
      ["understand", "explanation"],
      ["compare", "comparison"],
    ] as const;

    for (const [purpose, expectedMode] of cases) {
      const understanding = semanticInterpretationToUnderstanding(
        "model supplied request",
        interpretation({
          purpose,
          answerMode: expectedMode,
          desiredOutcome: "Complete the requested outcome.",
        }),
      );
      expect(understanding.answerMode).toBe(expectedMode);
      expect(understanding.desiredOutcome).toBeDefined();
      expect(understanding.signals).toContain("model-semantic-contract");
    }
  });

  it("represents BUSIQ questions as system understanding", () => {
    const understanding = semanticInterpretationToUnderstanding(
      "What can keep you at your best performance?",
      interpretation({
        meaning: "The user wants to understand BUSIQ's operation and how to get better results.",
        purpose: "use_busiq",
        businessRelevance: "indirect",
        answerMode: "system_explanation",
        desiredOutcome: "Explain BUSIQ's operation, capabilities, requirements, and performance conditions.",
      }),
    );
    expect(understanding.answerMode).toBe("system_explanation");
    expect(understanding.requiresBusinessData).toBe(false);
  });

  it("preserves pre-business constraints and conversation references supplied by the model", () => {
    const preBusiness = semanticInterpretationToUnderstanding(
      "I don't have a business idea. What can I start with ₦100,000?",
      interpretation({
        purpose: "discover",
        businessStage: "pre-business",
        answerMode: "planning",
        quantities: ["₦100,000"],
        constraints: ["no existing business idea"],
      }),
    );
    expect(preBusiness.stage).toBe("pre-business");
    expect(preBusiness.quantities).toContain("₦100,000");

    const followUp = semanticInterpretationToUnderstanding(
      "What about the second option?",
      interpretation({
        purpose: "compare",
        businessStage: "pre-business",
        answerMode: "comparison",
        operation: "EXPANSION",
        references: ["second option"],
      }),
    );
    expect(followUp.operation).toBe("EXPANSION");
    expect(followUp.references).toContain("second option");
  });
});
