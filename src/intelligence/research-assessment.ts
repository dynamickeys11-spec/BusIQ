import type { EvidenceItem } from "./types.js";

export type ResearchStopReason =
  | "sufficient-evidence"
  | "conflict-detected"
  | "no-evidence"
  | "freshness-unknown"
  | "source-limit-reached";

export type ResearchAssessment = {
  freshness: "current" | "dated" | "unknown";
  triangulated: boolean;
  conflicts: string[];
  sufficient: boolean;
};

export type ResearchStoppingDecision = {
  stop: boolean;
  reason?: ResearchStopReason;
  detail: string;
};

export function assessResearchEvidence(items: EvidenceItem[]): ResearchAssessment {
  const retrieved = items.filter(item => item.kind === "retrieved" || item.kind === "verified");
  const freshness = retrieved.length === 0 ? "unknown" : retrieved.some(item => item.freshness === "current") ? "current" : retrieved.every(item => item.freshness === "dated") ? "dated" : "unknown";
  const sources = new Set(retrieved.map(item => item.source));
  const byLabel = new Map<string, EvidenceItem[]>();
  for (const item of retrieved) byLabel.set(item.label, [...(byLabel.get(item.label) ?? []), item]);
  const conflicts: string[] = [];
  for (const [label, group] of byLabel) {
    const directions = new Set(group.map(item => {
      const text = item.detail.toLowerCase();
      if (/\b(increase|increased|up|rose|rising|grew)\b/.test(text)) return "up";
      if (/\b(decrease|decreased|down|fell|falling|declined|decline|dropped)\b/.test(text)) return "down";
      return "neutral";
    }).filter(x => x !== "neutral"));
    if (directions.size > 1) conflicts.push(`Conflicting research evidence for ${label}.`);
  }
  return { freshness, triangulated: sources.size >= 2, conflicts, sufficient: retrieved.length > 0 && freshness !== "unknown" && conflicts.length === 0 };
}

export function decideResearchStopping(
  assessment: ResearchAssessment,
  sourceCount: number,
  maxSources = 5,
): ResearchStoppingDecision {
  if (assessment.conflicts.length > 0) {
    return { stop: true, reason: "conflict-detected", detail: "Stop research and resolve conflicting evidence before producing a synthesized conclusion." };
  }
  if (assessment.freshness === "unknown") {
    return {
      stop: true,
      reason: sourceCount === 0 ? "no-evidence" : "freshness-unknown",
      detail: sourceCount === 0 ? "Stop because no retrieved evidence is available." : "Stop because the available evidence has no reliable freshness context.",
    };
  }
  if (assessment.sufficient && assessment.triangulated) {
    return { stop: true, reason: "sufficient-evidence", detail: "Stop because the evidence is sufficient, current or appropriately dated, conflict-free, and triangulated across multiple sources." };
  }
  if (sourceCount >= maxSources) {
    return { stop: true, reason: "source-limit-reached", detail: `Stop after the configured maximum of ${maxSources} sources; do not continue indefinitely without sufficient corroboration.` };
  }
  return { stop: false, detail: "Continue research because the evidence is not yet sufficient for a verified synthesis." };
}
