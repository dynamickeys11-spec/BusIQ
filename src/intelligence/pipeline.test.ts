import { describe, expect, it } from "vitest";
import { runIntelligencePipeline } from "./pipeline";
import { reasonFromEvidence } from "./reasoning";
import { classifyEvidenceQuality, verifyEvidence } from "./verify";

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
      [{ id: "source-1", kind: "retrieved", label: "Source", detail: "Sales fell 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" }],
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

  it("derives a finding only from multiple verified facts", () => {
    const result = reasonFromEvidence(
      [
        { id: "source-1", kind: "retrieved", label: "Sales", detail: "Sales fell 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" },
        { id: "source-2", kind: "retrieved", label: "Orders", detail: "Orders fell 13%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" },
      ],
      "passed",
      "Why did sales change?",
    );
    expect(result.state).toBe("ready");
    const finding = result.conclusions.find(item => item.type === "FINDING");
    expect(finding).toEqual({
      type: "FINDING",
      statement: "The verified evidence set contains 2 directly supported facts relevant to the request: Why did sales change?",
      evidenceIds: ["source-1", "source-2"],
      support: "supported",
    });
  });

  it("does not promote indirectly relevant verified evidence into a factual answer", () => {
    const result = reasonFromEvidence(
      [{ id: "source-1", kind: "retrieved", label: "Orders", detail: "Orders fell 13%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "indirect" }],
      "passed",
      "Why did sales fall?",
    );
    expect(result.state).toBe("insufficient");
    expect(result.conclusions).toHaveLength(0);
    expect(result.limitations.join(" ")).toContain("none is directly relevant");
  });

  it("blocks combined findings when verified evidence conflicts", () => {
    const result = reasonFromEvidence(
      [
        { id: "source-1", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" },
        { id: "source-2", kind: "retrieved", label: "Sales", detail: "Sales decreased 3%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" },
      ],
      "passed",
      "How did sales change?",
    );
    expect(result.state).toBe("insufficient");
    expect(result.conclusions.every(item => item.type === "FACT")).toBe(true);
    expect(result.conclusions.some(item => item.type === "FINDING")).toBe(false);
    expect(result.limitations.join(" ")).toContain("Conflicting evidence");
  });

  it("does not treat different scopes as conflicting evidence", () => {
    const result = reasonFromEvidence(
      [
        { id: "source-1", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.", source: "Connector", scope: { geography: "Online" }, authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" },
        { id: "source-2", kind: "retrieved", label: "Sales", detail: "Sales decreased 3%.", source: "Connector", scope: { geography: "Retail" }, authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" },
      ],
      "passed",
      "How did sales change?",
    );
    expect(result.state).toBe("ready");
    expect(result.conclusions.some(item => item.type === "FINDING")).toBe(true);
  });

  it("does not treat different evidence dates as conflicting", () => {
    const result = reasonFromEvidence(
      [
        { id: "source-1", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.", source: "Connector", evidenceDate: "2026-09-26", authority: "connected-source", freshness: "dated", verification: "verified", relevance: "direct" },
        { id: "source-2", kind: "retrieved", label: "Sales", detail: "Sales decreased 3%.", source: "Connector", evidenceDate: "2026-09-27", authority: "connected-source", freshness: "dated", verification: "verified", relevance: "direct" },
      ],
      "passed",
      "How did sales change?",
    );
    expect(result.state).toBe("ready");
    expect(result.conclusions.some(item => item.type === "FINDING")).toBe(true);
  });

  it("blocks factual verification when evidence quality metadata is incomplete", () => {
    const result = verifyEvidence(
      [{ id: "source-1", kind: "retrieved", label: "Sales", detail: "Sales fell 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified" }],
      [{ id: "business-data", purpose: "Retrieve business data.", sourceClass: "business-data", status: "available", evidenceRequired: true }],
      0,
      true,
    );
    expect(result.state).toBe("blocked");
    expect(result.missingEvidence.join(" ")).toContain("unknown relevance");
    expect(result.missingEvidence.join(" ")).not.toContain("unknown source authority.");
  });

  it("reports distinct evidence quality categories", () => {
    const result = verifyEvidence(
      [
        { id: "authority-missing", kind: "retrieved", label: "Sales", detail: "Sales fell.", source: "Connector", freshness: "current", verification: "verified", relevance: "direct" },
        { id: "freshness-missing", kind: "retrieved", label: "Orders", detail: "Orders fell.", source: "Connector", authority: "connected-source", verification: "verified", relevance: "direct" },
        { id: "verification-missing", kind: "retrieved", label: "Customers", detail: "Customers fell.", source: "Connector", authority: "connected-source", freshness: "current", relevance: "direct" },
      ],
      [],
      0,
      true,
    );
    expect(result.state).toBe("blocked");
    expect(result.missingEvidence).toHaveLength(3);
    expect(result.missingEvidence[0]).toContain("source authority");
    expect(result.missingEvidence[1]).toContain("freshness");
    expect(result.missingEvidence[2]).toContain("not verified");
  });

  it("blocks dated evidence for a current-time question", () => {
    const result = verifyEvidence(
      [{ id: "dated-source", kind: "retrieved", label: "Sales", detail: "Sales fell 8%.", source: "Connector", authority: "connected-source", freshness: "dated", evidenceDate: "2025-09-27", relevance: "direct", verification: "verified" }],
      [{ id: "business-data", purpose: "Retrieve business data.", sourceClass: "business-data", status: "available", evidenceRequired: true }],
      0,
      true,
      "What are sales currently?",
    );
    expect(result.state).toBe("blocked");
    expect(result.missingEvidence.join(" ")).toContain("not current enough");
  });

  it("allows dated evidence for a historical question when it has a date", () => {
    const result = verifyEvidence(
      [{ id: "dated-source", kind: "retrieved", label: "Sales", detail: "Sales fell 8%.", source: "Connector", authority: "connected-source", freshness: "dated", evidenceDate: "2025-09-27", relevance: "direct", verification: "verified" }],
      [{ id: "business-data", purpose: "Retrieve business data.", sourceClass: "business-data", status: "available", evidenceRequired: true }],
      0,
      true,
      "What happened to sales last year?",
    );
    expect(result.state).toBe("passed");
  });

  it("blocks verification when retrieved evidence has incompatible business scopes", () => {
    const result = verifyEvidence(
      [
        { id: "business-a", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct", scope: { businessId: "business-a" } },
        { id: "business-b", kind: "retrieved", label: "Orders", detail: "Orders increased 4%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct", scope: { businessId: "business-b" } },
      ],
      [],
      0,
      true,
      "How is my business doing?",
    );
    expect(result.state).toBe("blocked");
    expect(result.missingEvidence.join(" ")).toContain("incompatible scopes");
  });

  it("blocks verification when scoped and unscoped evidence are mixed", () => {
    const result = verifyEvidence(
      [
        { id: "scoped", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct", scope: { businessId: "business-a" } },
        { id: "unscoped", kind: "retrieved", label: "Orders", detail: "Orders increased 4%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" },
      ],
      [],
      0,
      true,
      "How is my business doing?",
    );
    expect(result.state).toBe("blocked");
    expect(result.missingEvidence.join(" ")).toContain("scoped and unscoped");
  });

  it("allows multiple evidence items when their structured scope matches", () => {
    const result = verifyEvidence(
      [
        { id: "sales", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct", scope: { businessId: "business-a", periodStart: "2026-09-01", periodEnd: "2026-09-27" } },
        { id: "orders", kind: "retrieved", label: "Orders", detail: "Orders increased 4%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct", scope: { businessId: "business-a", periodStart: "2026-09-01", periodEnd: "2026-09-27" } },
      ],
      [],
      0,
      true,
      "How is my business doing?",
    );
    expect(result.state).toBe("passed");
  });

  it("preserves conflicting facts but blocks a synthesized finding", () => {
    const result = reasonFromEvidence(
      [
        { id: "source-1", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct", scope: { businessId: "business-a", periodStart: "2026-09-01", periodEnd: "2026-09-27" } },
        { id: "source-2", kind: "retrieved", label: "Sales", detail: "Sales decreased 3%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct", scope: { businessId: "business-a", periodStart: "2026-09-01", periodEnd: "2026-09-27" } },
      ],
      "passed",
      "How did sales change?",
    );
    expect(result.state).toBe("insufficient");
    expect(result.conclusions.map(item => item.type)).toEqual(["FACT", "FACT"]);
    expect(result.limitations.join(" ")).toContain("Conflicting evidence");
  });

  it("does not call evidence a conflict when the dates differ", () => {
    const result = reasonFromEvidence(
      [
        { id: "source-1", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.", source: "Connector", authority: "connected-source", freshness: "dated", evidenceDate: "2026-09-26", verification: "verified", relevance: "direct" },
        { id: "source-2", kind: "retrieved", label: "Sales", detail: "Sales decreased 3%.", source: "Connector", authority: "connected-source", freshness: "dated", evidenceDate: "2026-09-27", verification: "verified", relevance: "direct" },
      ],
      "passed",
      "How did sales change?",
    );
    expect(result.state).toBe("ready");
    expect(result.limitations.join(" ")).not.toContain("Conflicting evidence");
  });

  it("classifies evidence quality from provenance metadata", () => {
    expect(classifyEvidenceQuality({ id: "strong", kind: "retrieved", label: "Sales", detail: "Sales fell 8%.", source: "Connector", authority: "connected-source", freshness: "current", verification: "verified", relevance: "direct" })).toBe("strong");
    expect(classifyEvidenceQuality({ id: "limited", kind: "retrieved", label: "Orders", detail: "Orders fell 4%.", source: "Connector", authority: "connected-source", freshness: "dated", verification: "verified", relevance: "indirect" })).toBe("limited");
    expect(classifyEvidenceQuality({ id: "unknown", kind: "retrieved", label: "Customers", detail: "Customers changed.", source: "Connector", verification: "unverified", relevance: "direct" })).toBe("unknown");
  });

  it("asks for clarification for an unknown request", () => {
    const result = runIntelligencePipeline("Tell me something useful");
    expect(result.status).toBe("needs_clarification");
    expect(result.intent.kind).toBe("unknown");
  });
});
