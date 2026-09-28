import type { EvidenceItem, ResearchStep } from "./types";

function scopeKey(scope: EvidenceItem["scope"]): string {
  return JSON.stringify(scope ?? {});
}

function evidenceScopeIssues(evidence: EvidenceItem[]): string[] {
  const scoped = evidence.filter(item => item.scope);
  if (scoped.length < 2) return scoped.length === 1 && evidence.length > 1
    ? ["Evidence items mix scoped and unscoped records and cannot be safely combined."]
    : [];
  if (scoped.length !== evidence.length) return ["Evidence items mix scoped and unscoped records and cannot be safely combined."];
  const keys = new Set(scoped.map(item => scopeKey(item.scope)));
  return keys.size > 1
    ? ["Evidence items have incompatible scopes and cannot be combined into one factual answer."]
    : [];
}

function requestedTimeContext(request: string): "current" | "historical" | "unspecified" {
  if (/\b(today|now|currently|current|latest|this week|this month|recent)\b/i.test(request)) return "current";
  if (/\b(last year|last month|yesterday|previous|historical|in \d{4}|during \d{4})\b/i.test(request)) return "historical";
  return "unspecified";
}

export type EvidenceQualityIssue = {
  evidenceId: string;
  category: "authority" | "freshness" | "verification" | "relevance";
  message: string;
};

export function classifyEvidenceQuality(item: EvidenceItem): "strong" | "limited" | "unknown" {
  if (!item.authority || item.authority === "unknown" || !item.freshness || item.freshness === "unknown" || item.verification !== "verified" || !item.relevance || item.relevance === "unknown") return "unknown";
  if (item.relevance === "direct" && item.authority !== "user") return "strong";
  return "limited";
}

function evidenceQualityIssues(evidence: EvidenceItem[], request: string): EvidenceQualityIssue[] {
  const issues: EvidenceQualityIssue[] = [];
  for (const item of evidence.filter(item => item.kind === "retrieved" || item.kind === "verified")) {
    const quality = classifyEvidenceQuality(item);
    if (item.authority === "unknown" || !item.authority) issues.push({ evidenceId: item.id, category: "authority", message: `Evidence ${item.id} has unknown source authority.` });
    const timeContext = requestedTimeContext(request);
    if (item.freshness === "unknown" || !item.freshness) issues.push({ evidenceId: item.id, category: "freshness", message: `Evidence ${item.id} has unknown freshness.` });
    else if (timeContext === "current" && item.freshness !== "current") issues.push({ evidenceId: item.id, category: "freshness", message: `Evidence ${item.id} is not current enough for the requested time context.` });
    else if (timeContext === "historical" && !item.evidenceDate) issues.push({ evidenceId: item.id, category: "freshness", message: `Evidence ${item.id} lacks a date needed for the historical time context.` });
    if (item.verification !== "verified") issues.push({ evidenceId: item.id, category: "verification", message: `Evidence ${item.id} is not verified.` });
    if (item.relevance === "unknown" || !item.relevance) issues.push({ evidenceId: item.id, category: "relevance", message: `Evidence ${item.id} has unknown relevance.` });
  }
  return issues;
}

export function verifyEvidence(
  evidence: EvidenceItem[],
  researchPlan: ResearchStep[],
  ambiguityCount: number,
  executionSucceeded: boolean,
  request = "",
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
  const qualityIssues = evidenceQualityIssues(retrievedEvidence, request);
  const scopeIssues = evidenceScopeIssues(retrievedEvidence);
  if (requiredEvidenceSteps.length > 0 && retrievedEvidence.length === 0) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: ["No retrieved or verified evidence is available for the required factual step."],
    };
  }

  if (scopeIssues.length > 0) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: scopeIssues,
    };
  }

  if (qualityIssues.length > 0) {
    return {
      state: "blocked" as const,
      checks,
      missingEvidence: qualityIssues.map(issue => issue.message),
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