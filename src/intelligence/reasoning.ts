import type { EvidenceItem, ReasoningConclusion, ReasoningResult } from "./types";

function supportedFact(item: EvidenceItem): ReasoningConclusion {
  return {
    type: "FACT",
    statement: item.detail,
    evidenceIds: [item.id],
    support: "supported",
  };
}

function localInference(evidence: EvidenceItem[]): ReasoningConclusion {
  return {
    type: "INFERENCE",
    statement: "BUSIQ has produced a deterministic local execution result from the supplied request and available local capabilities.",
    evidenceIds: evidence.filter(item => item.kind === "inferred").map(item => item.id),
    support: "supported",
  };
}

function hasVerifiedProvenance(item: EvidenceItem): boolean {
  return item.kind === "verified" || item.verification === "verified";
}

function normalizeDetail(detail: string): string {
  return detail.trim().toLowerCase().replace(/\\s+/g, " ");
}

function hasComparableScope(left: EvidenceItem, right: EvidenceItem): boolean {
  if (left.label.trim().toLowerCase() !== right.label.trim().toLowerCase()) return false;
  if (left.scope && right.scope && left.scope !== right.scope) return false;
  if (left.evidenceDate && right.evidenceDate && left.evidenceDate !== right.evidenceDate) return false;
  return true;
}

function direction(detail: string): "up" | "down" | "neutral" {
  const value = normalizeDetail(detail);
  if (/\\b(increased|increase|up|rose|rising|grew|growth)\\b/.test(value)) return "up";
  if (/\\b(decreased|decrease|down|fell|falling|declined|decline|dropped)\\b/.test(value)) return "down";
  return "neutral";
}

function detectConflicts(evidence: EvidenceItem[]): string[] {
  const conflicts: string[] = [];
  for (let i = 0; i < evidence.length; i += 1) {
    for (let j = i + 1; j < evidence.length; j += 1) {
      if (!hasComparableScope(evidence[i], evidence[j])) continue;
      const left = direction(evidence[i].detail);
      const right = direction(evidence[j].detail);
      if (left !== "neutral" && right !== "neutral" && left !== right) {
        conflicts.push(`Conflicting evidence: ${evidence[i].id} and ${evidence[j].id} report opposing directions for the same comparable subject.`);
      }
    }
  }
  return conflicts;
}

function multiEvidenceFinding(evidence: EvidenceItem[], request: string): ReasoningConclusion {
  return {
    type: "FINDING",
    statement: `The verified evidence set contains ${evidence.length} directly supported facts relevant to the request: ${request}`,
    evidenceIds: evidence.map(item => item.id),
    support: "supported",
  };
}

export function reasonFromEvidence(
  evidence: EvidenceItem[],
  verificationState: "passed" | "blocked",
  request: string,
): ReasoningResult {
  if (verificationState !== "passed") {
    return {
      state: "insufficient",
      conclusions: [],
      limitations: [
        "The available evidence is insufficient for a supported factual conclusion.",
        "BUSIQ will not convert missing or unverified information into a conclusion.",
      ],
    };
  }

  const retrieved = evidence.filter(item => item.kind === "retrieved" || item.kind === "verified");
  const verifiedRetrieved = retrieved.filter(hasVerifiedProvenance);
  const unverifiedRetrieved = retrieved.filter(item => !hasVerifiedProvenance(item));
  const directRetrieved = verifiedRetrieved.filter(item => item.relevance === "direct");
  const indirectRetrieved = verifiedRetrieved.filter(item => item.relevance === "indirect");
  const inferred = evidence.filter(item => item.kind === "inferred");

  if (retrieved.length > 0 && unverifiedRetrieved.length > 0) {
    return {
      state: "insufficient",
      conclusions: [],
      limitations: [
        "Retrieved evidence is present, but at least one retrieved item lacks verified provenance.",
        "BUSIQ will not present unverified retrieved material as established fact.",
      ],
    };
  }

  if (verifiedRetrieved.length > 0 && directRetrieved.length === 0) {
    return {
      state: "insufficient",
      conclusions: [],
      limitations: [
        "Verified evidence is available, but none is directly relevant to the requested question.",
        "BUSIQ will not promote indirectly related evidence into a factual answer without a direct evidentiary basis.",
      ],
    };
  }

  if (directRetrieved.length > 1) {
    const conflicts = detectConflicts(directRetrieved);
    if (conflicts.length > 0) {
      return {
        state: "insufficient",
        conclusions: directRetrieved.map(supportedFact),
        limitations: [
          ...conflicts,
          "Conflicting evidence must be reconciled before BUSIQ derives a combined finding or recommendation.",
        ],
      };
    }
    return {
      state: "ready",
      conclusions: [
        ...directRetrieved.map(supportedFact),
        multiEvidenceFinding(directRetrieved, request),
      ],
      limitations: [
        ...(indirectRetrieved.length ? ["Some verified evidence is indirectly relevant and was not promoted to a factual conclusion."] : []),
        ...(inferred.length ? ["Some available material is inferred rather than directly retrieved or verified."] : []),
      ],
    };
  }

  if (directRetrieved.length === 1) {
    return {
      state: "ready",
      conclusions: [supportedFact(directRetrieved[0])],
      limitations: inferred.length
        ? ["Some available material is inferred rather than directly retrieved or verified."]
        : [],
    };
  }

  if (inferred.length > 0) {
    return {
      state: "ready",
      conclusions: [localInference(inferred)],
      limitations: [
        "This is an inference about BUSIQ's local execution, not a business or external-world fact.",
      ],
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
