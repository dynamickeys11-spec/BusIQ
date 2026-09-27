import type { CapabilityRequirement } from "./types";

const localCapabilities = new Set([
  "intent-resolution",
  "business-context",
  "business-analysis",
  "comparison",
  "evidence-review",
  "planning",
  "content-generation",
  "explanation",
  "monitoring",
]);

const capabilityNames: Record<string, string> = {
  "intent-resolution": "Intent resolution",
  "business-context": "Business context",
  "business-data-retrieval": "Business data retrieval",
  "business-analysis": "Business analysis",
  comparison: "Comparison",
  "evidence-review": "Evidence review",
  planning: "Planning",
  "content-generation": "Content generation",
  explanation: "Explanation",
  monitoring: "Monitoring",
  "external-research": "External research",
};

export function describeCapabilities(ids: string[], needsBusinessData: boolean, needsExternalResearch: boolean): CapabilityRequirement[] {
  const required = new Set(ids);
  required.add("intent-resolution");
  if (needsBusinessData) required.add("business-data-retrieval");
  if (needsExternalResearch) required.add("external-research");
  return [...required].map(id => ({
    id,
    reason: capabilityNames[id] ?? id,
    status: localCapabilities.has(id) ? "available" : "unavailable",
  }));
}

export function capabilityLabel(id: string): string {
  return capabilityNames[id] ?? id;
}