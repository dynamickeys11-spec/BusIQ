import { describe, expect, it } from "vitest";
import { interpretRequest, semanticInterpretationToIntent } from "./semantic-interpreter.js";
import type { ModelProvider } from "../providers/types.js";

function providerFor(value: unknown): ModelProvider {
  return {
    async generate() {
      return { text: JSON.stringify(value), provider: "test", model: "test" };
    },
    async health() {
      return { availability: "available", provider: "test", checkedAt: new Date().toISOString() };
    },
  };
}

describe("primary semantic understanding", () => {
  it("accepts model-derived system explanation semantics without phrase routing", async () => {
    const interpretation = await interpretRequest(providerFor({
      kind: "explain",
      label: "Explain BUSIQ performance conditions",
      meaning: "The user wants to understand how BUSIQ works and what helps it perform well.",
      purpose: "use_busiq",
      desiredOutcome: "Explain BUSIQ operation and the inputs that improve its performance.",
      businessRelevance: "indirect",
      businessStage: "unknown",
      answerMode: "system_explanation",
      operation: "NEW_INTENT",
      needsBusinessData: false,
      needsExternalResearch: false,
      requiresEvidence: false,
      requiresUserInput: false,
      requiredCapabilities: ["explanation"],
      confidence: "high",
      entities: ["BUSIQ"],
      domains: [],
      constraints: [],
      quantities: [],
      time: undefined,
      references: [],
      possibleInterpretations: [],
    }), "What can keep you at your best performance?", []);
    const intent = semanticInterpretationToIntent("What can keep you at your best performance?", interpretation);
    expect(intent.answerMode).toBe("system_explanation");
    expect(intent.purpose).toBe("use_busiq");
    expect(intent.requiredCapabilities).toContain("explanation");
  });

  it("drops capabilities that are not registered", async () => {
    const interpretation = await interpretRequest(providerFor({
      kind: "plan",
      label: "Build a business plan",
      meaning: "The user wants a structured business plan.",
      purpose: "plan",
      desiredOutcome: "Produce a business plan.",
      businessRelevance: "direct",
      businessStage: "pre-business",
      answerMode: "planning",
      operation: "NEW_INTENT",
      needsBusinessData: false,
      needsExternalResearch: false,
      requiresEvidence: false,
      requiresUserInput: false,
      requiredCapabilities: ["planning", "invented-capability"],
      confidence: "high",
      entities: [],
      domains: [],
      constraints: [],
      quantities: [],
      time: undefined,
      references: [],
      possibleInterpretations: [],
    }), "make me a business plan", []);
    expect(interpretation.requiredCapabilities).toEqual(["planning"]);
  });
});
