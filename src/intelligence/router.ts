import type { ResolvedIntent } from "../bie/intent";
import type { CapabilityRequirement } from "./types";
import { getTool, type ToolDescriptor } from "./tools";

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
  "business-data-retrieval": ["business-data-connector"],
  "external-research": ["external-research-connector"],
};

function routeOne(capabilityId: string): RoutingDecision {
  const candidates = capabilityToolMap[capabilityId] ?? [];
  const available = candidates
    .map(id => getTool(id))
    .filter((tool): tool is ToolDescriptor => Boolean(tool))
    .find(tool => tool.availability === "available");

  if (available) {
    return {
      capabilityId,
      selectedToolId: available.id,
      state: "selected",
      reason: "A suitable available tool satisfies this capability.",
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