export type PipelineStatus = "ready" | "needs_clarification" | "needs_connection" | "blocked";
export type EvidenceKind = "user" | "retrieved" | "verified" | "inferred";
export type CapabilityStatus = "available" | "unavailable";

export type EvidenceQuality = "strong" | "limited" | "unknown";
export type EvidenceDiagnosticCategory = "authority" | "freshness" | "verification" | "relevance" | "scope" | "conflict" | "sufficiency";
export type EvidenceSufficiency = "not-required" | "insufficient" | "sufficient";
export type EvidenceDiagnostic = { evidenceId?: string; category: EvidenceDiagnosticCategory; message: string; };

export type EvidenceScope = {
  businessId?: string;
  entityId?: string;
  geography?: string;
  periodStart?: string;
  periodEnd?: string;
};

export type EvidenceItem = {
  id: string; kind: EvidenceKind; label: string; detail: string; source: string; authority?: "user" | "connected-source" | "specialist-tool" | "unknown"; freshness?: "current" | "dated" | "unknown"; verification?: "unverified" | "verified"; evidenceDate?: string; scope?: EvidenceScope; relevance?: "direct" | "indirect" | "unknown"; quality?: EvidenceQuality;
};
export type RequestContext = { business?: string; time?: string; scope?: string; entities: string[]; };
export type IntentCandidate = { kind: string; score: number; reasons: string[]; };
export type AmbiguityIssue = {
  field: "subject" | "time" | "scope" | "goal"; reason: string; question: string;
};
export type CapabilityRequirement = { id: string; reason: string; status: CapabilityStatus; };
export type ResearchStep = {
  id: string; purpose: string;
  sourceClass: "business-data" | "external-research" | "specialist-tool" | "local-context";
  status: "required" | "available" | "blocked" | "not-required";
  evidenceRequired: boolean;
};
export type RoutingDecision = {
  capabilityId: string; selectedToolId?: string;
  state: "selected" | "blocked"; reason: string; requiredInputs: string[];
};
export type ExecutionRecord = {
  toolId: string;
  state: "success" | "blocked";
  reason?: string;
  output?: unknown;
};
export type ReasoningType = "FACT" | "FINDING" | "INFERENCE" | "RECOMMENDATION";
export type ReasoningConclusion = {
  type: ReasoningType;
  statement: string;
  evidenceIds: string[];
  dependsOn?: string[];
  support: "supported" | "insufficient";
};
export type ReasoningChain = { conclusionId: string; type: ReasoningType; evidenceIds: string[]; dependsOn: string[]; };
export type ReasoningResult = {
  state: "ready" | "insufficient";
  conclusions: ReasoningConclusion[];
  limitations: string[];
  chains?: ReasoningChain[];
};

export type IntelligencePipelineResult = {
  request: string; status: PipelineStatus;
  intent: ReturnType<typeof import("../bie/intent").resolveIntent>;
  ambiguity: AmbiguityIssue[]; capabilities: CapabilityRequirement[]; researchPlan: ResearchStep[];
  routing: RoutingDecision[];
  researchAssessment?: import("./research-assessment").ResearchAssessment;
  researchStopping?: import("./research-assessment").ResearchStoppingDecision;
  execution: ExecutionRecord[];
  evidence: EvidenceItem[];
  verification: { state: "not-run" | "passed" | "blocked"; checks: string[]; missingEvidence: string[]; diagnostics?: EvidenceDiagnostic[]; sufficiency?: EvidenceSufficiency; };
  reasoning: ReasoningResult;
  answer: { type: "clarification" | "execution-plan" | "blocked"; headline: string; detail: string; nextAction: string; };
  trace: string[];
};
