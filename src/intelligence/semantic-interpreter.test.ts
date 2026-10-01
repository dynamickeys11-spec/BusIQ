import { describe, expect, it } from "vitest";
import { resolveIntent } from "../bie/intent.js";
import type { ModelProvider, ModelRequest, ModelResponse, ProviderHealth } from "../providers/types.js";
import { interpretRequest, mergeSemanticInterpretation } from "./semantic-interpreter.js";

class FakeProvider implements ModelProvider {
  async generate(request: ModelRequest): Promise<ModelResponse> {
    const parsed = JSON.parse(request.prompt) as { request: string };
    const systemQuestion = /how do you work|how does busiq work|what can you do|what do you need from me|best performance|best results/i.test(parsed.request);
    return {
      provider: "test",
      model: "fake",
      text: JSON.stringify(systemQuestion ? {
        kind: "explain",
        label: "Explain BUSIQ",
        meaning: "Understand how BUSIQ operates and how to get the best results from it.",
        purpose: "use_busiq",
        desiredOutcome: "Understand BUSIQ's operating model, capabilities, inputs, and limitations.",
        businessRelevance: "indirect",
        businessStage: "unknown",
        answerMode: "system_explanation",
        needsBusinessData: false,
        needsExternalResearch: false,
        requiresEvidence: false,
        requiresUserInput: false,
        requiredCapabilities: ["explanation"],
        confidence: "high",
        entities: ["BUSIQ"],
        constraints: [],
        quantities: [],
        possibleInterpretations: [],
      } : {
        kind: "plan",
        label: "Build a plan",
        meaning: "Find a practical business starting path within the user's stated constraint.",
        purpose: "plan",
        desiredOutcome: "create an actionable plan for starting a business",
        businessRelevance: "direct",
        businessStage: "pre-business",
        answerMode: "planning",
        needsBusinessData: false,
        needsExternalResearch: false,
        requiresEvidence: false,
        requiresUserInput: false,
        requiredCapabilities: ["planning"],
        confidence: "high",
        entities: [],
        constraints: ["with ₦100,000"],
        quantities: ["₦100,000"],
        possibleInterpretations: [],
      }),
    };
  }
  async health(): Promise<ProviderHealth> {
    return { availability: "available", provider: "test", checkedAt: new Date().toISOString() };
  }
}

describe("semantic interpreter", () => {
  it("parses and merges a model semantic interpretation", async () => {
    const request = "I have no idea what business to start. I have ₦100,000.";
    const baseline = resolveIntent(request);
    const interpretation = await interpretRequest(new FakeProvider(), request, baseline);
    expect(interpretation.kind).toBe("plan");
    expect(interpretation.constraints).toContain("with ₦100,000");
    expect(interpretation.answerMode).toBe("planning");
    const merged = mergeSemanticInterpretation(baseline, interpretation);
    expect(merged.kind).toBe("plan");
    expect(merged.requiredCapabilities).toContain("planning");
    expect(merged.businessStage).toBe("pre-business");
  });

  it("supports BUSIQ/system questions without forcing business-data intent", async () => {
    const request = "What can keep you at your best performance?";
    const baseline = resolveIntent(request);
    const interpretation = await interpretRequest(new FakeProvider(), request, baseline);
    const merged = mergeSemanticInterpretation(baseline, interpretation);
    expect(merged.answerMode).toBe("system_explanation");
    expect(merged.purpose).toBe("use_busiq");
    expect(merged.needsBusinessData).toBe(false);
    expect(merged.kind).toBe("explain");
  });
});
