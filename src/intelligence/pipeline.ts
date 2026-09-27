import { resolveIntent } from "../bie/intent";
import { detectAmbiguity } from "./ambiguity";
import { describeCapabilities } from "./capabilities";
import { buildResearchPlan } from "./research";
import { routeCapabilities } from "./router";
import type { IntelligencePipelineResult } from "./types";
import { verifyEvidence } from "./verify";

export function runIntelligencePipeline(request: string): IntelligencePipelineResult {
  const normalized = request.trim().replace(/\s+/g, " ");
  const intent = resolveIntent(normalized);
  const ambiguity = detectAmbiguity(normalized, intent);
  const capabilities = describeCapabilities(intent.requiredCapabilities, intent.needsBusinessData, intent.needsExternalResearch);
  const routing = routeCapabilities(intent);
  const researchPlan = buildResearchPlan(intent);
  const evidence = normalized ? [{ id: "request", kind: "user" as const, label: "User request", detail: normalized, source: "User input" }] : [];
  const verification = verifyEvidence(evidence, researchPlan, ambiguity.length);
  const unavailable = capabilities.filter(item => item.status === "unavailable");
  const blockedRouting = routing.filter(item => item.state === "blocked");
  const status = ambiguity.length
    ? "needs_clarification"
    : unavailable.length || blockedRouting.length
      ? "needs_connection"
      : "ready";

  if (ambiguity.length) return {
    request: normalized, status, intent, ambiguity, capabilities, researchPlan, routing, evidence, verification,
    answer: { type: "clarification", headline: ambiguity[0].question, detail: ambiguity[0].reason, nextAction: "Answer the clarification so BUSIQ can continue." },
    trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve candidate tools", "Stop before unsupported execution"],
  };
  if (unavailable.length || blockedRouting.length) return {
    request: normalized, status, intent, ambiguity, capabilities, researchPlan, routing, evidence, verification,
    answer: {
      type: "blocked",
      headline: "The request is understood, but the required execution path is not connected yet.",
      detail: [...unavailable.map(item => item.reason), ...blockedRouting.map(item => item.reason)].join(" ") + " BUSIQ will not invent the missing capability or data.",
      nextAction: "Connect the required source or implement/connect the required execution capability."
    },
    trace: ["Normalize request", "Resolve intent", "Resolve required capabilities", "Route to suitable tools", "Plan research", "Verify available evidence", "Stop before unsupported execution"],
  };
  return {
    request: normalized, status, intent, ambiguity, capabilities, researchPlan, routing, evidence, verification,
    answer: { type: "execution-plan", headline: "The request is clear and the required capabilities are available.", detail: "BUSIQ can proceed to the execution stage without claiming unsupported facts.", nextAction: "Execute the planned capability workflow." },
    trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve capabilities", "Route to suitable tools", "Plan research", "Verify evidence", "Proceed to execution"],
  };
}
