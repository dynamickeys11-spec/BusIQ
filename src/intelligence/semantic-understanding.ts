import type { IntentKind, ResolvedIntent } from "../bie/intent.js";

export type ConversationOperation =
  | "NEW_INTENT" | "FOLLOW_UP" | "CLARIFICATION" | "CORRECTION"
  | "EXPANSION" | "CONTRADICTION" | "REFERENCE" | "SCENARIO"
  | "COMPARISON" | "REFINEMENT" | "CHANGE_OF_DIRECTION";

export type SemanticUnderstanding = {
  normalizedText: string;
  operation: ConversationOperation;
  subject?: string;
  desiredOutcome?: string;
  stage: "pre-business" | "existing-business" | "general";
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
  if (/\b(?:compare|versus|vs\.?|difference between)\b/i.test(text)) return "COMPARISON";
  if (/\b(?:clarify|what do you mean|do you mean)\b/i.test(text)) return "CLARIFICATION";
  return "NEW_INTENT";
}

function stageOf(text: string): SemanticUnderstanding["stage"] {
  if (/\b(?:i don't have|i do not have|no)\b.*\b(?:business|business idea|idea)\b|\bwhat business should i start\b|\b(?:start|launch|build) (?:a|an|my) (?:business|company|venture)\b/i.test(text)) return "pre-business";
  if (/\b(?:my|our|current|existing)\b.*\b(?:business|company|sales|customers|inventory|profit|revenue)\b/i.test(text)) return "existing-business";
  return "general";
}

function desiredOutcome(text: string, intent: IntentKind): string | undefined {
  if (/\b(?:what should i do|where should i start|what do i focus on|what next)\b/i.test(text)) return "decision support and next-step guidance";
  if (intent === "investigate") return "explain what is happening and test candidate explanations";
  if (intent === "compare") return "compare the relevant alternatives using evidence and assumptions";
  if (intent === "plan") return "produce an actionable plan";
  if (intent === "create") return "produce the requested artifact";
  if (intent === "retrieve") return "retrieve the requested information";
  if (intent === "explain") return "explain the requested concept or situation";
  if (intent === "monitor") return "track the requested condition over time";
  return undefined;
}

export function understandRequest(text: string, intent: ResolvedIntent, priorRequest?: string, priorContext: Array<{ key: string; value: string }> = []): SemanticUnderstanding {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  const operation = operationOf(normalizedText);
  const domains = domainPatterns.filter(([, p]) => p.test(normalizedText)).map(([name]) => name);
  const entities = intent.context?.entities ?? [];
  const quantities = normalizedText.match(quantityPattern) ?? [];
  const time = normalizedText.match(timePattern)?.[0];
  const references = [...normalizedText.matchAll(/\b(?:that|this|it|they|them|the above|your last answer|the previous|second one|first one|third one|the other one)\b/gi)].map(m => m[0]);
  const constraints = [...normalizedText.matchAll(/\b(?:under|below|above|within|without|before|after|using|with|without)\s+[^,.!?]+/gi)].map(m => m[0].trim());
  const stage = stageOf(normalizedText);
  const possibleInterpretations: string[] = [];
  const signals: string[] = [];

  if (intent.kind !== "unknown") signals.push("intent-routing");
  if (domains.length) signals.push("domain-terms");
  if (time) signals.push("temporal-context");
  if (quantities.length) signals.push("quantities");
  if (references.length) signals.push("conversation-reference");
  if (operation !== "NEW_INTENT") signals.push("conversation-operation");
  if ((priorRequest || priorContext.length) && references.length) possibleInterpretations.push("The request may refine, continue, or reference the previous conversation.");
  if (priorContext.length && references.length) signals.push("context-memory");
  if (intent.kind === "unknown") possibleInterpretations.push("The wording does not map cleanly to a known action; preserve the user's wording and avoid inventing intent.");
  if (!domains.length && stage === "general") possibleInterpretations.push("This may be a general informational request rather than a business-data request.");

  const confidence = intent.kind === "unknown" ? "low" : operation !== "NEW_INTENT" && references.length && !priorRequest && !priorContext.length ? "medium" : "high";
  return {
    normalizedText,
    operation,
    subject: intent.context?.scope,
    desiredOutcome: desiredOutcome(normalizedText, intent.kind),
    stage,
    domains,
    entities,
    constraints,
    time,
    quantities,
    references,
    possibleInterpretations,
    confidence,
    signals,
  };
}
