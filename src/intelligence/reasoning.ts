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

  if (verifiedRetrieved.length > 0) {
    return {
      state: "ready",
      conclusions: verifiedRetrieved.map(supportedFact),
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
