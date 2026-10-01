import type { ModelProvider } from "../providers/types.js";
import type { ContextEntry } from "./context.js";
import type { AnswerMode, BusinessRelevance, BusinessStage, Purpose, ResolvedIntent } from "../bie/intent.js";
import { getCapability, listCapabilities } from "./capabilities.js";

const intentKinds: ResolvedIntent["kind"][] = ["investigate","compare","plan","create","retrieve","explain","monitor","unknown"];
const purposes: Purpose[] = ["understand","learn","decide","discover","compare","investigate","plan","create","retrieve","monitor","evaluate","improve","simulate","communicate","use_busiq","other"];
const answerModes: AnswerMode[] = ["direct_answer","explanation","business_analysis","investigation","comparison","decision_support","planning","creation","research","clarification","system_explanation"];
const businessRelevance: BusinessRelevance[] = ["direct","indirect","none","unknown"];
const businessStages: BusinessStage[] = ["pre-business","existing-business","unknown"];

export type ModelSemanticInterpretation = {
  kind: ResolvedIntent["kind"];
  label: string;
  meaning: string;
  purpose: Purpose;
  desiredOutcome: string;
  businessRelevance: BusinessRelevance;
  businessStage: BusinessStage;
  answerMode: AnswerMode;
  needsBusinessData: boolean;
  needsExternalResearch: boolean;
  requiresEvidence: boolean;
  requiresUserInput: boolean;
  requiredCapabilities: string[];
  confidence: "high" | "medium" | "low";
  entities: string[];
  constraints: string[];
  quantities: string[];
  time?: string;
  possibleInterpretations: string[];
  operation: "NEW_INTENT" | "FOLLOW_UP" | "CLARIFICATION" | "CORRECTION" | "EXPANSION" | "CONTRADICTION" | "REFERENCE" | "SCENARIO" | "COMPARISON" | "REFINEMENT" | "CHANGE_OF_DIRECTION";
  domains: string[];
  references: string[];
};

