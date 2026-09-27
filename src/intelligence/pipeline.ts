import { resolveIntent } from "../bie/intent";
import { detectAmbiguity } from "./ambiguity";
import { describeCapabilities } from "./capabilities";
import { buildResearchPlan } from "./research";
import { executeTool } from "./execution";
import { routeCapabilities } from "./router";
import type { IntelligencePipelineResult } from "./types";
import { verifyEvidence } from "./verify";
import { reasonFromEvidence } from "./reasoning";

export function runIntelligencePipeline(request: string): IntelligencePipelineResult {
  const normalized = request.trim().replace(/\s+/g, " ");
  const intent = resolveIntent(normalized);
  const ambiguity = detectAmbiguity(normalized, intent);
  const capabilities = describeCapabilities(intent.requiredCapabilities, intent.needsBusinessData, intent.needsExternalResearch);
  const routing = routeCapabilities(intent);
  const researchPlan = buildResearchPlan(intent);
  const initialEvidence = normalized
    ? [{ id: "request", kind: "user" as const, label: "User request", detail: normalized, source: "User input" }]
    : [];
  const unavailable = capabilities.filter(item => item.status === "unavailable");
  const blockedRouting = routing.filter(item => item.state === "blocked");
  const base = {
    request: normalized, intent, ambiguity, capabilities, researchPlan, routing,
  };

  if (ambiguity.length) {
    return {
      ...base,
      status: "needs_clarification",
      execution: [],
      evidence: initialEvidence,
      verification: verifyEvidence(initialEvidence, researchPlan, ambiguity.length, false, normalized),
      reasoning: reasonFromEvidence(initialEvidence, "blocked", normalized),
      answer: {
        type: "clarification",
        headline: ambiguity[0].question,
        detail: ambiguity[0].reason,
        nextAction: "Answer the clarification so BUSIQ can continue.",
      },
      trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve candidate tools", "Stop before unsupported execution"],
    };
  }

  if (unavailable.length || blockedRouting.length) {
    return {
      ...base,
      status: "needs_connection",
      execution: [],
      evidence: initialEvidence,
      verification: verifyEvidence(initialEvidence, researchPlan, 0, false, normalized),
      reasoning: reasonFromEvidence(initialEvidence, "blocked", normalized),
      answer: {
        type: "blocked",
        headline: "The request is understood, but the required execution path is not connected yet.",
        detail: [...unavailable.map(item => item.reason), ...blockedRouting.map(item => item.reason)].join(" ") + " BUSIQ will not invent the missing capability or data.",
        nextAction: "Connect the required source or implement/connect the required execution capability.",
      },
      trace: ["Normalize request", "Resolve required capabilities", "Route to suitable tools", "Plan research", "Verify available evidence", "Stop before unsupported execution"],
    };
  }

  const execution = routing
    .filter(route => route.state === "selected" && route.selectedToolId)
    .map(route => executeTool({
      toolId: route.selectedToolId as string,
      request: normalized,
      inputs: { request: normalized },
    }));

  const executionRecords = execution.map(result => {
    if (result.state === "success") {
      return { toolId: result.toolId, state: result.state, output: result.output };
    }
    return { toolId: result.toolId, state: result.state, reason: result.reason };
  });
  const executionEvidence = execution.flatMap(result => result.state === "success" ? result.evidence : []);
  const allEvidence = [...initialEvidence, ...executionEvidence];
  const executionBlocked = execution.filter(result => result.state === "blocked");
  const executionSucceeded = execution.length > 0 && executionBlocked.length === 0;
  const verification = verifyEvidence(allEvidence, researchPlan, 0, executionSucceeded, normalized);
  const reasoning = reasonFromEvidence(allEvidence, verification.state, normalized);

  if (executionBlocked.length) {
    return {
      ...base,
      status: "blocked",
      execution: executionRecords,
      evidence: allEvidence,
      verification,
      reasoning,
      answer: {
        type: "blocked",
        headline: "The request is understood, but execution stopped safely.",
        detail: executionBlocked.map(item => item.reason).join(" ") + " BUSIQ will not claim work was completed when an executor is missing.",
        nextAction: "Implement or connect the missing executor before continuing.",
      },
      trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve capabilities", "Route to suitable tools", "Execute available tools", "Verify execution evidence", "Stop on missing executor"],
    };
  }

  const planResult = execution.find(result => result.toolId === "local-plan-builder");
  const plan = planResult?.state === "success" ? planResult.output : undefined;
  return {
    ...base,
    status: "ready",
    execution: executionRecords,
    evidence: allEvidence,
    verification,
    reasoning,
    answer: {
      type: "execution-plan",
      headline: plan ? "BUSIQ created a real local plan structure." : "The request was resolved and executed through the available local capabilities.",
      detail: plan
        ? "The plan structure is deterministic and contains no invented business facts or external research."
        : "BUSIQ completed the available local execution path without claiming unsupported facts.",
      nextAction: plan ? "Review the plan structure, then connect business evidence when the next step requires real facts." : "Continue with the next available capability.",
    },
    trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve capabilities", "Route to suitable tools", "Plan research", "Execute available tools", "Verify execution evidence", "Return verified execution result"],
  };
}
