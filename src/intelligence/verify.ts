import type { EvidenceDiagnostic, EvidenceItem, EvidenceQuality, EvidenceSufficiency, ResearchStep } from "./types";

function scopeKey(scope: EvidenceItem["scope"]): string {
  return JSON.stringify(scope ?? {});
}

function evidenceScopeIssues(evidence: EvidenceItem[]): EvidenceDiagnostic[] {
  const scoped = evidence.filter(item => item.scope);
  if (scoped.length < 2) {
    return scoped.length === 1 && evidence.length > 1
      ? [{ category: "scope", message: "Evidence items mix scoped and unscoped records and cannot be safely combined." }]
      : [];
  }
  if (scoped.length !== evidence.length) {
    return [{ category: "scope", message: "Evidence items mix scoped and unscoped records and cannot be safely combined." }];
  }
  const keys = new Set(scoped.map(item => scopeKey(item.scope)));
  return keys.size > 1
    ? [{ category: "scope", message: "Evidence items have incompatible scopes and cannot be combined into one factual answer." }]
    : [];
}

function requestedTimeContext(request: string): "current" | "historical" | "unspecified" {
  if (/\b(today|now|currently|current|latest|this week|this month|recent)\b/i.test(request)) return "current";
  if (/\b(last year|last month|yesterday|previous|historical|in \d{4}|during \d{4})\b/i.test(request)) return "historical";
  return "unspecified";
}

export type EvidenceQualityIssue = EvidenceDiagnostic;

export function classifyEvidenceQuality(item: EvidenceItem): EvidenceQuality {
  if (!item.authority || item.authority === "unknown" || !item.freshness || item.freshness === "unknown" || item.verification !== "verified" || !item.relevance || item.relevance === "unknown") return "unknown";
  if (item.relevance === "direct" && item.authority !== "user") return "strong";
  return "limited";
}

function evidenceQualityIssues(evidence: EvidenceItem[], request: string): EvidenceQualityIssue[] {
  const issues: EvidenceQualityIssue[] = [];
  const timeContext = requestedTimeContext(request);
  for (const item of evidence) {
    const quality = classifyEvidenceQuality(item);
    if (item.authority === "unknown" || !item.authority) {
      issues.push({ evidenceId: item.id, category: "authority", message: `Evidence ${item.id} has unknown source authority.` });
    }
    if (item.freshness === "unknown" || !item.freshness) {
      issues.push({ evidenceId: item.id, category: "freshness", message: `Evidence ${item.id} has unknown freshness.` });
    } else if (timeContext === "current" && item.freshness !== "current") {
      issues.push({ evidenceId: item.id, category: "freshness", message: `Evidence ${item.id} is not current enough for the requested time context.` });
    } else if (timeContext === "historical" && !item.evidenceDate) {
      issues.push({ evidenceId: item.id, category: "freshness", message: `Evidence ${item.id} lacks a date needed for the historical time context.` });
    }
    if (item.verification !== "verified") {
      issues.push({ evidenceId: item.id, category: "verification", message: `Evidence ${item.id} is not verified.` });
    }
    if (item.relevance === "unknown" || !item.relevance) {
      issues.push({ evidenceId: item.id, category: "relevance", message: `Evidence ${item.id} has unknown relevance.` });
    }
    if (item.quality && item.quality !== quality) {
      issues.push({ evidenceId: item.id, category: "sufficiency", message: `Evidence ${item.id} declares quality ${item.quality}, but its provenance metadata classifies it as ${quality}.` });
    }
  }
  return issues;
}

export function assessEvidenceSufficiency(
  evidence: EvidenceItem[],
  researchPlan: ResearchStep[],
  request: string,
): EvidenceSufficiency {
  const required = researchPlan.filter(step => step.evidenceRequired);
  if (required.length === 0) return "not-required";
  const retrieved = evidence.filter(item => item.kind === "retrieved" || item.kind === "verified");
  if (retrieved.length === 0) return "insufficient";
  if (evidenceScopeIssues(retrieved).length > 0 || evidenceQualityIssues(retrieved, request).length > 0) return "insufficient";
  return "sufficient";
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
    const diagnostics: EvidenceDiagnostic[] = [{
      category: "sufficiency",
      message: "Clarification is required before evidence can be judged sufficient.",
    }];
    return { state: "blocked" as const, checks, missingEvidence: [diagnostics[0].message], diagnostics, sufficiency: "insufficient" as const };
  }

  const requiredEvidenceSteps = researchPlan.filter(step => step.evidenceRequired);
  const blockedEvidence = requiredEvidenceSteps.filter(step => step.status === "blocked");
  if (blockedEvidence.length > 0) {
    const diagnostics = blockedEvidence.map(step => ({ category: "sufficiency" as const, message: step.purpose }));
    return { state: "blocked" as const, checks, missingEvidence: diagnostics.map(item => item.message), diagnostics, sufficiency: "insufficient" as const };
  }

  const retrievedEvidence = evidence.filter(item => item.kind === "retrieved" || item.kind === "verified");
  if (requiredEvidenceSteps.length > 0 && retrievedEvidence.length === 0) {
    const diagnostics: EvidenceDiagnostic[] = [{
      category: "sufficiency",
      message: "No retrieved or verified evidence is available for the required factual step.",
    }];
    return { state: "blocked" as const, checks, missingEvidence: diagnostics.map(item => item.message), diagnostics, sufficiency: "insufficient" as const };
  }

  const scopeIssues = evidenceScopeIssues(retrievedEvidence);
  const qualityIssues = evidenceQualityIssues(retrievedEvidence, request);
  const diagnostics = [...scopeIssues, ...qualityIssues];
  if (diagnostics.length > 0) {
    return { state: "blocked" as const, checks, missingEvidence: diagnostics.map(item => item.message), diagnostics, sufficiency: "insufficient" as const };
  }

  if (!executionSucceeded) {
    const executionIssue: EvidenceDiagnostic = {
      category: "sufficiency",
      message: "No successful execution result is available to support a completed answer.",
    };
    return { state: "blocked" as const, checks, missingEvidence: [executionIssue.message], diagnostics: [executionIssue], sufficiency: requiredEvidenceSteps.length ? "insufficient" as const : "not-required" as const };
  }

  return {
    state: "passed" as const,
    checks,
    missingEvidence: [],
    diagnostics: [],
    sufficiency: requiredEvidenceSteps.length ? "sufficient" as const : "not-required" as const,
  };
}
