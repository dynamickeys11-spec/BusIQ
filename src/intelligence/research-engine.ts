import type { ResolvedIntent } from "../bie/intent.js";
import type { ResearchStep } from "./types.js";

export type ResearchQuery = {
  query: string;
  intent: ResolvedIntent["kind"];
  time?: string;
  entities: string[];
  requiredSourceClasses: string[];
};

export type ResearchSource = {
  id: string;
  label: string;
  authority: "primary" | "secondary";
  freshness: "current" | "dated";
  supports: string[];
};

export const researchSources: ResearchSource[] = [
  { id: "external-research-connector", label: "Configured external research connector", authority: "secondary", freshness: "current", supports: ["market", "competitor", "industry", "trend", "regulation", "benchmark"] },
];

export function generateResearchQuery(intent: ResolvedIntent): ResearchQuery {
  return {
    query: intent.normalizedRequest,
    intent: intent.kind,
    time: intent.context?.time,
    entities: intent.context?.entities ?? [],
    requiredSourceClasses: intent.needsExternalResearch ? ["external-research"] : [],
  };
}

export function selectResearchSources(query: ResearchQuery): ResearchSource[] {
  return researchSources.filter(source => query.requiredSourceClasses.includes("external-research") && source.supports.some(item => query.query.toLowerCase().includes(item)));
}

export function researchPlanFor(intent: ResolvedIntent): ResearchStep[] {
  const steps: ResearchStep[] = [{
    id: "context",
    purpose: "Use known request context before seeking new information.",
    sourceClass: "local-context",
    status: "available",
    evidenceRequired: false,
  }];
  if (intent.needsBusinessData) steps.push({
    id: "business-data", purpose: "Retrieve business records required by the request.",
    sourceClass: "business-data", status: "blocked", evidenceRequired: true,
  });
  if (intent.needsExternalResearch) steps.push({
    id: "external-research", purpose: "Retrieve current external evidence from a configured source selected for the request.",
    sourceClass: "external-research", status: selectResearchSources(generateResearchQuery(intent)).length ? "blocked" : "blocked",
    evidenceRequired: true,
  });
  if (!intent.needsBusinessData && !intent.needsExternalResearch) steps.push({
    id: "no-research", purpose: "No external or business-data retrieval is required.",
    sourceClass: "local-context", status: "not-required", evidenceRequired: false,
  });
  return steps;
}
