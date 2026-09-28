import { describe, expect, it } from "vitest";
import { resolveIntent } from "../bie/intent";
import { detectAmbiguity } from "./ambiguity";
import { classifyEvidenceQuality, verifyEvidence } from "./verify";
import { assessResearchEvidence, decideResearchStopping } from "./research-assessment";
import { routeCapabilities } from "./router";
import { getTool, listTools } from "./tools";
import { validateAnswerQuality } from "./answer-quality";
import { buildActionDecision, getActionForKind } from "./actions";
import { authorizeBusinessMembership, requireAuthenticated } from "./auth";
import { authorizeResource, validateTruthfulnessClaim } from "./security";

describe("BUSIQ intelligence hardening: roadmap 121-130", () => {
  it("121 — resolves the core intent families without collapsing distinct outcomes", () => {
    expect(resolveIntent("Why are sales down?").kind).toBe("investigate");
    expect(resolveIntent("Compare two suppliers").kind).toBe("compare");
    expect(resolveIntent("Create a 90-day plan").kind).toBe("plan");
    expect(resolveIntent("Draft a proposal").kind).toBe("create");
    expect(resolveIntent("Show my inventory").kind).toBe("retrieve");
  });

  it("122 — blocks material ambiguity but leaves sufficiently specified requests alone", () => {
    const comparison = resolveIntent("Compare");
    expect(detectAmbiguity("Compare", comparison)[0]?.field).toBe("goal");

    const clear = resolveIntent("Compare suppliers by price");
    expect(detectAmbiguity("Compare suppliers by price", clear)).toEqual([]);
  });

  it("123 — treats unverified or stale evidence as insufficient quality", () => {
    expect(classifyEvidenceQuality({
      id: "e1", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.",
      source: "connected-system", authority: "connected-source", freshness: "current",
      verification: "verified", relevance: "direct",
    })).toBe("strong");

    expect(classifyEvidenceQuality({
      id: "e2", kind: "retrieved", label: "Sales", detail: "Sales increased 8%.",
      source: "unknown", authority: "unknown", freshness: "unknown",
      verification: "unverified", relevance: "unknown",
    })).toBe("unknown");
  });

  it("124 — preserves research conflicts instead of synthesizing them", () => {
    const assessment = assessResearchEvidence([
      { id:"a", kind:"retrieved", label:"Sales", detail:"Sales increased 8%.", source:"A", authority:"connected-source", freshness:"current", verification:"verified", relevance:"direct" },
      { id:"b", kind:"retrieved", label:"Sales", detail:"Sales decreased 3%.", source:"B", authority:"connected-source", freshness:"current", verification:"verified", relevance:"direct" },
    ]);
    expect(assessment.conflicts.length).toBeGreaterThan(0);
    expect(decideResearchStopping(assessment, 2).reason).toBe("conflict-detected");
  });

  it("125 — respects current versus historical time requirements", () => {
    expect(resolveIntent("What happened to sales last month?").context?.time).toBe("last month");
    const current = verifyEvidence([
      { id:"e1", kind:"retrieved", label:"Sales", detail:"Sales increased.", source:"A", authority:"connected-source", freshness:"dated", verification:"verified", relevance:"direct", evidenceDate:"2026-08-01" },
    ], [{ id:"r1", purpose:"retrieve sales", status:"completed", evidenceRequired:true, sourceClass:"business-data" }], 0, true, "What are sales currently?");
    expect(current.state).toBe("blocked");
  });

  it("126 — routes only to registered available tools", () => {
    const selected = routeCapabilities(resolveIntent("Create a business plan")).find(x => x.capabilityId === "planning");
    expect(selected?.state).toBe("selected");
    expect(selected?.selectedToolId).toBe("local-plan-builder");

    const blocked = routeCapabilities(resolveIntent("Show my inventory")).find(x => x.capabilityId === "inventory");
    expect(blocked?.state).toBe("blocked");
  });

  it("127 — exposes connector contracts without pretending disconnected connectors are live", () => {
    const tools = listTools();
    expect(tools.some(tool => tool.id === "business-data-connector")).toBe(true);
    expect(getTool("business-data-connector")?.availability).toBe("unavailable");
    expect(getTool("external-research-connector")?.availability).toBe("unavailable");
  });

  it("128 — rejects malformed answer presentation but accepts a complete blocked answer", () => {
    const result = {
      status: "blocked" as const,
      answer: { headline: "", detail: "", nextAction: "", evidence: ["missing"] },
      evidence: [],
      reasoning: [],
    };
    expect(validateAnswerQuality(result).passed).toBe(false);

    const valid = {
      status: "blocked" as const,
      answer: { headline: "BUSIQ cannot access that data yet.", detail: "The required connector is not connected.", nextAction: "Connect the required business system before retrying." },
      evidence: [],
      reasoning: [],
    };
    expect(validateAnswerQuality(valid).passed).toBe(true);
  });

  it("129 — requires authentication, authorization and confirmation for consequential actions", () => {
    const action = getActionForKind("send")!;
    expect(buildActionDecision(action).state).toBe("blocked");
    expect(buildActionDecision(action, { authorization: { granted: true }, confirmed: false }).state).toBe("blocked");
    expect(buildActionDecision(action, { authorization: { granted: true }, confirmed: true }).state).toBe("blocked");
  });

  it("130 — enforces authentication, business isolation, sensitivity and truthfulness", () => {
    expect(requireAuthenticated("unauthenticated", { userId:"u1", authenticatedAt:"2026-09-28T00:00:00Z" }).state).toBe("blocked");
    expect(authorizeBusinessMembership({ userId:"u1", businessId:"b1", requiredRoles:["admin"] }, [
      { userId:"u1", businessId:"b1", role:"member" },
    ]).state).toBe("blocked");

    const decision = authorizeResource(
      { subject:{ userId:"u1", businessId:"b1" }, permissions:[], allowLocalData:true },
      { id:"secret", businessId:"b1", sensitivity:"sensitive" },
      "read",
      { toolId:"business-data-connector", modes:["read"], allowedBusinessIds:["b1"], sensitiveDataAllowed:false },
    );
    expect(decision.state).toBe("blocked");
    expect(validateTruthfulnessClaim({ kind:"action", actionId:"send-message", executed:false }).state).toBe("blocked");
  });
});
