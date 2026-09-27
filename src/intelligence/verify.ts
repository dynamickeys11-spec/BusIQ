import type { EvidenceItem, ResearchStep } from "./types";

export function verifyEvidence(
  evidence: EvidenceItem[],
  researchPlan: ResearchStep[],
  ambiguityCount: number,
  executionSucceeded: boolean,
) {
  const checks = [
    "Request has been normalized.",
    "Intent has been resolved deterministically.",
    "Material ambiguity has been checked.",
    "Only connected sources may be treated as retrieved evidence.",
    "User input is not treated as retrieved or verified evidence.",
    "Factual answers require evidence from a required source.",
  ];
  if (ambiguityCount > 0) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: ["Clarification is required before execution."],
    };
  }

  const requiredEvidenceSteps = researchPlan.filter(step => step.evidenceRequired);
  const blockedEvidence = requiredEvidenceSteps
    .filter(step => step.status === "blocked")
    .map(step => step.purpose);

  if (blockedEvidence.length > 0) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: blockedEvidence,
    };
  }

  const retrievedEvidence = evidence.filter(item => item.kind === "retrieved" || item.kind === "verified");
  if (requiredEvidenceSteps.length > 0 && retrievedEvidence.length === 0) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: ["No retrieved or verified evidence is available for the required factual step."],
    };
  }

  if (!executionSucceeded) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: ["No successful execution result is available to support a completed answer."],
    };
  }

  return {
    state: "passed" as const,
    checks,
    missingEvidence: [],
  };
}