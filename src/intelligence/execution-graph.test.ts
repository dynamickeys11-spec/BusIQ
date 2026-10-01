import { describe, expect, it } from "vitest";
import { applyExecutionNodeResults, buildCapabilityExecutionGraph } from "./execution-graph.js";

const interpretation = {
  meaning: "Create a business plan",
  purpose: "plan",
  desiredOutcome: "A usable business plan",
  subject: { type: "business-plan" },
  businessStage: "pre-business",
  answerMode: "planning",
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

const emptyContext = { entries: [], references: [], unresolvedReferences: [], summary: [] };

describe("capability execution graph", () => {
  it("creates dependency edges and dependency-first stages", () => {
    const graph = buildCapabilityExecutionGraph(interpretation, emptyContext);
    expect(graph.edges).toContainEqual({ from: "business-context", to: "planning", kind: "dependency" });
    expect(graph.stages[0]).toContain("business-context");
    expect(graph.stages[1]).toContain("planning");
  });

  it("does not permit an unavailable dependency to become executable", () => {
    const graph = buildCapabilityExecutionGraph(
      { ...interpretation, requiredCapabilities: ["business-analysis"], needsBusinessData: true },
      emptyContext,
    );
    expect(graph.terminalState).toBe("blocked");
    expect(graph.nodes.find(n => n.capabilityId === "business-data-retrieval")?.status).toBe("blocked");
    expect(graph.nodes.find(n => n.capabilityId === "business-analysis")?.status).toBe("blocked");
  });
});


it("propagates a failed node to downstream dependencies", () => {
  const graph = buildCapabilityExecutionGraph(interpretation, emptyContext);
  const updated = applyExecutionNodeResults(graph, [{
    nodeId: "business-context",
    state: "blocked",
    evidenceIds: [],
    reason: "Context executor failed",
  }]);
  expect(updated.nodes.find(n => n.capabilityId === "planning")?.status).toBe("blocked");
  expect(updated.terminalState).toBe("blocked");
});
