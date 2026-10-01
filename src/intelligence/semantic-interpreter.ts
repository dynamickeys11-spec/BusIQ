import type { ModelProvider } from "../providers/types.js";
import type { ResolvedIntent, IntentKind } from "../bie/intent.js";

const intentKinds: IntentKind[] = ["investigate","compare","plan","create","retrieve","explain","monitor","unknown"];

export type ModelSemanticInterpretation = {
  kind: IntentKind;
  label: string;
  desiredOutcome: string;
  needsBusinessData: boolean;
  needsExternalResearch: boolean;
  requiredCapabilities: string[];
  confidence: "high" | "medium" | "low";
  entities: string[];
  constraints: string[];
  possibleInterpretations: string[];
};

function parse(text: string): ModelSemanticInterpretation {
  const value = JSON.parse(text) as Partial<ModelSemanticInterpretation>;
  if (!intentKinds.includes(value.kind as IntentKind)) throw new Error("Invalid semantic intent kind.");
  if (typeof value.label !== "string" || !value.label.trim()) throw new Error("Missing semantic label.");
  if (typeof value.desiredOutcome !== "string" || !value.desiredOutcome.trim()) throw new Error("Missing desired outcome.");
  if (typeof value.needsBusinessData !== "boolean") throw new Error("Invalid business-data requirement.");
  if (typeof value.needsExternalResearch !== "boolean") throw new Error("Invalid research requirement.");
  if (!Array.isArray(value.requiredCapabilities) || !value.requiredCapabilities.every(item => typeof item === "string")) throw new Error("Invalid capabilities.");
  if (!["high","medium","low"].includes(value.confidence ?? "")) throw new Error("Invalid confidence.");
  const arrays = ["entities","constraints","possibleInterpretations"] as const;
  for (const key of arrays) {
    if (!Array.isArray(value[key]) || !value[key]!.every(item => typeof item === "string")) throw new Error("Invalid " + key + ".");
  }
  return {
    kind: value.kind!,
    label: value.label!.trim().slice(0, 240),
    desiredOutcome: value.desiredOutcome!.trim().slice(0, 500),
    needsBusinessData: value.needsBusinessData!,
    needsExternalResearch: value.needsExternalResearch!,
    requiredCapabilities: [...new Set(value.requiredCapabilities!.map(item => item.trim()).filter(Boolean))].slice(0, 30),
    confidence: value.confidence!,
    entities: value.entities!.map(item => item.trim()).filter(Boolean).slice(0, 20),
    constraints: value.constraints!.map(item => item.trim()).filter(Boolean).slice(0, 20),
    possibleInterpretations: value.possibleInterpretations!.map(item => item.trim()).filter(Boolean).slice(0, 10),
  };
}

export async function interpretRequest(
  provider: ModelProvider,
  request: string,
  baseline: ResolvedIntent,
): Promise<ModelSemanticInterpretation> {
  const response = await provider.generate({
    system: [
      "You are BUSIQ Gate 0: semantic understanding.",
      "Interpret what the user means before deciding what BUSIQ should do.",
      "Do not answer the user's request.",
      "Do not invent business facts, evidence, entities, sources, or context.",
      "Use the deterministic baseline as a constraint, but correct it when the wording clearly means something else.",
      "Preserve ambiguity when multiple interpretations are plausible.",
      "The intent kind must be one of: investigate, compare, plan, create, retrieve, explain, monitor, unknown.",
      "Return JSON only.",
    ].join(" "),
    prompt: JSON.stringify({
      request,
      deterministicBaseline: baseline,
      task: "Return a structured semantic interpretation of the request.",
      outputShape: {
        kind: "intent kind",
        label: "short label",
        desiredOutcome: "what the user wants BUSIQ to accomplish",
        needsBusinessData: "true only when internal/current business data is needed",
        needsExternalResearch: "true only when current/external information is needed",
        requiredCapabilities: ["capability names"],
        confidence: "high | medium | low",
        entities: ["explicit entities only"],
        constraints: ["explicit constraints only"],
        possibleInterpretations: ["plausible interpretations when ambiguity exists"],
      },
    }),
    temperature: 0,
    maxOutputTokens: 700,
    responseFormat: "json",
  });
  return parse(response.text);
}

export function mergeSemanticInterpretation(
  baseline: ResolvedIntent,
  interpretation: ModelSemanticInterpretation,
): ResolvedIntent {
  const useModelKind = interpretation.kind !== "unknown" && interpretation.confidence !== "low";
  return {
    ...baseline,
    kind: useModelKind ? interpretation.kind : baseline.kind,
    label: useModelKind ? interpretation.label : baseline.label,
    requiredCapabilities: [...new Set([...baseline.requiredCapabilities, ...interpretation.requiredCapabilities])],
    needsBusinessData: baseline.needsBusinessData || interpretation.needsBusinessData,
    needsExternalResearch: baseline.needsExternalResearch || interpretation.needsExternalResearch,
    ambiguity: interpretation.possibleInterpretations.length > 1 ? "material" : baseline.ambiguity,
    candidates: baseline.candidates,
    context: {
      ...(baseline.context ?? {}),
      entities: [...new Set([...(baseline.context?.entities ?? []), ...interpretation.entities])],
    },
  };
}
