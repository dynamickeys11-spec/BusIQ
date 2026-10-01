import type { ModelProvider } from "../providers/index.js";
import type { IntelligencePipelineResult } from "./types.js";

type ModelAnswer = {
  headline: string;
  detail: string;
  nextAction: string;
};

function parseModelAnswer(text: string): ModelAnswer {
  const value = JSON.parse(text) as Partial<ModelAnswer>;
  for (const key of ["headline", "detail", "nextAction"] as const) {
    if (typeof value[key] !== "string" || !value[key].trim()) {
      throw new Error("Model answer is missing " + key + ".");
    }
  }
  return {
    headline: value.headline!.trim().slice(0, 240),
    detail: value.detail!.trim().slice(0, 5000),
    nextAction: value.nextAction!.trim().slice(0, 600),
  };
}

export async function generateModelAnswer(
  provider: ModelProvider,
  result: IntelligencePipelineResult,
): Promise<IntelligencePipelineResult> {
  if (result.status === "needs_clarification") return result;

  const response = await provider.generate({
    system: [
      "You are the language layer inside BUSIQ.",
      "You are not allowed to invent business facts, current facts, sources, actions, or completed work.",
      "Use only the supplied request, semantic model, evidence, world model, digital twin, investigation, verified reasoning, and limitations.",
      "If evidence is insufficient, say so explicitly.",
      "Return JSON only with headline, detail, nextAction.",
    ].join(" "),
    prompt: JSON.stringify({
      request: result.request,
      intent: result.intent,
      evidence: result.evidence.slice(0, 20),
      reasoning: result.reasoning,
      verification: result.verification,
      semanticModel: result.semanticModel,
      worldModel: result.worldModel,
      digitalTwin: result.digitalTwin,
      investigation: result.investigation,
      existingAnswer: result.answer,
    }),
    temperature: 0.1,
    maxOutputTokens: 900,
    responseFormat: "json",
  });

  const answer = parseModelAnswer(response.text);
  return {
    ...result,
    answer: {
      ...result.answer,
      ...answer,
    },
    trace: [...result.trace, "Generate evidence-bounded language with configured model", "Validate model output"],
  };
}