function parse(text: string): ModelSemanticInterpretation {
  const value = JSON.parse(text) as Partial<ModelSemanticInterpretation>;
  if (!intentKinds.includes(value.kind as ResolvedIntent["kind"])) throw new Error("Invalid semantic intent kind.");
  if (typeof value.label !== "string" || !value.label.trim()) throw new Error("Missing semantic label.");
  if (typeof value.meaning !== "string" || !value.meaning.trim()) throw new Error("Missing semantic meaning.");
  if (!purposes.includes(value.purpose as Purpose)) throw new Error("Invalid semantic purpose.");
  if (typeof value.desiredOutcome !== "string" || !value.desiredOutcome.trim()) throw new Error("Missing desired outcome.");
  if (!businessRelevance.includes(value.businessRelevance as BusinessRelevance)) throw new Error("Invalid business relevance.");
  if (!businessStages.includes(value.businessStage as BusinessStage)) throw new Error("Invalid business stage.");
  if (!answerModes.includes(value.answerMode as AnswerMode)) throw new Error("Invalid answer mode.");
  for (const key of ["needsBusinessData","needsExternalResearch","requiresEvidence","requiresUserInput"] as const) {
    if (typeof value[key] !== "boolean") throw new Error("Invalid " + key + ".");
  }
  if (!Array.isArray(value.requiredCapabilities) || !value.requiredCapabilities.every(item => typeof item === "string")) throw new Error("Invalid capabilities.");
  if (!["high","medium","low"].includes(value.confidence ?? "")) throw new Error("Invalid confidence.");
  if (!["NEW_INTENT","FOLLOW_UP","CLARIFICATION","CORRECTION","EXPANSION","CONTRADICTION","REFERENCE","SCENARIO","COMPARISON","REFINEMENT","CHANGE_OF_DIRECTION"].includes(value.operation ?? "")) throw new Error("Invalid conversation operation.");
  const arrays = ["entities","constraints","quantities","possibleInterpretations","domains","references"] as const;
  for (const key of arrays) {
    if (!Array.isArray(value[key]) || !value[key]!.every(item => typeof item === "string")) throw new Error("Invalid " + key + ".");
  }
  if (value.time !== undefined && typeof value.time !== "string") throw new Error("Invalid time.");
  const registered = new Set(listCapabilities().map(item => item.id));
  const requestedCapabilities = [...new Set(value.requiredCapabilities!.map(item => item.trim()).filter(Boolean))];
  const unknownCapabilities = requestedCapabilities.filter(item => !registered.has(item));
  if (unknownCapabilities.length) {
    throw new Error(`Model requested unregistered capabilities: ${unknownCapabilities.join(", ")}.`);
  }
  const capabilities = requestedCapabilities.slice(0, 30);
  return {
    kind: value.kind!,
    label: value.label!.trim().slice(0, 240),
    meaning: value.meaning!.trim().slice(0, 800),
    purpose: value.purpose!,
    desiredOutcome: value.desiredOutcome!.trim().slice(0, 500),
    businessRelevance: value.businessRelevance!,
    businessStage: value.businessStage!,
    answerMode: value.answerMode!,
    needsBusinessData: value.needsBusinessData!,
    needsExternalResearch: value.needsExternalResearch!,
    requiresEvidence: value.requiresEvidence!,
    requiresUserInput: value.requiresUserInput!,
    requiredCapabilities: capabilities,
    confidence: value.confidence!,
    entities: value.entities!.map(item => item.trim()).filter(Boolean).slice(0, 20),
    constraints: value.constraints!.map(item => item.trim()).filter(Boolean).slice(0, 20),
    quantities: value.quantities!.map(item => item.trim()).filter(Boolean).slice(0, 20),
    time: value.time?.trim().slice(0, 120),
    possibleInterpretations: value.possibleInterpretations!.map(item => item.trim()).filter(Boolean).slice(0, 10),
    operation: value.operation!,
    domains: value.domains!.map(item => item.trim()).filter(Boolean).slice(0, 30),
    references: value.references!.map(item => item.trim()).filter(Boolean).slice(0, 20),
  };
}

export async function interpretRequest(
  provider: ModelProvider,
  request: string,
  context: ContextEntry[] = [],
): Promise<ModelSemanticInterpretation> {
  const response = await provider.generate({
    system: [
      "You are BUSIQ's language understanding and response-strategy layer.",
      "Understand arbitrary natural language before deciding what BUSIQ should do.",
      "Do not answer the user's request.",
      "Do not invent business facts, evidence, entities, sources, or context.",
      "BUSIQ is business-oriented, but not every request is a business-data request.",
      "Distinguish the user's meaning from the execution strategy needed to answer it.",
      "Do not depend on phrase matching, keyword heuristics, or a deterministic language classifier.",
      "Preserve ambiguity instead of guessing.",
      "Use system_explanation for questions about BUSIQ itself, its operation, capabilities, inputs, limitations, or how to get better results.",
      "Use explanation for general concepts; business_analysis, investigation, comparison, decision_support, planning, creation, research, or direct_answer when those are the appropriate response modes.",
      "needsBusinessData is true only when current/internal business evidence is required.",
      "needsExternalResearch is true only when current/external evidence is required.",
      "requiresEvidence is true when a factual claim needs evidence beyond the user's wording.",
      "Return JSON only.",
    ].join(" "),
    prompt: JSON.stringify({
      request,
      capabilityRegistry: listCapabilities().map(item => ({ id: item.id, purpose: item.purpose, status: item.status })),
      relevantConversationContext: context.filter(entry => entry.kind === "conversation").slice(-12),
task: "Produce a semantic contract including meaning, purpose, business relevance/stage, answer mode, evidence requirements, conversation operation, entities, domains, constraints, quantities, time, references, ambiguity, and only registered capability IDs.",
      outputShape: {
        kind: "known execution kind or unknown",
        label: "short semantic label",
        meaning: "plain-language statement of what the user means",
        purpose: "understand | learn | decide | discover | compare | investigate | plan | create | retrieve | monitor | evaluate | improve | simulate | communicate | use_busiq | other",
        desiredOutcome: "what the user wants BUSIQ to accomplish",
        businessRelevance: "direct | indirect | none | unknown",
        businessStage: "pre-business | existing-business | unknown",
        answerMode: "direct_answer | explanation | business_analysis | investigation | comparison | decision_support | planning | creation | research | clarification | system_explanation",
        needsBusinessData: "true only when internal/current business data is needed",
        needsExternalResearch: "true only when current/external information is needed",
        requiresEvidence: "true when factual claims require evidence",
        requiresUserInput: "true only when missing user information must be supplied",
        requiredCapabilities: ["registered capability IDs only"],
        confidence: "high | medium | low",
        entities: ["explicit entities only"],
        constraints: ["explicit constraints only"],
        quantities: ["quantities explicitly present"],
        time: "explicit time context if present",
        possibleInterpretations: ["only when materially ambiguous"],
        operation: "NEW_INTENT | FOLLOW_UP | CLARIFICATION | CORRECTION | EXPANSION | CONTRADICTION | REFERENCE | SCENARIO | COMPARISON | REFINEMENT | CHANGE_OF_DIRECTION",
        domains: ["business domains relevant to the request"],
        references: ["semantic references from supplied context; never invent identifiers"],
      },
    }),
    temperature: 0,
    maxOutputTokens: 1000,
    responseFormat: "json",
  });
  return parse(response.text);
}

