import type { ModelProvider } from "../providers/types.js";
import type { ContextEntry } from "./context.js";
import type { AnswerMode, BusinessRelevance, BusinessStage, Purpose, ResolvedIntent } from "../bie/intent.js";

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
  referencedPossibilities?: number[];
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
  const arrays = ["entities","constraints","quantities","possibleInterpretations"] as const;
  for (const key of arrays) {
    if (!Array.isArray(value[key]) || !value[key]!.every(item => typeof item === "string")) throw new Error("Invalid " + key + ".");
  }
  if (value.time !== undefined && typeof value.time !== "string") throw new Error("Invalid time.");
  if (value.referencedPossibilities !== undefined && (!Array.isArray(value.referencedPossibilities) || !value.referencedPossibilities.every(item => Number.isInteger(item) && item > 0))) throw new Error("Invalid referenced possibilities.");
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
    requiredCapabilities: [...new Set(value.requiredCapabilities!.map(item => item.trim()).filter(Boolean))].slice(0, 30),
    confidence: value.confidence!,
    entities: value.entities!.map(item => item.trim()).filter(Boolean).slice(0, 20),
    constraints: value.constraints!.map(item => item.trim()).filter(Boolean).slice(0, 20),
    quantities: value.quantities!.map(item => item.trim()).filter(Boolean).slice(0, 20),
    time: value.time?.trim().slice(0, 120),
    possibleInterpretations: value.possibleInterpretations!.map(item => item.trim()).filter(Boolean).slice(0, 10),
    referencedPossibilities: value.referencedPossibilities?.slice(0, 10),
  };
}

export async function interpretRequest(
  provider: ModelProvider,
  request: string,
  baseline: ResolvedIntent,
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
      "Use the deterministic baseline as a governance signal, not as a limit on natural-language understanding.",
      "Correct the baseline when the wording clearly means something else.",
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
      deterministicBaseline: baseline,
      relevantConversationContext: context.filter(entry => entry.kind === "conversation").slice(-12),
      task: "Produce a semantic contract: meaning, purpose, business relevance/stage, answer mode, evidence requirements, entities, constraints, quantities, time, ambiguity, and referenced possibility ordinals.",
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
        requiredCapabilities: ["capability names"],
        confidence: "high | medium | low",
        entities: ["explicit entities only"],
        constraints: ["explicit constraints only"],
        quantities: ["quantities explicitly present"],
        time: "explicit time context if present",
        possibleInterpretations: ["only when materially ambiguous"],
        referencedPossibilities: ["option ordinals explicitly referenced, e.g. [2]"],
      },
    }),
    temperature: 0,
    maxOutputTokens: 1000,
    responseFormat: "json",
  });
  return parse(response.text);
}

export function mergeSemanticInterpretation(
  baseline: ResolvedIntent,
  interpretation: ModelSemanticInterpretation,
): ResolvedIntent {
  const useModel = interpretation.confidence !== "low";
  const useModelKind = useModel && interpretation.kind !== "unknown";
  const modelRequiresBusinessData = interpretation.needsBusinessData;
  const modelRequiresResearch = interpretation.needsExternalResearch;
  return {
    ...baseline,
    kind: useModelKind ? interpretation.kind : baseline.kind,
    label: useModel ? interpretation.label : baseline.label,
    meaning: useModel ? interpretation.meaning : baseline.meaning,
    purpose: useModel ? interpretation.purpose : baseline.purpose,
    desiredOutcome: useModel ? interpretation.desiredOutcome : baseline.desiredOutcome,
    businessRelevance: useModel ? interpretation.businessRelevance : baseline.businessRelevance,
    businessStage: useModel ? interpretation.businessStage : baseline.businessStage,
    answerMode: useModel ? interpretation.answerMode : baseline.answerMode,
    requiredCapabilities: [...new Set([...baseline.requiredCapabilities, ...interpretation.requiredCapabilities])],
    needsBusinessData: baseline.needsBusinessData || modelRequiresBusinessData,
    needsExternalResearch: baseline.needsExternalResearch || modelRequiresResearch,
    ambiguity: interpretation.possibleInterpretations.length ? "material" : baseline.ambiguity,
    ambiguityDetails: interpretation.possibleInterpretations,
    requiresEvidence: baseline.requiresEvidence || interpretation.requiresEvidence,
    requiresUserInput: baseline.requiresUserInput || interpretation.requiresUserInput,
    candidates: baseline.candidates,
    context: {
      ...(baseline.context ?? {}),
      entities: [...new Set([...(baseline.context?.entities ?? []), ...interpretation.entities])],
      time: interpretation.time ?? baseline.context?.time,
    },
  };
}
