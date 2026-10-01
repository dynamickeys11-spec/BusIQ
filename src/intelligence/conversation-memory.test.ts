import { describe, expect, it } from "vitest";
import { semanticInterpretationToUnderstanding } from "./semantic-understanding.js";

describe("conversation memory", () => {
  it("resolves follow-ups from the model semantic contract and prior context", () => {
    const first = "Compare three business ideas I could start.";
    const understood = semanticInterpretationToUnderstanding(
      "What about the second one?",
      {
        meaning: "The user wants to examine the second previously discussed business option.",
        purpose: "compare",
        desiredOutcome: "Continue the comparison using the second previously discussed option.",
        businessRelevance: "direct",
        businessStage: "pre-business",
        answerMode: "comparison",
        operation: "EXPANSION",
        requiresEvidence: false,
        needsBusinessData: false,
        needsExternalResearch: false,
        requiresUserInput: false,
        domains: ["business"],
        entities: [],
        constraints: [],
        time: undefined,
        quantities: [],
        references: ["second one"],
        possibleInterpretations: [],
        confidence: "high",
      },
    );

    expect(understood.operation).toBe("EXPANSION");
    expect(understood.references).toContain("second one");
    expect(understood.signals).toContain("model-semantic-contract");
    expect(first).toContain("three business ideas");
  });

  it("preserves scenario changes and quantities through the semantic contract", () => {
    const scenario = semanticInterpretationToUnderstanding(
      "What if I only have ₦100,000?",
      {
        meaning: "The user is changing the available starting capital assumption.",
        purpose: "simulate",
        desiredOutcome: "Evaluate the business possibilities under a ₦100,000 capital constraint.",
        businessRelevance: "direct",
        businessStage: "pre-business",
        answerMode: "decision_support",
        operation: "SCENARIO",
        requiresEvidence: false,
        needsBusinessData: false,
        needsExternalResearch: false,
        requiresUserInput: false,
        domains: ["business"],
        entities: [],
        constraints: ["starting capital"],
        time: undefined,
        quantities: ["₦100,000"],
        references: [],
        possibleInterpretations: [],
        confidence: "high",
      },
    );

    expect(scenario.operation).toBe("SCENARIO");
    expect(scenario.quantities).toContain("₦100,000");
  });
});
