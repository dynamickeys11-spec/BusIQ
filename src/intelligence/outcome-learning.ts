import type { LearningCandidate } from "./learning-governance.js";
import { canPromote } from "./learning-governance.js";
import type { DecisionMemory } from "./decision-memory.js";

export type OutcomeComparison = {
  expected: string[];
  actual: string[];
  comparable: boolean;
  matchedCount: number;
  missedCount: number;
  variance: "none" | "partial" | "incomplete";
};

export type LearningEvaluation = {
  decisionId: string;
  comparison: OutcomeComparison;
  candidate?: LearningCandidate;
  promotionEligible: boolean;
  reason: string;
};

export function compareDecisionOutcome(memory: DecisionMemory): OutcomeComparison {
  const expected = memory.expectedOutcomes;
  const actual = memory.actualOutcomes;
  const comparable = expected.length > 0 && actual.length > 0;
  const actualText = actual.join(" ").toLowerCase();
  const matchedCount = expected.filter(item => actualText.includes(item.toLowerCase())).length;
  const missedCount = expected.length - matchedCount;
  return {
    expected,
    actual,
    comparable,
    matchedCount,
    missedCount,
    variance: !comparable ? "incomplete" : missedCount === 0 ? "none" : "partial",
  };
}

export function evaluateOutcomeForLearning(
  memory: DecisionMemory,
  evidenceIds: string[],
  benchmarkPassed: boolean,
  deterministicChecksPassed: boolean,
): LearningEvaluation {
  const comparison = compareDecisionOutcome(memory);
  const candidate: LearningCandidate = {
    id: "learning:" + memory.id,
    pattern: comparison.missedCount
      ? "Expected outcome did not fully match observed outcome."
      : "Expected outcome matched observed outcome.",
    evidenceIds: [...new Set(evidenceIds)],
    benchmarkPassed,
    deterministicChecksPassed,
    promoted: false,
  };
  const promotionEligible = comparison.comparable && canPromote(candidate);
  candidate.promoted = promotionEligible;
  return {
    decisionId: memory.id,
    comparison,
    candidate,
    promotionEligible,
    reason: promotionEligible
      ? "Outcome evidence, benchmark checks, and deterministic checks all passed."
      : "Learning remains a candidate until comparable outcomes, evidence, benchmark checks, and deterministic checks are available.",
  };
}
