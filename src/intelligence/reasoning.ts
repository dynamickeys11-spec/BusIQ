import type { EvidenceItem, ReasoningChain, ReasoningConclusion, ReasoningResult } from "./types.js";

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
  return detail.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasComparableScope(left: EvidenceItem, right: EvidenceItem): boolean {
  if (left.label.trim().toLowerCase() !== right.label.trim().toLowerCase()) return false;
  if (left.scope && right.scope && JSON.stringify(left.scope) !== JSON.stringify(right.scope)) return false;
  if (left.evidenceDate && right.evidenceDate && left.evidenceDate !== right.evidenceDate) return false;
  return true;
}

function direction(detail: string): "up" | "down" | "neutral" {
  const value = normalizeDetail(detail);
  if (/\b(increased|increase|up|rose|rising|grew|growth)\b/.test(value)) return "up";
  if (/\b(decreased|decrease|down|fell|falling|declined|decline|dropped)\b/.test(value)) return "down";
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

function requestsRecommendation(request: string): boolean {
  return /\b(recommend|recommendation|what should (i|we)|should i|should we|which (option|one)|best option|best choice)\b/i.test(request);
}

function hasDecisionCriteria(request: string): boolean {
  return /\b(based on|according to|criteria|priority|priorities|budget|cost|margin|profit|risk|deadline|goal|goals|constraint|constraints)\b/i.test(request);
}

function recommendationConclusion(finding: ReasoningConclusion): ReasoningConclusion {
  return {
    type: "RECOMMENDATION",
    statement: "Use the verified finding as the evidence basis for the decision, applying the explicit decision criteria before taking action.",
    evidenceIds: finding.evidenceIds,
    support: "supported",
  };
}

function buildChains(conclusions: ReasoningConclusion[]): ReasoningChain[] {
  const ids = conclusions.map((conclusion, index) => `${conclusion.type.toLowerCase()}-${index + 1}`);
  return conclusions.map((conclusion, index) => {
    const conclusionId = ids[index];
    const derivedDependencies = conclusion.type === "FINDING"
      ? conclusions.slice(0, index).map((item, itemIndex) => item.type === "FACT" ? ids[itemIndex] : null).filter((id): id is string => Boolean(id))
      : conclusion.type === "RECOMMENDATION"
        ? conclusions.slice(0, index).map((item, itemIndex) => item.type === "FINDING" ? ids[itemIndex] : null).filter((id): id is string => Boolean(id)).slice(-1)
        : [];
    return { conclusionId, type: conclusion.type, evidenceIds: conclusion.evidenceIds, dependsOn: conclusion.dependsOn ?? derivedDependencies };
  });
}

function insufficientRecommendation(request: string): ReasoningConclusion {
  const criteria = hasDecisionCriteria(request);
  return {
    type: "RECOMMENDATION",
    statement: criteria
      ? "A recommendation is requested, but the available evidence does not support a decision yet."
      : "A recommendation is requested, but explicit decision criteria are missing. BUSIQ will not invent criteria or choose an option without them.",
    evidenceIds: [],
    support: "insufficient",
  };
}

export function reasonFromEvidence(
  evidence: EvidenceItem[],
  verificationState: "passed" | "blocked",
  request: string,
): ReasoningResult {
  if (verificationState !== "passed") {
    const recommendation = requestsRecommendation(request) ? insufficientRecommendation(request) : undefined;
    const conclusions = recommendation ? [recommendation] : [];
    return {
      state: "insufficient",
      conclusions,
      limitations: [
        "The available evidence is insufficient for a supported factual conclusion.",
        "BUSIQ will not convert missing or unverified information into a conclusion.",
        ...(recommendation && !hasDecisionCriteria(request) ? ["Decision criteria are missing for a supported recommendation."] : []),
      ],
      chains: buildChains(conclusions),
    };
  }

  const retrieved = evidence.filter(item => item.kind === "retrieved" || item.kind === "verified");
  const verifiedRetrieved = retrieved.filter(hasVerifiedProvenance);
  const unverifiedRetrieved = retrieved.filter(item => !hasVerifiedProvenance(item));
  const directRetrieved = verifiedRetrieved.filter(item => item.relevance === "direct");
  const indirectRetrieved = verifiedRetrieved.filter(item => item.relevance === "indirect");
  const inferred = evidence.filter(item => item.kind === "inferred");

  if (retrieved.length > 0 && unverifiedRetrieved.length > 0) {
    const recommendation = requestsRecommendation(request) ? insufficientRecommendation(request) : undefined;
    const conclusions = recommendation ? [recommendation] : [];
    return {
      state: "insufficient",
      conclusions,
      limitations: [
        "Retrieved evidence is present, but at least one retrieved item lacks verified provenance.",
        "BUSIQ will not present unverified retrieved material as established fact.",
      ],
      chains: buildChains(conclusions),
    };
  }

  if (verifiedRetrieved.length > 0 && directRetrieved.length === 0) {
    const recommendation = requestsRecommendation(request) ? insufficientRecommendation(request) : undefined;
    const conclusions = recommendation ? [recommendation] : [];
    return {
      state: "insufficient",
      conclusions,
      limitations: [
        "Verified evidence is available, but none is directly relevant to the requested question.",
        "BUSIQ will not promote indirectly related evidence into a factual answer without a direct evidentiary basis.",
        ...(recommendation ? ["A recommendation also requires directly relevant evidence."] : []),
      ],
      chains: buildChains(conclusions),
    };
  }

  if (directRetrieved.length > 1) {
    const conflicts = detectConflicts(directRetrieved);
    const facts = directRetrieved.map(supportedFact);
    if (conflicts.length > 0) {
      const recommendation = requestsRecommendation(request) ? insufficientRecommendation(request) : undefined;
      const conclusions = recommendation ? [...facts, recommendation] : facts;
      return {
        state: "insufficient",
        conclusions,
        limitations: [
          ...conflicts,
          "Conflicting evidence must be reconciled before BUSIQ derives a combined finding or recommendation.",
        ],
        chains: buildChains(conclusions),
      };
    }
    const finding = multiEvidenceFinding(directRetrieved, request);
    const conclusions: ReasoningConclusion[] = [...facts, finding];
    if (requestsRecommendation(request)) {
      if (!hasDecisionCriteria(request)) {
        conclusions.push(insufficientRecommendation(request));
      } else {
        conclusions.push(recommendationConclusion(finding));
      }
    }
    return {
      state: conclusions.some(item => item.support === "insufficient") ? "insufficient" : "ready",
      conclusions,
      limitations: [
        ...(indirectRetrieved.length ? ["Some verified evidence is indirectly relevant and was not promoted to a factual conclusion."] : []),
        ...(inferred.length ? ["Some available material is inferred rather than directly retrieved or verified."] : []),
        ...(requestsRecommendation(request) && !hasDecisionCriteria(request) ? ["Decision criteria are missing for a supported recommendation."] : []),
      ],
      chains: buildChains(conclusions),
    };
  }

  if (directRetrieved.length === 1) {
    const fact = supportedFact(directRetrieved[0]);
    const conclusions: ReasoningConclusion[] = [fact];
    if (requestsRecommendation(request)) conclusions.push(insufficientRecommendation(request));
    return {
      state: requestsRecommendation(request) ? "insufficient" : "ready",
      conclusions,
      limitations: [
        ...(inferred.length ? ["Some available material is inferred rather than directly retrieved or verified."] : []),
        ...(requestsRecommendation(request) ? ["A supported recommendation requires sufficient evidence and explicit decision criteria."] : []),
      ],
      chains: buildChains(conclusions),
    };
  }

  if (inferred.length > 0) {
    const inference = localInference(inferred);
    const conclusions: ReasoningConclusion[] = [inference];
    if (requestsRecommendation(request)) conclusions.push(insufficientRecommendation(request));
    return {
      state: requestsRecommendation(request) ? "insufficient" : "ready",
      conclusions,
      limitations: [
        "This is an inference about BUSIQ's local execution, not a business or external-world fact.",
        ...(requestsRecommendation(request) ? ["A local execution inference is not enough to support a business recommendation."] : []),
      ],
      chains: buildChains(conclusions),
    };
  }

  const inference: ReasoningConclusion = {
    type: "INFERENCE",
    statement: `BUSIQ can execute the requested local capability for: ${request}`,
    evidenceIds: [],
    support: "supported",
  };
  const conclusions: ReasoningConclusion[] = [inference];
  if (requestsRecommendation(request)) conclusions.push(insufficientRecommendation(request));
  return {
    state: requestsRecommendation(request) ? "insufficient" : "ready",
    conclusions,
    limitations: [
      "No retrieved business or external evidence is available.",
      ...(requestsRecommendation(request) ? ["A recommendation cannot be supported without relevant evidence and explicit criteria."] : []),
    ],
    chains: buildChains(conclusions),
  };
}
