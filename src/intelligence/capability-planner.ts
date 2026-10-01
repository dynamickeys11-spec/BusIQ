import type { ModelSemanticInterpretation } from "./semantic-interpreter.js";
import { getCapability, listCapabilities } from "./capabilities.js";
import type { ContextResolution } from "./context-resolver.js";
import type { CapabilityRequirement } from "./types.js";

export type CapabilityPlanStep = {
  capabilityId: string;
  reason: string;
  dependencies: string[];
  requiredInputs: string[];
  evidencePolicy: string;
  status: "ready" | "blocked" | "satisfied";
  blocker?: string;
};

export type CapabilityPlan = {
  steps: CapabilityPlanStep[];
  requiredCapabilities: CapabilityRequirement[];
  blocked: string[];
  ready: string[];
  satisfied: string[];
};

export function planCapabilities(
  interpretation: ModelSemanticInterpretation,
  context: ContextResolution,
  availableEvidence: { kind: string; source: string }[] = [],
): CapabilityPlan {
  const registry = new Map(listCapabilities().map(capability => [capability.id, capability]));
  const requested = new Set(interpretation.requiredCapabilities.filter(id => registry.has(id)));

  if (interpretation.needsBusinessData) requested.add("business-data-retrieval");
  if (interpretation.needsExternalResearch) requested.add("external-research");
  if (interpretation.requiresEvidence) requested.add("evidence-review");

  const visit = (id: string, visiting = new Set<string>()): void => {
    if (visiting.has(id)) throw new Error(`Capability dependency cycle detected at ${id}.`);
    const capability = registry.get(id);
    if (!capability) return;
    const next = new Set(visiting).add(id);
    for (const dependency of capability.dependencies) {
      if (registry.has(dependency)) {
        requested.add(dependency);
        visit(dependency, next);
      }
    }
  };

  for (const id of [...requested]) visit(id);

  const evidenceAvailable = availableEvidence.length > 0;
  const steps: CapabilityPlanStep[] = [];
  const ordered = [...requested].sort((a, b) => {
    const da = registry.get(a)?.dependencies.length ?? 0;
    const db = registry.get(b)?.dependencies.length ?? 0;
    return da - db || a.localeCompare(b);
  });

  for (const id of ordered) {
    const capability = registry.get(id);
    if (!capability) continue;

    const dependencyBlockers = capability.dependencies.filter(dep => {
      const prior = steps.find(step => step.capabilityId === dep);
      return prior && prior.status === "blocked";
    });
    const satisfiedByContext = id === "business-context" && context.entries.length > 0;
    const satisfiedByEvidence = id === "evidence-review" && evidenceAvailable;
    const unavailable = capability.status !== "available" && !satisfiedByContext && !satisfiedByEvidence;

    const blocker = dependencyBlockers.length
      ? `Dependency blocked: ${dependencyBlockers.join(", ")}.`
      : unavailable
        ? `${capability.label} is registered but its executor is not currently available.`
        : undefined;

    steps.push({
      capabilityId: id,
      reason: capability.purpose,
      dependencies: [...capability.dependencies],
      requiredInputs: capability.inputs.filter(input => input.required).map(input => input.name),
      evidencePolicy: capability.evidencePolicy,
      status: blocker ? "blocked" : (satisfiedByContext || satisfiedByEvidence ? "satisfied" : "ready"),
      ...(blocker ? { blocker } : {}),
    });
  }

  return {
    steps,
    requiredCapabilities: steps.map(step => ({
      id: step.capabilityId,
      reason: step.reason,
      status: step.status === "blocked" ? "unavailable" : "available",
    })),
    blocked: steps.filter(step => step.status === "blocked").map(step => step.capabilityId),
    ready: steps.filter(step => step.status === "ready").map(step => step.capabilityId),
    satisfied: steps.filter(step => step.status === "satisfied").map(step => step.capabilityId),
  };
}
