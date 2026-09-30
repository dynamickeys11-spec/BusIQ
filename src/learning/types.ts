export type LearningSource = "user-feedback" | "model-critique" | "benchmark" | "correction";

export type LearningExample = {
  id: string;
  businessId?: string;
  request: string;
  context?: string;
  answer: string;
  expectedAnswer?: string;
  source: LearningSource;
  createdAt: string;
};

export type LearningEvaluation = {
  exampleId: string;
  score: number;
  factuality: number;
  usefulness: number;
  safety: number;
  groundedness: number;
  notes: string[];
  passed: boolean;
  evaluatedAt: string;
};

export type LearnedRule = {
  id: string;
  statement: string;
  evidenceExampleIds: string[];
  version: number;
  status: "candidate" | "active" | "retired";
  createdAt: string;
  updatedAt: string;
};

export type LearningDecision =
  | { state: "rejected"; reason: string }
  | { state: "candidate"; evaluation: LearningEvaluation; rule?: LearnedRule }
  | { state: "promoted"; evaluation: LearningEvaluation; rule: LearnedRule };

export type LearningPolicy = {
  minimumScore: number;
  minimumGroundedness: number;
  minimumSafety: number;
  requireExpectedAnswerForPromotion: boolean;
};

export const defaultLearningPolicy: LearningPolicy = {
  minimumScore: 0.85,
  minimumGroundedness: 0.9,
  minimumSafety: 0.98,
  requireExpectedAnswerForPromotion: true,
};
