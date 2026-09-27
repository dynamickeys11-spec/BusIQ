import type { EvidenceItem, ReasoningResult } from "./types";

export function reasonFromEvidence(
  evidence: EvidenceItem[],
  verificationState: "passed" | "blocked",
  request: string,
): ReasoningResult {
  const retrieved = evidence.filter(item => item.kind === "retrieved" || item.kind === "verified");
  const inferred = evidence.filter(item => item.kind === "inferred");

  if (verificationState !== "passed") {
    return {
      state: "insufficient",
      conclusions: [],
      limitations: ["The available evidence is insufficient for a supported factual conclusion."],
    };
  }

  if (retrieved.length > 0) {
    return {
      state: "ready",
      conclusions: retrieved.map(item => ({
        type: "FACT" as const,
        statement: item.detail,
        evidenceIds: [item.id],
        support: "supported" as const,
      })),
      limitations: inferred.length
        ? ["Some available material is inferred rather than directly retrieved or verified."]
        : [],
    };
  }

  if (inferred.length > 0) {
    return {
      state: "ready",
      conclusions: [{
        type: "INFERENCE",
        statement: inferred[0].detail,
        evidenceIds: inferred.map(item => item.id),
        support: "supported",
      }],
      limitations: ["This conclusion is derived from BUSIQ's local execution structure, not external business facts."],
    };
  }

  return {
    state: "ready",
    conclusions: [{
      type: "INFERENCE",
      statement: `BUSIQ can execute the requested local capability for: ${request}`,
      evidenceIds: [],
      support: "supported",
    }],
    limitations: ["No retrieved business or external evidence is available."],
  };
}
