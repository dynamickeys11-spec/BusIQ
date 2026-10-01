import type { EvidenceItem } from "./types";

export type ToolAvailability = "available" | "unavailable";
export type SourceClass = "business-data" | "external-research" | "specialist-tool" | "local-context";
export type ToolSideEffect = "none" | "read" | "write";

export type ToolDescriptor = {
  id: string;
  label: string;
  purpose: string;
  accepts: string[];
  doesNotAccept: string[];
  requiredInputs: string[];
  outputType: string;
  evidenceBehavior: "produces-evidence" | "transforms-evidence" | "no-evidence";
  sourceClass: SourceClass;
  availability: ToolAvailability;
  sideEffect: ToolSideEffect;
  authorizationRequired: boolean;
  freshness: "static" | "current" | "near-real-time";
};

export type ToolExecutionRequest = {
  toolId: string;
  request: string;
  inputs: Record<string, unknown>;
  authorization?: { granted: boolean; scope?: string };
};

export type ToolExecutionResult =
  | { state: "success"; toolId: string; evidence: EvidenceItem[]; output: unknown }
  | { state: "blocked"; toolId: string; reason: string; missingInputs: string[] };

const tools: ToolDescriptor[] = [
  {
    id: "explanation-tool",
    label: "Evidence-bounded explanation",
    purpose: "Prepare a clear explanation request without requiring business records.",
    accepts: ["explanation request", "user-provided context"],
    doesNotAccept: ["unsupported current business facts"],
    requiredInputs: ["request"],
    outputType: "explanation-request",
    evidenceBehavior: "no-evidence",
    sourceClass: "local-context",
    availability: "available",
    sideEffect: "none",
    authorizationRequired: false,
    freshness: "static",
  },
  {
    id: "local-context",
    label: "Local context",
    purpose: "Use information already present in the request and local BUSIQ context.",
    accepts: ["request context", "saved local context"],
    doesNotAccept: ["unconnected business records", "external current facts"],
    requiredInputs: ["request"],
    outputType: "context",
    evidenceBehavior: "produces-evidence",
    sourceClass: "local-context",
    availability: "available",
    sideEffect: "none",
    authorizationRequired: false,
    freshness: "static",
  },
  {
    id: "deterministic-intent",
    label: "Deterministic intent resolver",
    purpose: "Classify the user's requested outcome and required capabilities.",
    accepts: ["natural-language request"],
    doesNotAccept: ["unsupported factual claims"],
    requiredInputs: ["request"],
    outputType: "resolved-intent",
    evidenceBehavior: "transforms-evidence",
    sourceClass: "local-context",
    availability: "available",
    sideEffect: "none",
    authorizationRequired: false,
    freshness: "static",
  },
  {
    id: "local-plan-builder",
    label: "Local plan builder",
    purpose: "Turn a clear request into a deterministic execution structure without inventing business facts.",
    accepts: ["clear planning request"],
    doesNotAccept: ["current business metrics", "external market facts"],
    requiredInputs: ["request"],
    outputType: "plan",
    evidenceBehavior: "transforms-evidence",
    sourceClass: "local-context",
    availability: "available",
    sideEffect: "none",
    authorizationRequired: false,
    freshness: "static",
  },
  {
    id: "business-data-connector",
    label: "Business data connector",
    purpose: "Retrieve connected business records such as sales, money, customers, products, inventory, or operations.",
    accepts: ["connected business systems"],
    doesNotAccept: ["invented or inferred records"],
    requiredInputs: ["connection", "query"],
    outputType: "business-records",
    evidenceBehavior: "produces-evidence",
    sourceClass: "business-data",
    availability: "unavailable",
    sideEffect: "read",
    authorizationRequired: true,
    freshness: "current",
  },
  {
    id: "external-research-connector",
    label: "External research connector",
    purpose: "Retrieve current external evidence from configured research sources.",
    accepts: ["web research", "configured external sources"],
    doesNotAccept: ["unsupported current claims"],
    requiredInputs: ["research query", "source"],
    outputType: "research-evidence",
    evidenceBehavior: "produces-evidence",
    sourceClass: "external-research",
    availability: "unavailable",
    sideEffect: "read",
    authorizationRequired: false,
    freshness: "current",
  },
];

export function listTools(): ToolDescriptor[] {
  return tools.map(tool => ({ ...tool, accepts: [...tool.accepts], doesNotAccept: [...tool.doesNotAccept], requiredInputs: [...tool.requiredInputs] }));
}

export function getTool(id: string): ToolDescriptor | undefined {
  return tools.find(tool => tool.id === id);
}
