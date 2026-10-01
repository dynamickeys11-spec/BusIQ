import type {
  LearningDecision,
  LearningEvaluation,
  LearningExample,
  LearningPolicy,
  LearnedRule,
} from "./types.js";
import { defaultLearningPolicy } from "./types.js";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function evaluateLearningExample(
  example: LearningExample,
  signals: Omit<LearningEvaluation, "exampleId" | "evaluatedAt" | "score" | "passed">,
  policy: LearningPolicy = defaultLearningPolicy,
): LearningEvaluation {
  const score = Number((
    0.30 * clamp(signals.factuality) +
    0.25 * clamp(signals.usefulness) +
    0.25 * clamp(signals.safety) +
    0.20 * clamp(signals.groundedness)
  ).toFixed(4));

  const passed =
    score >= policy.minimumScore &&
    signals.groundedness >= policy.minimumGroundedness &&
    signals.safety >= policy.minimumSafety &&
    (!policy.requireExpectedAnswerForPromotion || Boolean(example.expectedAnswer));

  return {
    ...signals,
    exampleId: example.id,
    score,
    passed,
    evaluatedAt: new Date().toISOString(),
  };
}

export function proposeLearnedRule(
  example: LearningExample,
  evaluation: LearningEvaluation,
  statement: string,
): LearningDecision {
  if (!evaluation.passed) {
    return { state: "rejected", reason: "The example did not pass the learning quality gate." };
  }

  const now = new Date().toISOString();
  const rule: LearnedRule = {
    id: "rule-" + example.id,
    statement: statement.trim(),
    evidenceExampleIds: [example.id],
    version: 1,
    status: "candidate",
    createdAt: now,
    updatedAt: now,
  };

  return { state: "candidate", evaluation, rule };
}

export function promoteLearnedRule(
  decision: Extract<LearningDecision, { state: "candidate" }>,
): LearningDecision {
  if (!decision.rule) return { state: "rejected", reason: "No candidate rule was supplied." };

  return {
    state: "promoted",
    evaluation: decision.evaluation,
    rule: {
      ...decision.rule,
      status: "active",
      updatedAt: new Date().toISOString(),
    },
  };
}
