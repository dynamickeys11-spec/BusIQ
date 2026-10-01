import type { AnswerPresentation, IntelligencePipelineResult } from "./types.js";

export type AnswerQualityIssue =
  | "missing-headline"
  | "missing-detail"
  | "missing-next-action"
  | "unsupported-success"
  | "unsupported-evidence";

export type AnswerQuality = {
  passed: boolean;
  issues: AnswerQualityIssue[];
};

export function validateAnswerQuality(result: Pick<IntelligencePipelineResult, "status" | "answer" | "evidence" | "reasoning">): AnswerQuality {
  const issues: AnswerQualityIssue[] = [];
  const answer: AnswerPresentation = result.answer;

  if (!answer.headline.trim()) issues.push("missing-headline");
  if (!answer.detail.trim()) issues.push("missing-detail");
  if (!answer.nextAction.trim()) issues.push("missing-next-action");

  if (result.status !== "ready" && /completed|created|finished|done/i.test(answer.headline)) {
    issues.push("unsupported-success");
  }

  const cited = new Set(answer.evidence ?? []);
  const knownEvidence = new Set(result.evidence.map(item => item.id));
  if ([...cited].some(id => !knownEvidence.has(id))) {
    issues.push("unsupported-evidence");
  }

  return { passed: issues.length === 0, issues };
}
