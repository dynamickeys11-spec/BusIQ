import { describe, expect, it } from "vitest";
import { resolveIntent } from "../bie/intent";
import { assessResearchEvidence, decideResearchStopping } from "./research-assessment";
import { routeCapabilities } from "./router";
import { listCapabilities } from "./capabilities";
import { runIntelligencePipeline } from "./pipeline";
import { validateAnswerQuality } from "./answer-quality";

describe("BUSIQ roadmap regression coverage", () => {
  it("preserves explicit time context", () => {
    expect(resolveIntent("What happened to sales last month?").context?.time).toBe("last month");
    expect(resolveIntent("What are the latest market trends?").context?.time).toBe("latest");
  });

  it("keeps ambiguity as a hard gate for underspecified comparison", () => {
    const result = runIntelligencePipeline("Compare");
    expect(result.status).toBe("needs_clarification");
    expect(result.ambiguity.some(item => item.field === "goal")).toBe(true);
  });

  it("routes unavailable capabilities instead of silently substituting a tool", () => {
    const capabilities = listCapabilities();
    const routed = routeCapabilities(resolveIntent("Show my inventory"), capabilities);
    expect(routed.some(item => item.capabilityId === "inventory" && item.state === "blocked")).toBe(true);
  });

  it("stops research on conflicting evidence", () => {
    const assessment = assessResearchEvidence([
      { id:"a",kind:"retrieved",label:"Sales",detail:"Sales increased 8%.",source:"A",authority:"external-source",freshness:"current",verification:"verified",relevance:"direct" },
      { id:"b",kind:"retrieved",label:"Sales",detail:"Sales decreased 3%.",source:"B",authority:"external-source",freshness:"current",verification:"verified",relevance:"direct" },
    ], 2);
    expect(assessment.conflicts).toBe(true);
    expect(decideResearchStopping(assessment, 2)).toBe("conflict-detected");
  });

  it("does not accept unsupported success claims", () => {
    const result = runIntelligencePipeline("Why are my sales down?");
    const quality = validateAnswerQuality(result);
    expect(quality.passed).toBe(true);
    expect(result.status).not.toBe("ready");
  });

  it("covers the complete deterministic pipeline from request to answer", () => {
    const result = runIntelligencePipeline("Create a business plan");
    expect(result.trace).toEqual(expect.arrayContaining([
      "intent-resolution",
      "ambiguity-check",
      "capability-resolution",
      "tool-routing",
      "research-planning",
      "evidence-collection",
      "verification",
      "reasoning",
      "answer",
    ]));
    expect(result.status).toBe("ready");
    expect(result.answer.nextAction).toBeTruthy();
  });
});
