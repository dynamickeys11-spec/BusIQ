import type { ResolvedIntent } from "../bie/intent.js";
import type { CapabilityRequirement } from "./types.js";
import { getTool, type ToolDescriptor } from "./tools.js";
import { getCapability } from "./capabilities.js";

export type RoutingDecision = {
  capabilityId: string;
  selectedToolId?: string;
  state: "selected" | "blocked";
  reason: string;
  requiredInputs: string[];
};

const capabilityToolMap: Record<string, string[]> = {
  "intent-resolution": ["deterministic-intent"],
  "business-context": ["local-context"],
  "planning": ["local-plan-builder"],
  "business-data-retrieval": ["business-data-connector"],
  "external-research": ["external-research-connector"],
};

function routeOne(capabilityId: string): RoutingDecision {
  const candidates = getCapability(capabilityId)?.suitableTools ?? capabilityToolMap[capabilityId] ?? [];
  if (!candidates.length) return { capabilityId, state: "blocked", reason: "No registered tool is suitable for this capability.", requiredInputs: [] };
  const available = candidates
    .filter(id => Boolean(getTool(id)))
    .map(id => getTool(id))
    .filter((tool): tool is ToolDescriptor => Boolean(tool))
    .find(tool => tool.availability === "available");

  if (available) {
    return {
      capabilityId,
      selectedToolId: available.id,
      state: "selected",
      reason: `Selected ${available.label} because it is registered as suitable for this capability and is currently available.`,
      requiredInputs: available.requiredInputs,
    };
  }

  const first = candidates[0] ? getTool(candidates[0]) : undefined;
  return {
    capabilityId,
    state: "blocked",
    reason: first
      ? `No available tool can currently satisfy this capability: ${first.label} is not connected.`
      : "No tool is registered for this capability.",
    requiredInputs: first?.requiredInputs ?? [],
  };
}

export function routeCapabilities(
  intentOrCapabilities: ResolvedIntent | CapabilityRequirement[],
): RoutingDecision[] {
  const capabilities = Array.isArray(intentOrCapabilities)
    ? intentOrCapabilities.map(item => item.id)
    : [
        ...intentOrCapabilities.requiredCapabilities,
        ...(intentOrCapabilities.needsBusinessData ? ["business-data-retrieval"] : []),
        ...(intentOrCapabilities.needsExternalResearch ? ["external-research"] : []),
      ];

  return [...new Set(capabilities)].map(routeOne);
}
