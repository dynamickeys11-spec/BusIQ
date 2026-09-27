export type PipelineStatus = "ready" | "needs_clarification" | "needs_connection" | "blocked";
export type EvidenceKind = "user" | "retrieved" | "verified" | "inferred";
export type CapabilityStatus = "available" | "unavailable";

export type EvidenceItem = {
  id: string; kind: EvidenceKind; label: string; detail: string; source: string;
};
export type AmbiguityIssue = {
  field: "subject" | "time" | "scope" | "goal"; reason: string; question: string;
};
export type CapabilityRequirement = { id: string; reason: string; status: CapabilityStatus; };
export type ResearchStep = {
  id: string; purpose: string;
  sourceClass: "business-data" | "external-research" | "specialist-tool" | "local-context";
  status: "required" | "available" | "blocked" | "not-required";
};
export type RoutingDecision = {
  capabilityId: string; selectedToolId?: string;
  state: "selected" | "blocked"; reason: string; requiredInputs: string[];
};
export type IntelligencePipelineResult = {
  request: string; status: PipelineStatus;
  intent: ReturnType<typeof import("../bie/intent").resolveIntent>;
  ambiguity: AmbiguityIssue[]; capabilities: CapabilityRequirement[]; researchPlan: ResearchStep[];
  routing: RoutingDecision[];
  evidence: EvidenceItem[];
  verification: { state: "not-run" | "passed" | "blocked"; checks: string[]; missingEvidence: string[]; };
  answer: { type: "clarification" | "execution-plan" | "blocked"; headline: string; detail: string; nextAction: string; };
  trace: string[];
};