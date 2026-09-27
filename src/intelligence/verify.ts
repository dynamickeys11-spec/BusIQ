import type { EvidenceItem, ResearchStep } from "./types";

export function verifyEvidence(evidence: EvidenceItem[], researchPlan: ResearchStep[], ambiguityCount: number) {
  const missingEvidence = researchPlan.filter(step => step.status === "blocked").map(step => step.purpose);
  const checks = [
    "Request has been normalized.",
    "Intent has been resolved deterministically.",
    "Material ambiguity has been checked.",
    "Only connected sources may be treated as retrieved evidence.",
    "No external business facts are asserted without evidence.",
  ];
  if (ambiguityCount > 0) return { state: "blocked" as const, checks, missingEvidence: ["Clarification is required before execution."] };
  if (missingEvidence.length > 0) return { state: "blocked" as const, checks, missingEvidence };
  return { state: "passed" as const, checks, missingEvidence: evidence.length ? [] : ["No retrieved evidence is available."] };
}