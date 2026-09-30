import { describe, expect, it } from "vitest";
import { evaluateLearningExample, promoteLearnedRule, proposeLearnedRule } from "./engine";
import type { LearningExample } from "./types";

const example: LearningExample = {
  id: "example-1",
  request: "How should BUSIQ compare two products?",
  answer: "Compare contribution margin, demand, and operational constraints.",
  expectedAnswer: "Compare contribution margin, demand, and operational constraints.",
  source: "benchmark",
  createdAt: new Date().toISOString(),
};

describe("BUSIQ learning engine", () => {
  it("rejects weak learning material", () => {
    const evaluation = evaluateLearningExample(example, {
      factuality: 0.7,
      usefulness: 0.7,
      safety: 1,
      groundedness: 0.6,
      notes: ["Insufficient evidence."],
    });

    expect(evaluation.passed).toBe(false);
    expect(proposeLearnedRule(example, evaluation, "Prefer evidence over assumptions.").state).toBe("rejected");
  });

  it("can promote only material that passes all learning gates", () => {
    const evaluation = evaluateLearningExample(example, {
      factuality: 0.98,
      usefulness: 0.95,
      safety: 1,
      groundedness: 0.97,
      notes: [],
    });

    const candidate = proposeLearnedRule(example, evaluation, "Prefer evidence over unsupported assumptions.");
    expect(candidate.state).toBe("candidate");

    if (candidate.state !== "candidate") throw new Error("Expected candidate.");
    const promoted = promoteLearnedRule(candidate);

    expect(promoted.state).toBe("promoted");
    if (promoted.state === "promoted") expect(promoted.rule.status).toBe("active");
  });
});
