import { resolveIntent } from "../bie/intent";
import { detectAmbiguity } from "./ambiguity";
import { describeCapabilities } from "./capabilities";
import { buildResearchPlan } from "./research";
import type { IntelligencePipelineResult } from "./types";
import { verifyEvidence } from "./verify";

export function runIntelligencePipeline(request: string): IntelligencePipelineResult {
  const normalized = request.trim().replace(/\s+/g, " ");
  const intent = resolveIntent(normalized);
  const ambiguity = detectAmbiguity(normalized, intent);
  const capabilities = describeCapabilities(intent.requiredCapabilities, intent.needsBusinessData, intent.needsExternalResearch);
  const researchPlan = buildResearchPlan(intent);
  const evidence = normalized ? [{ id: "request", kind: "user" as const, label: "User request", detail: normalized, source: "User input" }] : [];
  const verification = verifyEvidence(evidence, researchPlan, ambiguity.length);
  const unavailable = capabilities.filter(item => item.status === "unavailable");
  const status = ambiguity.length ? "needs_clarification" : unavailable.length ? "needs_connection" : "ready";

  if (ambiguity.length) return {
    request: normalized, status, intent, ambiguity, capabilities, researchPlan, evidence, verification,
    answer: { type: "clarification", headline: ambiguity[0].question, detail: ambiguity[0].reason, nextAction: "Answer the clarification so BUSIQ can continue." },
    trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Stop before unsupported execution"],
  };
  if (unavailable.length) return {
    request: normalized, status, intent, ambiguity, capabilities, researchPlan, evidence, verification,
    answer: { type: "blocked", headline: "The request is understood, but execution is not connected yet.", detail: unavailable.map(item => item.reason).join(", ") + " is required for this request. BUSIQ will not invent the missing data.", nextAction: "Connect the required source or provide the needed evidence." },
    trace: ["Normalize request", "Resolve intent", "Resolve required capabilities", "Plan research", "Verify available evidence", "Stop before unsupported execution"],
  };
  return {
    request: normalized, status, intent, ambiguity, capabilities, researchPlan, evidence, verification,
    answer: { type: "execution-plan", headline: "The request is clear and the required capabilities are available.", detail: "BUSIQ can proceed to the execution stage without claiming unsupported facts.", nextAction: "Execute the planned capability workflow." },
    trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve capabilities", "Plan research", "Verify evidence", "Proceed to execution"],
  };
}