export function semanticInterpretationToIntent(request: string, interpretation: ModelSemanticInterpretation): ResolvedIntent {
  const capabilities = new Set(interpretation.requiredCapabilities.filter(id => Boolean(getCapability(id))));
  if (interpretation.answerMode === "planning") capabilities.add("planning");
  if (interpretation.answerMode === "creation") capabilities.add("content-generation");
  if (interpretation.answerMode === "explanation" || interpretation.answerMode === "system_explanation") capabilities.add("explanation");
  if (interpretation.answerMode === "comparison") capabilities.add("comparison");
  if (interpretation.requiresEvidence) capabilities.add("evidence-review");
  if (interpretation.needsBusinessData) capabilities.add("business-data-retrieval");
  if (interpretation.needsExternalResearch) capabilities.add("external-research");
  return {
    kind: interpretation.kind,
    label: interpretation.label,
    normalizedRequest: request.trim().replace(/\\s+/g, " "),
    requiredCapabilities: [...capabilities],
    needsBusinessData: interpretation.needsBusinessData,
    needsExternalResearch: interpretation.needsExternalResearch,
    ambiguity: interpretation.possibleInterpretations.length ? "material" : "none",
    candidates: [{ kind: interpretation.kind, score: interpretation.confidence === "high" ? 1 : interpretation.confidence === "medium" ? 0.7 : 0.3, reasons: ["Model semantic interpretation"] }],
    context: { business: interpretation.businessStage === "existing-business" ? "current business" : undefined, time: interpretation.time, scope: interpretation.domains[0], entities: interpretation.entities },
    meaning: interpretation.meaning,
    purpose: interpretation.purpose,
    desiredOutcome: interpretation.desiredOutcome,
    businessRelevance: interpretation.businessRelevance,
    businessStage: interpretation.businessStage,
    answerMode: interpretation.answerMode,
    requiresEvidence: interpretation.requiresEvidence,
    requiresUserInput: interpretation.requiresUserInput,
    ambiguityDetails: interpretation.possibleInterpretations,
  };
}

export function mergeSemanticInterpretation(
  baseline: ResolvedIntent,
  interpretation: ModelSemanticInterpretation,
): ResolvedIntent {
  if (interpretation.confidence === "low") return baseline;
  return semanticInterpretationToIntent(baseline.normalizedRequest, interpretation);
}
