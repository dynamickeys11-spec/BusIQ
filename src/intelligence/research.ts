import type { ResolvedIntent } from "../bie/intent";
import type { ResearchStep } from "./types";

export function buildResearchPlan(intent: ResolvedIntent): ResearchStep[] {
  const steps: ResearchStep[] = [{
    id: "context",
    purpose: "Use known business and request context before seeking new information.",
    sourceClass: "local-context",
    status: "available",
    evidenceRequired: false,
  }];
  if (intent.needsBusinessData) steps.push({
    id: "business-data",
    purpose: "Retrieve the business records required to answer the request.",
    sourceClass: "business-data",
    status: "blocked",
    evidenceRequired: true,
  });
  if (intent.needsExternalResearch) steps.push({
    id: "external-research",
    purpose: "Retrieve current external evidence relevant to the request.",
    sourceClass: "external-research",
    status: "blocked",
    evidenceRequired: true,
  });
  if (!intent.needsBusinessData && !intent.needsExternalResearch) steps.push({
    id: "no-research",
    purpose: "No external or business-data retrieval is required by the current request.",
    sourceClass: "local-context",
    status: "not-required",
    evidenceRequired: false,
  });
  return steps;
}