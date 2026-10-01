import type { IntelligencePipelineResult } from "./types.js";

export type CoreLoopGate = {
  id: string;
  passed: boolean;
  reason: string;
};

export function evaluateCoreIntelligenceLoop(result: IntelligencePipelineResult): CoreLoopGate[] {
  return [
    {
      id: "intent",
      passed: Boolean(result.intent?.kind),
      reason: result.intent?.kind ? "Intent resolved." : "Intent is missing.",
    },
    {
      id: "evidence",
      passed: result.verification.sufficiency !== "insufficient" && result.evidence.length > 0,
      reason: result.evidence.length ? "Evidence exists." : "No evidence is available.",
    },
    {
      id: "actual",
      passed: Boolean(result.semanticModel?.actual.length),
      reason: result.semanticModel?.actual.length ? "Actual state is represented." : "Actual state is missing.",
    },
    {
      id: "world-model",
      passed: Boolean(result.worldModel),
      reason: result.worldModel ? "Business World Model exists." : "Business World Model is missing.",
    },
    {
      id: "investigation",
      passed: Boolean(result.investigation),
      reason: result.investigation ? "Investigation plan exists." : "Investigation plan is missing.",
    },
    {
      id: "digital-twin",
      passed: Boolean(result.digitalTwin),
      reason: result.digitalTwin ? "Evidence-grounded digital twin exists." : "Digital twin is missing.",
    },
    {
      id: "reasoning",
      passed: result.reasoning.conclusions.length > 0 || result.reasoning.state === "insufficient",
      reason: result.reasoning.conclusions.length ? "Reasoning produced evidence-linked conclusions." : "Reasoning correctly reports insufficiency.",
    },
    {
      id: "answer",
      passed: Boolean(result.answer.headline && result.answer.detail && result.answer.nextAction),
      reason: "Structured BUSIQ answer is present.",
    },
  ];
}

export function coreIntelligenceLoopPassed(result: IntelligencePipelineResult): boolean {
  return evaluateCoreIntelligenceLoop(result).every(gate => gate.passed);
}
