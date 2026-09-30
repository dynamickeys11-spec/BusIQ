import { describe, expect, it } from "vitest";
import { generateModelAnswer } from "./model-answer";
import type { IntelligencePipelineResult } from "./types";

const base = {
  request: "Explain this",
  status: "ready",
  intent: { kind: "explain", label: "Explain", normalizedRequest: "Explain this", requiredCapabilities: [], needsBusinessData: false, needsExternalResearch: false, ambiguity: "none", context: { entities: [] } },
  ambiguity: [],
  capabilities: [],
  researchPlan: [],
  routing: [],
  execution: [],
  evidence: [{ id: "e1", kind: "user", label: "User request", detail: "Explain this", source: "User input" }],
  verification: { state: "passed", checks: [], missingEvidence: [], diagnostics: [], sufficiency: "not-required" },
  reasoning: { state: "ready", conclusions: [], limitations: [] },
  answer: { type: "execution-plan", headline: "Existing", detail: "Existing detail", nextAction: "Continue" },
  trace: [],
} as unknown as IntelligencePipelineResult;

describe("generateModelAnswer", () => {
  it("uses only structured JSON returned by the model", async () => {
    const provider = {
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({ headline: "Clear answer", detail: "Evidence-bounded detail.", nextAction: "Review the evidence." }),
        provider: "ollama",
        model: "mistral",
      }),
      health: vi.fn(),
    };

    const result = await generateModelAnswer(provider, base);
    expect(result.answer.headline).toBe("Clear answer");
    expect(result.trace.at(-1)).toBe("Validate model output");
  });
});
