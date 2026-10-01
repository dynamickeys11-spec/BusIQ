import { describe, expect, it } from "vitest";
import { planCapabilities } from "./capability-planner.js";

const base = {
  meaning: "Create a business plan",
  purpose: "plan",
  desiredOutcome: "A usable business plan",
  subject: "business plan",
  businessStage: "pre-business",
  answerMode: "planning",
  businessRelevance: "direct",
  references: [],
  quantities: [],
  time: undefined,
  constraints: [],
  requiredCapabilities: ["planning"],
  needsBusinessData: false,
  needsExternalResearch: false,
  requiresEvidence: false,
  requiresUserInput: false,
  confidence: "high",
  ambiguity: { present: false, interpretations: [] },
} as any;

describe("capability planning", () => {
  it("expands dependencies into an ordered execution path", () => {
    const plan = planCapabilities(base, { entries: [], references: [], unresolvedReferences: [], summary: [] });
    expect(plan.steps.map(step => step.capabilityId)).toEqual(["business-context", "planning"]);
    expect(plan.blocked).toEqual([]);
    expect(plan.ready).toContain("planning");
  });

  it("blocks an unavailable capability instead of pretending it is executable", () => {
    const plan = planCapabilities({ ...base, requiredCapabilities: ["business-analysis"], needsBusinessData: true }, { entries: [], references: [], unresolvedReferences: [], summary: [] });
    expect(plan.blocked).toContain("business-data-retrieval");
    expect(plan.blocked).toContain("business-analysis");
  });
});
