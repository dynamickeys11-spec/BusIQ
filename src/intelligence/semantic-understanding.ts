import type { AnswerMode, BusinessRelevance, BusinessStage, IntentKind, Purpose, ResolvedIntent } from "../bie/intent.js";

export type ConversationOperation =
  | "NEW_INTENT" | "FOLLOW_UP" | "CLARIFICATION" | "CORRECTION"
  | "EXPANSION" | "CONTRADICTION" | "REFERENCE" | "SCENARIO"
  | "COMPARISON" | "REFINEMENT" | "CHANGE_OF_DIRECTION";

export type SemanticUnderstanding = {
  normalizedText: string;
  meaning: string;
  operation: ConversationOperation;
  subject?: string;
  purpose: Purpose;
  desiredOutcome?: string;
  businessRelevance: BusinessRelevance;
  stage: BusinessStage;
  answerMode: AnswerMode;
  requiresEvidence: boolean;
  requiresBusinessData: boolean;
  requiresExternalResearch: boolean;
  requiresUserInput: boolean;
  domains: string[];
  entities: string[];
  constraints: string[];
  time?: string;
  quantities: string[];
  references: string[];
  possibleInterpretations: string[];
  confidence: "high" | "medium" | "low";
  signals: string[];
};

const operationSet = new Set<ConversationOperation>([
  "NEW_INTENT","FOLLOW_UP","CLARIFICATION","CORRECTION","EXPANSION",
  "CONTRADICTION","REFERENCE","SCENARIO","COMPARISON","REFINEMENT",
  "CHANGE_OF_DIRECTION",
]);

function fallbackPurpose(intent: IntentKind): Purpose {
  if (intent === "investigate") return "investigate";
  if (intent === "compare") return "compare";
  if (intent === "plan") return "plan";
  if (intent === "create") return "create";
  if (intent === "retrieve") return "retrieve";
  if (intent === "explain") return "understand";
  if (intent === "monitor") return "monitor";
  return "other";
}

function fallbackAnswerMode(intent: IntentKind): AnswerMode {
  if (intent === "investigate") return "investigation";
  if (intent === "compare") return "comparison";
  if (intent === "plan") return "planning";
  if (intent === "create") return "creation";
  if (intent === "retrieve") return "direct_answer";
  if (intent === "explain") return "explanation";
  if (intent === "monitor") return "business_analysis";
  return "clarification";
}

function fallbackDesiredOutcome(intent: ResolvedIntent): string {
  if (intent.desiredOutcome) return intent.desiredOutcome;
  switch (intent.answerMode ?? fallbackAnswerMode(intent.kind)) {
    case "comparison": return "Compare the relevant alternatives using explicit criteria and available evidence.";
    case "investigation": return "Understand what is happening and test candidate explanations.";
    case "planning": return "Produce an actionable plan grounded in the available context.";
    case "creation": return "Produce the requested artifact without inventing unsupported facts.";
    case "direct_answer": return "Provide the requested information directly.";
    case "explanation": return "Explain the requested concept clearly and accurately.";
    case "system_explanation": return "Explain BUSIQ's operation, capabilities, requirements, or limitations.";
    case "business_analysis": return "Analyze the relevant business condition using available evidence.";
    case "decision_support": return "Clarify the decision, trade-offs, evidence, and uncertainty.";
    case "research": return "Gather and synthesize the required external evidence.";
    default: return "Understand and respond to the user's requested outcome.";
  }
}

export function semanticInterpretationToUnderstanding(
  normalizedText: string,
  interpretation: {
    meaning: string;
    purpose: Purpose;
    desiredOutcome: string;
    businessRelevance: BusinessRelevance;
    businessStage: BusinessStage;
    answerMode: AnswerMode;
    operation: ConversationOperation;
    requiresEvidence: boolean;
    needsBusinessData: boolean;
    needsExternalResearch: boolean;
    requiresUserInput: boolean;
    domains: string[];
    entities: string[];
    constraints: string[];
    time?: string;
    quantities: string[];
    references: string[];
    possibleInterpretations: string[];
    confidence: "high" | "medium" | "low";
  },
): SemanticUnderstanding {
  const operation = operationSet.has(interpretation.operation) ? interpretation.operation : "NEW_INTENT";
  return {
    normalizedText: normalizedText.trim().replace(/\s+/g, " "),
    meaning: interpretation.meaning,
    operation,
    purpose: interpretation.purpose,
    desiredOutcome: interpretation.desiredOutcome,
    businessRelevance: interpretation.businessRelevance,
    stage: interpretation.businessStage,
    answerMode: interpretation.answerMode,
    requiresEvidence: interpretation.requiresEvidence,
    requiresBusinessData: interpretation.needsBusinessData,
    requiresExternalResearch: interpretation.needsExternalResearch,
    requiresUserInput: interpretation.requiresUserInput,
    domains: interpretation.domains,
    entities: interpretation.entities,
    constraints: interpretation.constraints,
    time: interpretation.time,
    quantities: interpretation.quantities,
    references: interpretation.references,
    possibleInterpretations: interpretation.possibleInterpretations,
    confidence: interpretation.confidence,
    signals: ["model-semantic-contract", "capability-aware-understanding", "context-aware-understanding"],
  };
}

/**
 * Compatibility path used only when the model semantic layer is unavailable.
 * It consumes already-resolved structured fields; it does not interpret language.
 */
export function understandRequest(
  text: string,
  intent: ResolvedIntent,
  _priorRequest?: string,
  _priorContext: Array<{ key: string; value: string }> = [],
): SemanticUnderstanding {
  const answerMode = intent.answerMode ?? fallbackAnswerMode(intent.kind);
  const businessStage = intent.businessStage ?? "unknown";
  return {
    normalizedText: text.trim().replace(/\s+/g, " "),
    meaning: intent.meaning ?? "Understand the user's requested outcome and determine the appropriate BUSIQ response.",
    operation: "NEW_INTENT",
    subject: intent.context?.scope,
    purpose: intent.purpose ?? fallbackPurpose(intent.kind),
    desiredOutcome: fallbackDesiredOutcome(intent),
    businessRelevance: intent.businessRelevance ?? "unknown",
    stage: businessStage,
    answerMode,
    requiresEvidence: intent.requiresEvidence ?? (intent.needsBusinessData || intent.needsExternalResearch),
    requiresBusinessData: intent.needsBusinessData,
    requiresExternalResearch: intent.needsExternalResearch,
    requiresUserInput: intent.requiresUserInput ?? false,
    domains: intent.context?.scope ? [intent.context.scope] : [],
    entities: intent.context?.entities ?? [],
    constraints: [],
    time: intent.context?.time,
    quantities: [],
    references: [],
    possibleInterpretations: intent.ambiguityDetails ?? [],
    confidence: intent.kind === "unknown" ? "low" : "medium",
    signals: ["deterministic-compatibility-fallback"],
  };
}
