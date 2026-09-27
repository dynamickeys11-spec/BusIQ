import type { EvidenceItem, ResearchStep } from "./types";

function evidenceQualityIssues(evidence: EvidenceItem[]): string[] {
  const issues: string[] = [];
  for (const item of evidence.filter(item => item.kind === "retrieved" || item.kind === "verified")) {
    if (item.authority === "unknown" || !item.authority) issues.push(`Evidence ${item.id} has unknown source authority.`);
    if (item.freshness === "unknown" || !item.freshness) issues.push(`Evidence ${item.id} has unknown freshness.`);
    if (item.verification !== "verified") issues.push(`Evidence ${item.id} is not verified.`);
    if (item.relevance === "unknown") issues.push(`Evidence ${item.id} has unknown relevance.`);
  }
  return issues;
}

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
  const qualityIssues = evidenceQualityIssues(retrievedEvidence);
  if (requiredEvidenceSteps.length > 0 && retrievedEvidence.length === 0) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: ["No retrieved or verified evidence is available for the required factual step."],
    };
  }

  if (qualityIssues.length > 0) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: qualityIssues,
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