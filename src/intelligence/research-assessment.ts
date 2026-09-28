import type { EvidenceItem } from "./types";

export type ResearchAssessment = {
  freshness: "current" | "dated" | "unknown";
  triangulated: boolean;
  conflicts: string[];
  sufficient: boolean;
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
      if (/\b(increase|increased|up|rose|rising|grew|growth)\b/.test(text)) return "up";
      if (/\b(decrease|decreased|down|fell|falling|declined|decline|dropped)\b/.test(text)) return "down";
      return "neutral";
    }).filter(x => x !== "neutral"));
    if (directions.size > 1) conflicts.push(`Conflicting research evidence for ${label}.`);
  }
  return { freshness, triangulated: sources.size >= 2, conflicts, sufficient: retrieved.length > 0 && freshness !== "unknown" && conflicts.length === 0 };
}
