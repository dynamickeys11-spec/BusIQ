import { resolveIntent } from "../bie/intent.js";
import type { ResolvedIntent } from "../bie/intent.js";
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
import { flattenContext, selectRelevantContext, resolveSemanticContext } from "./context.js";
import { buildBusinessWorldModel } from "./world-model.js";
import { buildInvestigationPlan } from "./investigation.js";
import { assessEvidence } from "./evidence-engine.js";
import { diagnoseSales } from "./business-diagnostics.js";
import { buildSemanticModel } from "./semantic-model.js";
import { semanticInterpretationToUnderstanding, understandRequest } from "./semantic-understanding.js";
import type { ModelSemanticInterpretation } from "./semantic-interpreter.js";
import { buildBusinessDigitalTwin } from "./digital-twin.js";
import type { ContextState, ContextEntry } from "./context.js";
import type { IntelligencePipelineResult } from "./types.js";
import { planCapabilities } from "./capability-planner.js";
import { applyExecutionNodeResults, buildCapabilityExecutionGraph } from "./execution-graph.js";

export type IntelligencePipelineOptions = {
  context?: ContextState | ContextEntry[];
  now?: Date;
  externalEvidence?: import("./types.js").EvidenceItem[];
  businessEvidence?: import("./types.js").EvidenceItem[];
  businessRecords?: import("../business-data/types.js").NormalizedRecord[];
  intentOverride?: ResolvedIntent;
  semanticInterpretation?: ModelSemanticInterpretation;
};

function finalizeResult(result: IntelligencePipelineResult, businessRecords: import("../business-data/types.js").NormalizedRecord[] = [], semanticInterpretation?: ModelSemanticInterpretation): IntelligencePipelineResult {
  const evidenceAssessment = assessEvidence(result.evidence);
  const worldModel = buildBusinessWorldModel(businessRecords, result.evidence, result.contextUsed ?? []);
  const semanticContext = (result.contextUsed ?? []).filter(entry => entry.kind === "conversation");
  const priorRequest = semanticContext.find(entry => entry.key === "last-request")?.value;
  const semanticUnderstanding = semanticInterpretation
    ? semanticInterpretationToUnderstanding(result.request, semanticInterpretation)
    : understandRequest(result.request, result.intent, priorRequest, semanticContext.map(entry => ({ key: entry.key, value: entry.value })));
  const priorPossibilities = (result.contextUsed ?? [])
    .filter(entry => entry.kind === "conversation" && entry.key.startsWith("possibility:"))
    .map(entry => {
      try { return JSON.parse(entry.value) as import("./semantic-model.js").PossibilityMemory; } catch { return undefined; }
    })
    .filter((item): item is import("./semantic-model.js").PossibilityMemory => Boolean(item));
  const semanticModel = buildSemanticModel(
    result.request,
    result.evidence,
    result.intent.kind,
    result.reasoning.conclusions.map(conclusion => conclusion.type),
    priorPossibilities,
    semanticInterpretation ? { businessStage: semanticInterpretation.businessStage, desiredOutcome: semanticInterpretation.desiredOutcome } : undefined,
  );
  const investigation = buildInvestigationPlan(result.request, worldModel, result.evidence, semanticModel);
  const digitalTwin = buildBusinessDigitalTwin(businessRecords, result.evidence, worldModel);
  return {
    ...result,
    semanticUnderstanding,
    semanticModel,
    worldModel,
    investigation,
    digitalTwin,
    verification: { ...result.verification, diagnostics: [...(result.verification.diagnostics ?? []), ...evidenceAssessment.diagnostics], sufficiency: evidenceAssessment.sufficiency, completeness: evidenceAssessment.completeness, contradictions: evidenceAssessment.contradictions },
    answerQuality: validateAnswerQuality(result),
  };
}

