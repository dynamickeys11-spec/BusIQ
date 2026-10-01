import { resolveIntent } from "../bie/intent.js";
import { detectAmbiguity } from "./ambiguity.js";
import { describeCapabilities } from "./capabilities.js";
import { buildResearchPlan } from "./research.js";
import { executeTool } from "./execution.js";
import { routeCapabilities } from "./router.js";
import { verifyEvidence } from "./verify.js";
import { reasonFromEvidence } from "./reasoning.js";
import { validateToolResult } from "./result-validation.js";
import { assessResearchEvidence, decideResearchStopping } from "./research-assessment.js";
import { validateAnswerQuality } from "./answer-quality.js";
import { buildActionDecision, getActionForKind, resolveActionRequest } from "./actions.js";
import { flattenContext, selectRelevantContext } from "./context.js";
import { buildBusinessWorldModel } from "./world-model.js";
import { buildInvestigationPlan } from "./investigation.js";
import { assessEvidence } from "./evidence-engine.js";
import { diagnoseSales } from "./business-diagnostics.js";
import type { ContextState, ContextEntry } from "./context.js";
import type { IntelligencePipelineResult } from "./types.js";

export type IntelligencePipelineOptions = {
  context?: ContextState | ContextEntry[];
  now?: Date;
  externalEvidence?: import("./types.js").EvidenceItem[];
  businessEvidence?: import("./types.js").EvidenceItem[];
  businessRecords?: import("../business-data/types.js").NormalizedRecord[];
};

function finalizeResult(result: IntelligencePipelineResult, businessRecords: import("../business-data/types.js").NormalizedRecord[] = []): IntelligencePipelineResult {
  const evidenceAssessment = assessEvidence(result.evidence);
  const worldModel = buildBusinessWorldModel(businessRecords, result.evidence, result.contextUsed ?? []);
  return {
    ...result,
    worldModel,
    investigation: buildInvestigationPlan(result.request, worldModel, result.evidence),
    verification: { ...result.verification, diagnostics: [...(result.verification.diagnostics ?? []), ...evidenceAssessment.diagnostics], sufficiency: evidenceAssessment.sufficiency, completeness: evidenceAssessment.completeness, contradictions: evidenceAssessment.contradictions },
    answerQuality: validateAnswerQuality(result),
  };
}

