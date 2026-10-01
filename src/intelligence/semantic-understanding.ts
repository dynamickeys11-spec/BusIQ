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

const domainPatterns: Array<[string, RegExp]> = [
  ["sales", /\bsales?\b/i], ["customers", /\bcustomers?\b/i],
  ["money", /\b(?:revenue|profit|cash|income|cost|margin|expenses?)\b/i],
  ["inventory", /\binventory|stock\b/i], ["products", /\bproducts?\b/i],
  ["marketing", /\bmarketing|ads?|advertis(?:e|ing)\b/i],
  ["operations", /\boperations?|delivery|logistics|process(?:es)?\b/i],
  ["people", /\b(?:staff|employees?|people|team)\b/i],
  ["pricing", /\bprice|pricing|charge|cost\b/i],
  ["competitors", /\bcompetitors?|competition\b/i],
  ["market", /\bmarket|industry|demand|trend\b/i],
];

const quantityPattern = /\b(?:₦|\$|€|£)?\d[\d,.]*(?:\s*(?:k|m|million|thousand|%|percent))?\b/gi;
const timePattern = /\b(?:today|yesterday|tomorrow|now|currently|latest|recent|this week|this month|last week|last month|last year|next week|next month|\d{4})\b/i;

function operationOf(text: string): ConversationOperation {
  if (/\b(i meant|what i meant|not that|that's not what|correct(?:ion)?|actually)\b/i.test(text)) return "CORRECTION";
  if (/\b(?:that|this|it|the above|what you said|your last answer)\b/i.test(text) && /\b(?:yes|no|also|then|but|instead|and|what about|how about)\b/i.test(text)) return "FOLLOW_UP";
  if (/\b(?:what about|how about|also|add|include|expand|more on)\b/i.test(text)) return "EXPANSION";
  if (/\b(?:instead|rather|forget that|different question|new question)\b/i.test(text)) return "CHANGE_OF_DIRECTION";
  if (/\b(?:if|suppose|assuming|scenario|what if)\b/i.test(text)) return "SCENARIO";
  if (/\b(?:compare|versus|vs\.?|difference between|which is better|which one is better)\b/i.test(text)) return "COMPARISON";
  if (/\b(?:clarify|what do you mean|do you mean)\b/i.test(text)) return "CLARIFICATION";
  return "NEW_INTENT";
}

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

function fallbackBusinessRelevance(text: string, stage: BusinessStage): BusinessRelevance {
  if (/\b(?:BUSIQ|business|company|sales|revenue|profit|customers?|inventory|pricing|market|competitors?|startup|venture)\b/i.test(text)) return stage === "general" ? "indirect" : "direct";
  return stage === "general" ? "unknown" : "direct";
}

function fallbackMeaning(text: string, intent: IntentKind): string {
  if (/\b(?:how do you work|how does busiq work|what can you do|what do you need from me|how can i get (?:the )?best results|best performance)\b/i.test(text)) {
    return "Understand how BUSIQ operates and what conditions or inputs help it perform well.";
  }
  if (intent === "unknown") return "Understand the user's request without inventing a specific task.";
  return "Understand the user's requested outcome and determine the appropriate BUSIQ response.";
}

export function understandRequest(
  text: string,
  intent: ResolvedIntent,
  priorRequest?: string,
  priorContext: Array<{ key: string; value: string }> = [],
): SemanticUnderstanding {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  const operation = operationOf(normalizedText);
  const domains = domainPatterns.filter(([, p]) => p.test(normalizedText)).map(([name]) => name);
  const entities = intent.context?.entities ?? [];
  const quantities = normalizedText.match(quantityPattern) ?? [];
  const time = normalizedText.match(timePattern)?.[0];
  const references = [...normalizedText.matchAll(/\b(?:that|this|it|they|them|the above|your last answer|the previous|second one|first one|third one|second option|first option|third option|the other one|the other option)\b/gi)].map(m => m[0]);
  const constraints = [...normalizedText.matchAll(/\b(?:under|below|above|within|without|before|after|using|with|without)\s+[^,.!?]+/gi)].map(m => m[0].trim());
  const stage: BusinessStage = intent.businessStage ?? (/\b(?:my|our|current|existing)\b.*\b(?:business|company|sales|customers|inventory|profit|revenue)\b/i.test(normalizedText) ? "existing-business" : "general");
  const possibleInterpretations = [...(intent.ambiguityDetails ?? []), ...intent.context?.entities?.filter(() => false) ?? []];
  const signals: string[] = [];

  if (intent.kind !== "unknown") signals.push("intent-routing");
  if (intent.meaning) signals.push("model-meaning");
  if (intent.answerMode) signals.push("response-strategy");
  if (domains.length) signals.push("domain-terms");
  if (time) signals.push("temporal-context");
  if (quantities.length) signals.push("quantities");
  if (references.length) signals.push("conversation-reference");
  if (operation !== "NEW_INTENT") signals.push("conversation-operation");
  if ((priorRequest || priorContext.length) && references.length) possibleInterpretations.push("The request may refine, continue, or reference the previous conversation.");
  if (priorContext.length && references.length) signals.push("context-memory");
  if (intent.kind === "unknown" && !intent.answerMode) possibleInterpretations.push("The wording does not map cleanly to a known action; preserve the user's wording and avoid inventing intent.");
  if (!domains.length && stage === "general") possibleInterpretations.push("This may be a general informational or BUSIQ-system request rather than a business-data request.");

  const confidence = intent.context?.entities?.length && intent.kind !== "unknown"
    ? "high"
    : intent.kind === "unknown" ? "low" : (operation !== "NEW_INTENT" && references.length && !priorRequest && !priorContext.length ? "medium" : "high");

  return {
    normalizedText,
    meaning: intent.meaning ?? fallbackMeaning(normalizedText, intent.kind),
    operation,
    subject: intent.context?.scope,
    purpose: intent.purpose ?? fallbackPurpose(intent.kind),
    desiredOutcome: intent.desiredOutcome,
    businessRelevance: intent.businessRelevance ?? fallbackBusinessRelevance(normalizedText, stage),
    stage,
    answerMode: intent.answerMode ?? fallbackAnswerMode(intent.kind),
    requiresEvidence: intent.requiresEvidence ?? (intent.needsBusinessData || intent.needsExternalResearch),
    requiresBusinessData: intent.needsBusinessData,
    requiresExternalResearch: intent.needsExternalResearch,
    requiresUserInput: intent.requiresUserInput ?? false,
    domains,
    entities,
    constraints,
    time,
    quantities,
    references,
    possibleInterpretations: [...new Set(possibleInterpretations)],
    confidence: intent.context?.entities?.length ? confidence : (intent.kind === "unknown" ? "low" : confidence),
    signals,
  };
}