export function runIntelligencePipeline(request: string, options: IntelligencePipelineOptions = {}): IntelligencePipelineResult {
  const normalized = request.trim().replace(/\s+/g, " ");
  const intent = options.intentOverride ?? resolveIntent(normalized);
  const contextEntries = Array.isArray(options.context) ? options.context : options.context ? flattenContext(options.context) : [];
  const semanticContextResolution = options.semanticInterpretation
    ? resolveSemanticContext(options.semanticInterpretation.references, contextEntries, options.now)
    : undefined;
  const contextUsed = semanticContextResolution?.entries ?? (normalized ? selectRelevantContext(contextEntries, normalized, options.now) : []);
  const contextSummary = contextUsed.length ? ` ${contextUsed.length} usable persistent context item(s) informed planning; persistent context is not treated as verified evidence.` : "";
  const ambiguity = detectAmbiguity(normalized, intent);
  const capabilities = describeCapabilities(intent.requiredCapabilities, intent.needsBusinessData, intent.needsExternalResearch);
  const capabilityPlan = options.semanticInterpretation
    ? planCapabilities(options.semanticInterpretation, semanticContextResolution ?? { entries: [], references: [], unresolvedReferences: [], summary: [] }, [...(options.businessEvidence ?? []), ...(options.externalEvidence ?? [])])
    : undefined;
  const executionGraph = options.semanticInterpretation
    ? buildCapabilityExecutionGraph(options.semanticInterpretation, semanticContextResolution ?? { entries: [], references: [], unresolvedReferences: [], summary: [] }, [...(options.businessEvidence ?? []), ...(options.externalEvidence ?? [])])
    : undefined;
  const routing = options.semanticInterpretation ? routeCapabilities(options.intentOverride ?? intent) : routeCapabilities(intent);
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
  const businessCapabilityIds = new Set([
    "business-data-retrieval","business-analysis","evidence-review",
    "sales","customers","money","expenses","products","inventory",
    "suppliers","people","operations","marketing","projects",
  ]);
  const unavailable = capabilities.filter(
    item => item.status === "unavailable" &&
      !(item.id === "external-research" && options.externalEvidence?.length) &&
      !(businessCapabilityIds.has(item.id) && options.businessEvidence?.length),
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
      !(businessCapabilityIds.has(item.capabilityId) && options.businessEvidence?.length),
  );
  const base = {
    request: normalized, intent, ambiguity, capabilities, researchPlan, routing, contextUsed, contextResolution: semanticContextResolution, capabilityPlan, executionGraph,
  };
  const finish = (result: IntelligencePipelineResult) => finalizeResult(result, businessRecords, options.semanticInterpretation);

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
      trace: ["Normalize request", "Resolve required capabilities", "Resolve context", "Build capability execution graph", "Inspect graph blockers", "Stop before unsupported execution"],
    });
  }

  let activeExecutionGraph = executionGraph;
  const execution: Array<ReturnType<typeof executeTool>> = [];
  const validatedExecution: Array<ReturnType<typeof validateToolResult>> = [];

  const executeRoute = (route: (typeof routing)[number]) => {
    const result = executeTool({
      toolId: route.selectedToolId as string,
      request: normalized,
      inputs: { request: normalized },
    });
    execution.push(result);
    const validated = validateToolResult(result);
    validatedExecution.push(validated);
    if (activeExecutionGraph) {
      const nodeResult = {
        nodeId: route.capabilityId,
        state: validated.state === "success" ? "success" as const : "blocked" as const,
        evidenceIds: validated.state === "success" ? validated.evidence.map(item => item.id) : [],
        output: validated.state === "success" ? validated.output : undefined,
        reason: validated.state === "success" ? undefined : validated.reason,
      };
      activeExecutionGraph = applyExecutionNodeResults(activeExecutionGraph, [nodeResult]);
    }
  };

  if (activeExecutionGraph) {
    for (const stage of activeExecutionGraph.stages) {
      const stageNodes = stage
        .map(capabilityId => activeExecutionGraph?.nodes.find(node => node.capabilityId === capabilityId))
        .filter((node): node is NonNullable<typeof node> => Boolean(node));

      for (const node of stageNodes) {
        if (node.status !== "ready") continue;
        const route = routing.find(item => item.capabilityId === node.capabilityId);
        if (!route || route.state !== "selected" || !route.selectedToolId) continue;
        if (
          (route.capabilityId === "business-data-retrieval" && businessEvidence.length) ||
          (route.capabilityId === "external-research" && externalEvidence.length) ||
          (["sales","customers","money","expenses","products","inventory","suppliers","people","operations","marketing","projects"].includes(route.capabilityId) && businessEvidence.length)
        ) continue;
        executeRoute(route);
        if (activeExecutionGraph?.terminalState === "blocked") break;
      }
      if (activeExecutionGraph?.terminalState === "blocked") break;
    }
  } else {
    for (const route of routing) {
      if (route.state !== "selected" || !route.selectedToolId) continue;
      executeRoute(route);
    }
  }

  const executionRecords = execution.map(result => {
    if (result.state === "success") {
      return { toolId: result.toolId, state: result.state, output: result.output };
    }
    return { toolId: result.toolId, state: result.state, reason: result.reason };
  });
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
      trace: ["Normalize request", "Resolve intent", "Check material ambiguity", "Resolve context", "Build capability execution graph", "Execute available graph nodes", "Verify execution evidence", "Stop on missing executor"],
    });
  }

  const planResult = execution.find(result => result.toolId === "local-plan-builder");
  const plan = planResult?.state === "success" ? planResult.output : undefined;
  return finish({
    ...base,
    executionGraph: activeExecutionGraph,
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
    trace: ["Normalize request", "Resolve intent", "Load usable persistent context", "Check material ambiguity", "Resolve context", "Build capability execution graph", "Execute graph stages", "Verify execution evidence", "Return verified execution result"],
  });
}
