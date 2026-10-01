import type { Decision, DecisionOption, DecisionScenario } from "./types";

export function createDecision(input: {
  businessId: string;
  question: string;
  context?: string[];
  evidenceIds?: string[];
  options?: DecisionOption[];
  assumptions?: string[];
  scenarios?: DecisionScenario[];
}): Decision {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    businessId: input.businessId,
    question: input.question.trim(),
    context: input.context ?? [],
    evidenceIds: input.evidenceIds ?? [],
    options: input.options ?? [],
    assumptions: input.assumptions ?? [],
    scenarios: input.scenarios ?? [],
    confirmation: { required: false, confirmed: false },
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function confirmDecision(decision: Decision, userId: string): Decision {
  const now = new Date().toISOString();
  return {
    ...decision,
    confirmation: {
      required: true,
      confirmed: true,
      confirmedBy: userId,
      confirmedAt: now,
    },
    status: "confirmed",
    updatedAt: now,
  };
}

export function selectDecisionOption(decision: Decision, optionId: string): Decision {
  if (!decision.options.some((option) => option.id === optionId)) {
    throw new Error("Decision option does not exist.");
  }
  return { ...decision, selectedOptionId: optionId, status: "ready", updatedAt: new Date().toISOString() };
}
