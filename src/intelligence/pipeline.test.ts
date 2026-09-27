import { describe, expect, it } from "vitest";
import { runIntelligencePipeline } from "./pipeline";
import { reasonFromEvidence } from "./reasoning";

describe("BUSIQ intelligence pipeline", () => {
  it("blocks business questions that require connected business data", () => {
    const result = runIntelligencePipeline("Why are my sales down?");
    expect(result.intent.kind).toBe("investigate");
    expect(result.status).toBe("needs_connection");
    expect(result.researchPlan.some(step => step.sourceClass === "business-data" && step.status === "blocked" && step.evidenceRequired)).toBe(true);
    expect(result.verification.state).toBe("blocked");
    expect(result.reasoning.state).toBe("insufficient");
    expect(result.execution).toHaveLength(0);
  });

  it("blocks current external research until a research connector exists", () => {
    const result = runIntelligencePipeline("What are the latest market trends?");
    expect(result.intent.needsExternalResearch).toBe(true);
    expect(result.status).toBe("needs_connection");
    expect(result.researchPlan.some(step => step.sourceClass === "external-research" && step.status === "blocked" && step.evidenceRequired)).toBe(true);
    expect(result.verification.state).toBe("blocked");
    expect(result.execution).toHaveLength(0);
  });

  it("executes a local plan without inventing business facts", () => {
    const result = runIntelligencePipeline("Create a business plan");
    expect(result.intent.kind).toBe("plan");
    expect(result.status).toBe("ready");
    expect(result.verification.state).toBe("passed");
    expect(result.verification.missingEvidence).toHaveLength(0);
    expect(result.execution.some(item => item.toolId === "local-plan-builder" && item.state === "success")).toBe(true);
    expect(result.answer.detail).toContain("no invented business facts");
    expect(result.reasoning.state).toBe("ready");
    expect(result.reasoning.conclusions.some(item => item.type === "INFERENCE")).toBe(true);
    expect(result.reasoning.conclusions.every(item => item.support === "supported")).toBe(true);
  });

  it("executes a 90-day plan locally while leaving factual research disconnected", () => {
    const result = runIntelligencePipeline("Build a 90-day growth plan");
    expect(result.intent.kind).toBe("plan");
    expect(result.status).toBe("ready");
    expect(result.verification.state).toBe("passed");
    expect(result.researchPlan.some(step => step.id === "no-research" && step.status === "not-required" && !step.evidenceRequired)).toBe(true);
  });

  it("blocks retrieval of current business expenses", () => {
    const result = runIntelligencePipeline("Show my expenses");
    expect(result.intent.kind).toBe("retrieve");
    expect(result.intent.needsBusinessData).toBe(true);
    expect(result.status).toBe("needs_connection");
  });

  it("asks for clarification when the goal cannot be resolved", () => {
    const result = runIntelligencePipeline("Compare");
    expect(result.status).toBe("needs_clarification");
    expect(result.ambiguity[0]?.field).toBe("goal");
    expect(result.verification.state).toBe("blocked");
  });

  it("does not produce factual conclusions when evidence is blocked", () => {
    const result = runIntelligencePipeline("Why are my sales down?");
    expect(result.reasoning.state).toBe("insufficient");
    expect(result.reasoning.conclusions).toHaveLength(0);
    expect(result.reasoning.limitations.join(" ")).toContain("missing or unverified information");
  });

  it("does not promote unverified retrieved material to fact", () => {
    const result = reasonFromEvidence(
      [{ id: "source-1", kind: "retrieved", label: "Source", detail: "Sales changed.", source: "Connector", verification: "unverified" }],
      "passed",
      "Why did sales change?",
    );
    expect(result.state).toBe("insufficient");
    expect(result.conclusions).toHaveLength(0);
    expect(result.limitations.join(" ")).toContain("unverified retrieved material");
  });

  it("allows verified retrieved evidence to produce an evidence-linked fact", () => {
    const result = reasonFromEvidence(
      [{ id: "source-1", kind: "retrieved", label: "Source", detail: "Sales fell 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified" }],
      "passed",
      "Why did sales change?",
    );
    expect(result.state).toBe("ready");
    expect(result.conclusions).toEqual([{
      type: "FACT",
      statement: "Sales fell 8%.",
      evidenceIds: ["source-1"],
      support: "supported",
    }]);
  });

  it("asks for clarification for an unknown request", () => {
    const result = runIntelligencePipeline("Tell me something useful");
    expect(result.status).toBe("needs_clarification");
    expect(result.intent.kind).toBe("unknown");
  });
});
