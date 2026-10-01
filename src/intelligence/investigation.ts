import type { EvidenceItem, IntelligencePipelineResult } from "./types.js";
import type { BusinessWorldModel } from "./world-model.js";

export type InvestigationHypothesis = {
  id: string;
  statement: string;
  status: "unverified" | "supported" | "challenged" | "rejected";
  evidenceIds: string[];
  missingEvidence: string[];
};

export type InvestigationQuestion = {
  id: string;
  question: string;
  purpose: "distinguish-hypotheses" | "fill-critical-gap" | "verify-conclusion";
  priority: "high" | "medium" | "low";
  dependsOn?: string[];
};

export type InvestigationPlan = {
  question: string;
  hypotheses: InvestigationHypothesis[];
  questions: InvestigationQuestion[];
  informationGaps: string[];
  stoppingReason?: string;
};

const hypothesisPatterns: Array<{ pattern: RegExp; hypotheses: string[] }> = [
  { pattern: /sales|revenue|income/i, hypotheses: [
    "Demand or customer volume changed.",
    "Conversion or sales performance changed.",
    "Product mix, price, or availability changed.",
    "External market or competitive conditions changed.",
  ]},
  { pattern: /profit|margin|cost|expense/i, hypotheses: [
    "Revenue changed.",
    "Unit economics or product mix changed.",
    "Operating costs changed.",
    "Pricing or discounting changed.",
  ]},
  { pattern: /customer|retention|churn|leav/i, hypotheses: [
    "Customer experience or service changed.",
    "Price or value perception changed.",
    "Product availability or quality changed.",
    "Competitive alternatives changed.",
  ]},
  { pattern: /inventory|stock|product/i, hypotheses: [
    "Demand changed.",
    "Pricing or product positioning changed.",
    "Availability or replenishment changed.",
    "Product mix is misaligned with demand.",
  ]},
];

function candidateHypotheses(question: string): string[] {
  for (const item of hypothesisPatterns) if (item.pattern.test(question)) return item.hypotheses;
  return [
    "The observed outcome is driven by an internal business factor.",
    "The observed outcome is driven by a customer or market factor.",
    "The available evidence is incomplete or inconsistent.",
  ];
}

export function buildInvestigationPlan(
  question: string,
  worldModel: BusinessWorldModel,
  evidence: EvidenceItem[],
): InvestigationPlan {
  const hypotheses = candidateHypotheses(question).map((statement, index) => ({
    id: `hypothesis-${index + 1}`,
    statement,
    status: "unverified" as const,
    evidenceIds: [],
    missingEvidence: [],
  }));

  const availableLabels = evidence.map(item => item.label.toLowerCase());
  const questions = hypotheses.map((hypothesis, index) => ({
    id: `investigation-question-${index + 1}`,
    question: `What evidence would distinguish whether: ${hypothesis.statement}`,
    purpose: "distinguish-hypotheses" as const,
    priority: index === 0 ? "high" as const : "medium" as const,
  }));

  const gaps: string[] = [];
  if (!evidence.length) gaps.push("Connected business evidence");
  if (!worldModel.entities.length) gaps.push("Business entities and records");
  if (!availableLabels.some(label => /sales|revenue|customer|profit|cost|inventory|product/i.test(label))) {
    gaps.push("Domain-specific evidence relevant to the question");
  }

  return {
    question,
    hypotheses,
    questions,
    informationGaps: [...new Set(gaps)],
    stoppingReason: gaps.length ? "Investigation is evidence-limited; BUSIQ should not select a causal explanation yet." : undefined,
  };
}

export function attachInvestigation(
  result: IntelligencePipelineResult,
  worldModel: BusinessWorldModel,
): IntelligencePipelineResult & { worldModel: BusinessWorldModel; investigation: InvestigationPlan } {
  return {
    ...result,
    worldModel,
    investigation: buildInvestigationPlan(result.request, worldModel, result.evidence),
  };
}
