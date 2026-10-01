import type { ModelSemanticInterpretation } from "./semantic-interpreter.js";
import { listCapabilities } from "./capabilities.js";
import type { ContextResolution } from "./context-resolver.js";

export type ExecutionNodeStatus = "ready" | "blocked" | "needs_context" | "satisfied";
export type ExecutionTerminalState = "ready" | "needs_evidence" | "needs_context" | "blocked";

export type CapabilityPlanNode = {
  id: string;
  capabilityId: string;
  reason: string;
  dependencies: string[];
  requiredInputs: string[];
  evidencePolicy: "none" | "optional" | "required";
  sideEffects: "none" | "read" | "write";
  status: ExecutionNodeStatus;
  blocker?: string;
};

export type ExecutionNodeResult = {
  nodeId: string;
  state: "success" | "blocked" | "needs_evidence" | "needs_context";
  evidenceIds: string[];
  output?: unknown;
  reason?: string;
};

export type CapabilityExecutionGraph = {
  nodes: CapabilityPlanNode[];
  edges: Array<{ from: string; to: string; kind: "dependency" }>;
  stages: string[][];
  terminalState: ExecutionTerminalState;
  results: ExecutionNodeResult[];
};

function topo(nodes: Map<string, CapabilityPlanNode>): string[][] {
  const remaining = new Set(nodes.keys());
  const stages: string[][] = [];
  while (remaining.size) {
    const stage = [...remaining].filter(id => (nodes.get(id)?.dependencies ?? []).every(dep => !remaining.has(dep)));
    if (!stage.length) throw new Error("Capability execution graph contains a dependency cycle.");
    stages.push(stage.sort());
    stage.forEach(id => remaining.delete(id));
  }
  return stages;
}

export function applyExecutionNodeResults(graph: CapabilityExecutionGraph, results: ExecutionNodeResult[]): CapabilityExecutionGraph {
  const resultByNode = new Map(results.map(result => [result.nodeId, result]));
  const nodes = graph.nodes.map(node => {
    const result = resultByNode.get(node.id);
    if (!result) return node;
    if (result.state === "success") return { ...node, status: "satisfied" as const, blocker: undefined };
    if (result.state === "needs_context") return { ...node, status: "needs_context" as const, blocker: result.reason ?? result.state };
    return { ...node, status: "blocked" as const, blocker: result.reason ?? result.state };
  });
  const propagated = nodes.map(node => ({ ...node }));
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of propagated) {
      if (node.status === "blocked" || node.status === "needs_context") continue;
      const dependency = node.dependencies.find(dep => propagated.find(item => item.id === dep)?.status === "blocked");
      if (dependency) {
        node.status = "blocked";
        node.blocker = `Dependency blocked: ${dependency}.`;
        changed = true;
      }
    }
  }
  return {
    ...graph,
    nodes: propagated,
    results,
    terminalState: propagated.some(n => n.status === "blocked")
      ? "blocked"
      : propagated.some(n => n.status === "needs_context")
        ? "needs_context"
        : propagated.some(n => n.status === "ready" && n.evidencePolicy === "required")
          ? "needs_evidence"
          : "ready",
  };
}

export function buildCapabilityExecutionGraph(
  interpretation: ModelSemanticInterpretation,
  context: ContextResolution,
  availableEvidence: { kind: string; source: string }[] = [],
): CapabilityExecutionGraph {
  const registry = new Map(listCapabilities().map(c => [c.id, c]));
  const requested = new Set(interpretation.requiredCapabilities.filter(id => registry.has(id)));
  if (interpretation.needsBusinessData) requested.add("business-data-retrieval");
  if (interpretation.needsExternalResearch) requested.add("external-research");
  if (interpretation.requiresEvidence) requested.add("evidence-review");

  const visit = (id: string, path = new Set<string>()) => {
    if (path.has(id)) throw new Error(`Capability dependency cycle detected at ${id}.`);
    const capability = registry.get(id);
    if (!capability) return;
    const next = new Set(path).add(id);
    capability.dependencies.filter(dep => registry.has(dep)).forEach(dep => {
      requested.add(dep);
      visit(dep, next);
    });
  };
  [...requested].forEach(id => visit(id));

  const nodes = new Map<string, CapabilityPlanNode>();
  for (const id of requested) {
    const c = registry.get(id);
    if (!c) continue;
    const satisfied = (id === "business-context" && context.entries.length > 0) ||
      (id === "evidence-review" && availableEvidence.length > 0);
    const unavailable = c.status !== "available" && !satisfied;
    nodes.set(id, {
      id: id,
      capabilityId: id,
      reason: c.purpose,
      dependencies: c.dependencies.filter(dep => registry.has(dep)),
      requiredInputs: c.inputs.filter(input => input.required).map(input => input.name),
      evidencePolicy: c.evidencePolicy,
      sideEffects: c.sideEffects,
      status: unavailable ? "blocked" : satisfied ? "satisfied" : "ready",
      ...(unavailable ? { blocker: `${c.label} is registered but its executor is not currently available.` } : {}),
    });
  }

  for (const node of nodes.values()) {
    const blockedDeps = node.dependencies.filter(dep => nodes.get(dep)?.status === "blocked");
    if (blockedDeps.length) {
      node.status = "blocked";
      node.blocker = `Dependency blocked: ${blockedDeps.join(", ")}.`;
    }
  }

  const stages = topo(nodes);
  const edges = [...nodes.values()].flatMap(node =>
    node.dependencies.map(from => ({ from, to: node.id, kind: "dependency" as const }))
  );
  const hasBlocked = [...nodes.values()].some(n => n.status === "blocked");
  const needsEvidence = [...nodes.values()].some(n => n.status === "ready" && n.evidencePolicy === "required" && !availableEvidence.length);
  const needsContext = [...nodes.values()].some(n => n.status === "ready" && n.requiredInputs.includes("businessContext") && !context.entries.length);
  if (needsContext) {
    for (const node of nodes.values()) {
      if (node.status === "ready" && node.requiredInputs.includes("businessContext")) {
        node.status = "needs_context";
        node.blocker = "Business context is required before this capability can execute.";
      }
    }
  }
  return {
    nodes: [...nodes.values()],
    edges,
    stages,
    terminalState: hasBlocked ? "blocked" : needsContext ? "needs_context" : needsEvidence ? "needs_evidence" : "ready",
    results: [],
  };
}