export function runIntelligencePipeline(request: string, options: IntelligencePipelineOptions = {}): IntelligencePipelineResult {
  const normalized = request.trim().replace(/\s+/g, " ");
  const intent = resolveIntent(normalized);
  const contextEntries = Array.isArray(options.context) ? options.context : options.context ? flattenContext(options.context) : [];
  const contextUsed = normalized ? selectRelevantContext(contextEntries, normalized, options.now) : [];
  const contextSummary = contextUsed.length ? ` ${contextUsed.length} usable persistent context item(s) informed planning; persistent context is not treated as verified evidence.` : "";
  const ambiguity = detectAmbiguity(normalized, intent);
  const capabilities = describeCapabilities(intent.requiredCapabilities, intent.needsBusinessData, intent.needsExternalResearch);
  const routing = routeCapabilities(intent);
  const action = resolveActionRequest(normalized);
  const actionDefinition = action ? getActionForKind(action.kind) : undefined;
  const actionDecision = actionDefinition ? buildActionDecision(actionDefinition) : undefined;
  const researchPlan = buildResearchPlan(intent).map((step) => {
    if (step.id === "external-research" && options.externalEvidence?.length) {
      return { ...step, status: "available" as const };
    }
    if (
      options.businessEvidence?.length &&
      (step.sourceClass === "business-data" || step.id === "business-data")
    ) {
      return { ...step, status: "available" as const };
    }
    return step;
  });
  const initialEvidence = normalized
    ? [{ id: "request", kind: "user" as const, label: "User request", detail: normalized, source: "User input" }]
    : [];
  const initialResearchAssessment = intent.needsExternalResearch ? assessResearchEvidence(initialEvidence) : undefined;
  const initialResearchStopping = initialResearchAssessment ? decideResearchStopping(initialResearchAssessment, 0) : undefined;
  const unavailable = capabilities.filter(
    item => item.status === "unavailable" &&
      !(item.id === "external-research" && options.externalEvidence?.length) &&
      !(item.id === "business-data-retrieval" && options.businessEvidence?.length) &&
      !(["sales","customers","money","expenses","products","inventory","suppliers","people","operations","marketing","projects"].includes(item.id) && options.businessEvidence?.length),
  );
  const actionBlocked = actionDecision?.state === "blocked" && actionDecision.action.availability === "unavailable";
  const externalEvidence = options.externalEvidence ?? [];
  const businessEvidence = options.businessEvidence ?? [];
  const businessRecords = options.businessRecords ?? [];
  const liveEvidenceMissing =
    (intent.needsExternalResearch && !(options.externalEvidence?.length)) ||
    (intent.needsBusinessData && !(options.businessEvidence?.length));
  const blockedRouting = routing.filter(
    item => item.state === "blocked" &&
      !(item.capabilityId === "external-research" && options.externalEvidence?.length) &&
      !(item.capabilityId === "business-data-retrieval" && options.businessEvidence?.length) &&
      !(["sales","customers","money","expenses","products","inventory","suppliers","people","operations","marketing","projects"].includes(item.capabilityId) && options.businessEvidence?.length),
  );
  const base = {
    request: normalized, intent, ambiguity, capabilities, researchPlan, routing, contextUsed,
  };
  const finish = (result: IntelligencePipelineResult) => finalizeResult(result, businessRecords);

  if (ambiguity.length) {
    return finish({
      ...base,
      status: "needs_clarification",
      execution: [],
      evidence: initialEvidence,
      verification: verifyEvidence(initialEvidence, researchPlan, ambiguity.length, false, normalized),
      researchAssessment: initialResearchAssessment,
      researchStopping: initialResearchStopping,
      reasoning: reasonFromEvidence(initialEvidence, "blocked", normalized),
      answer: {
        type: "clarification",
        headline: ambiguity[0].question,
        detail: ambiguity[0].reason + contextSummary,
        nextAction: "Answer the clarification so BUSIQ can continue.",
      },
      trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve candidate tools", "Stop before unsupported execution"],
    });
  }

  if (unavailable.length || blockedRouting.length || actionBlocked || liveEvidenceMissing) {
    return finish({
      ...base,
      status: "needs_connection",
      execution: [],
      evidence: initialEvidence,
      verification: verifyEvidence(initialEvidence, researchPlan, 0, false, normalized),
      researchAssessment: initialResearchAssessment,
      researchStopping: initialResearchStopping,
      reasoning: reasonFromEvidence(initialEvidence, "blocked", normalized),
      answer: {
        type: "blocked",
        headline: "The request is understood, but the required execution path is not connected yet.",
        detail: [
        ...unavailable.map(item => item.reason),
        ...blockedRouting.map(item => item.reason),
        ...(actionBlocked && actionDecision ? [actionDecision.reason] : []),
        ...(intent.needsExternalResearch && !options.externalEvidence?.length ? ["Live external research evidence is required before BUSIQ can complete this request."] : []),
        ...(intent.needsBusinessData && !options.businessEvidence?.length ? ["Connected business evidence is required before BUSIQ can complete this request."] : []),
      ].join(" ") + " BUSIQ will not invent the missing capability, connection, or action result." + contextSummary,
        nextAction: "Connect the required source or implement/connect the required execution capability.",
      },
      trace: ["Normalize request", "Resolve required capabilities", "Route to suitable tools", "Plan research", "Verify available evidence", "Stop before unsupported execution"],
    });
  }

  const execution = routing
    .filter(route => route.state === "selected" && route.selectedToolId)
    .filter(route => !(
      (route.capabilityId === "business-data-retrieval" && businessEvidence.length) ||
      (route.capabilityId === "external-research" && externalEvidence.length) ||
      (["sales","customers","money","expenses","products","inventory","suppliers","people","operations","marketing","projects"].includes(route.capabilityId) && businessEvidence.length)
    ))
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
  const validatedExecution = execution.map(validateToolResult);
  const executionEvidence = validatedExecution.flatMap(result => result.state === "success" ? result.evidence : []);
  const allEvidence = [...initialEvidence, ...externalEvidence, ...businessEvidence, ...executionEvidence];

  const executionBlocked = validatedExecution.filter(result => result.state === "blocked");
  const executionSucceeded =
    executionBlocked.length === 0 &&
    (validatedExecution.length > 0 || externalEvidence.length > 0 || businessEvidence.length > 0 || !intent.needsBusinessData && !intent.needsExternalResearch);
  const verification = verifyEvidence(allEvidence, researchPlan, 0, executionSucceeded, normalized);
  const researchAssessment = intent.needsExternalResearch ? assessResearchEvidence(allEvidence) : undefined;
  const researchStopping = researchAssessment ? decideResearchStopping(researchAssessment, new Set(allEvidence.filter(item => item.kind === "retrieved" || item.kind === "verified").map(item => item.source)).size) : undefined;
  const reasoning = reasonFromEvidence(allEvidence, verification.state, normalized, businessRecords);
  const salesDiagnosis = verification.state === "passed" ? diagnoseSales(businessRecords, normalized) : undefined;
  if (salesDiagnosis) {
    reasoning.conclusions.push(salesDiagnosis.conclusion);
    reasoning.limitations.push("Sales diagnosis uses only the supplied normalized sales records and does not establish external or causal explanations.");
  }

  if (executionBlocked.length) {
    return finish({
      ...base,
      status: "blocked",
      execution: [
        ...executionRecords,
        ...(externalEvidence.length
          ? [{ toolId: "external-research-connector", state: "success" as const, output: { sourceCount: externalEvidence.length } }]
          : []),
        ...(businessEvidence.length
          ? [{ toolId: "business-data-connector", state: "success" as const, output: { recordCount: businessEvidence.length } }]
          : []),
      ],
      evidence: allEvidence,
      verification,
      researchAssessment,
      researchStopping,
      reasoning,
      answer: {
        type: "blocked",
        headline: "The request is understood, but execution stopped safely.",
        detail: executionBlocked.map(item => item.reason).join(" ") + " BUSIQ will not claim work was completed when an executor is missing." + contextSummary,
        nextAction: "Implement or connect the missing executor before continuing.",
      },
      trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve capabilities", "Route to suitable tools", "Execute available tools", "Verify execution evidence", "Stop on missing executor"],
    });
  }

  const planResult = execution.find(result => result.toolId === "local-plan-builder");
  const plan = planResult?.state === "success" ? planResult.output : undefined;
  return finish({
    ...base,
    status: "ready",
    execution: [
      ...executionRecords,
      ...(externalEvidence.length
        ? [{ toolId: "external-research-connector", state: "success" as const, output: { sourceCount: externalEvidence.length } }]
        : []),
      ...(businessEvidence.length
        ? [{ toolId: "business-data-connector", state: "success" as const, output: { recordCount: businessEvidence.length } }]
        : []),
    ],
    evidence: allEvidence,
    verification,
    researchAssessment,
    researchStopping,
    reasoning,
    answer: {
      type: "execution-plan",
      headline: plan ? "BUSIQ created a real local plan structure." : "The request was resolved and executed through the available local capabilities.",
      detail: (plan
        ? "The plan structure is deterministic and contains no invented business facts or external research."
        : "BUSIQ completed the available local execution path without claiming unsupported facts.") + contextSummary,
      nextAction: plan ? "Review the plan structure, then connect business evidence when the next step requires real facts." : "Continue with the next available capability.",
    },
    trace: ["Normalize request", "Resolve intent", "Load usable persistent context", "Check material ambiguity", "Resolve capabilities", "Route to suitable tools", "Plan research", "Execute available tools", "Verify execution evidence", "Return verified execution result"],
  });
}
