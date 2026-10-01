import { resolveIntent } from "../bie/intent.js";
import type { ModelProvider, ModelRequest, ModelResponse, ProviderHealth } from "../providers/types.js";
import { interpretRequest, mergeSemanticInterpretation } from "./semantic-interpreter.js";

class FakeProvider implements ModelProvider {
  async generate(_request: ModelRequest): Promise<ModelResponse> {
    return {
      provider: "test",
      model: "fake",
      text: JSON.stringify({
        kind: "plan",
        label: "Build a plan",
        desiredOutcome: "create an actionable plan for starting a business",
        needsBusinessData: false,
        needsExternalResearch: false,
        requiredCapabilities: ["planning"],
        confidence: "high",
        entities: [],
        constraints: ["with ₦100,000"],
        possibleInterpretations: [],
      }),
    };
  }
  async health(): Promise<ProviderHealth> {
    return { availability: "available", provider: "test", checkedAt: new Date().toISOString() };
  }
}

const baseline = resolveIntent("I have no idea what business to start. I have ₦100,000.");
const interpretation = await interpretRequest(new FakeProvider(), "I have no idea what business to start. I have ₦100,000.", baseline);
if (interpretation.kind !== "plan") throw new Error("Model semantic interpretation did not parse.");
if (!interpretation.constraints.includes("with ₦100,000")) throw new Error("Constraint was not preserved.");
const merged = mergeSemanticInterpretation(baseline, interpretation);
if (merged.kind !== "plan") throw new Error("Model intent was not merged.");
if (!merged.requiredCapabilities.includes("planning")) throw new Error("Model capability was not merged.");

console.log("semantic interpreter tests passed");
