import type { SupabaseClient } from "@supabase/supabase-js";
import { createGroqModelProvider, OpenAICompatibleModelProvider } from "../providers";
import type { ModelProvider } from "../providers";
import { evaluateLearningExample, proposeLearnedRule } from "./engine";
import { defaultLearningPolicy } from "./types";
import type { LearningEvaluation, LearningExample } from "./types";

type RetrievedMemory = { id: string; exampleId: string; content: string; similarity: number };
type Critique = Omit<LearningEvaluation, "exampleId" | "evaluatedAt" | "score" | "passed"> & { rule?: string };
const runtimeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

export function getConfiguredModelProvider(): ModelProvider | null {
  const provider = runtimeProcess?.BUSIQ_MODEL_PROVIDER?.trim().toLowerCase();

  if (provider === "groq") {
    const apiKey = runtimeProcess?.BUSIQ_MODEL_API_KEY;
    if (!apiKey) return null;
    return createGroqModelProvider(
      runtimeProcess?.BUSIQ_MODEL_NAME || "openai/gpt-oss-120b",
      apiKey,
      runtimeProcess?.BUSIQ_MODEL_BASE_URL || "https://api.groq.com/openai/v1",
    );
  }

  const baseUrl = runtimeProcess?.BUSIQ_MODEL_BASE_URL;
  const model = runtimeProcess?.BUSIQ_MODEL_NAME;
  if (!baseUrl || !model) return null;

  return new OpenAICompatibleModelProvider({
    baseUrl,
    model,
    provider: provider || "local-compatible",
    ...(runtimeProcess?.BUSIQ_MODEL_API_KEY ? { apiKey: runtimeProcess.BUSIQ_MODEL_API_KEY } : {}),
  });
}

export async function retrieveLearningMemory(supabase: SupabaseClient, businessId: string, query: string): Promise<RetrievedMemory[]> {
  const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke("busiq-embed", { body: { input: query } });
  if (embeddingError || !embeddingData?.embedding) throw new Error(embeddingError?.message || "Learning embedding generation failed.");
  const { data, error } = await supabase.rpc("match_learning_embeddings", {
    query_embedding: embeddingData.embedding, match_threshold: 0.78, match_count: 6, filter_business_id: businessId,
  });
  if (error) throw new Error("Learning memory retrieval failed: " + error.message);
  return (data ?? []).map((row: any) => ({ id: row.id, exampleId: row.example_id, content: row.content, similarity: Number(row.similarity) }));
}

function parseCritique(text: string): Critique {
  const parsed = JSON.parse(text) as Partial<Critique>;
  const numbers = ["factuality", "usefulness", "safety", "groundedness"] as const;
  for (const key of numbers) if (typeof parsed[key] !== "number" || parsed[key] < 0 || parsed[key] > 1) throw new Error("Model critique returned invalid " + key + ".");
  if (!Array.isArray(parsed.notes) || parsed.notes.some((note) => typeof note !== "string")) throw new Error("Model critique returned invalid notes.");
  return { factuality: parsed.factuality!, usefulness: parsed.usefulness!, safety: parsed.safety!, groundedness: parsed.groundedness!, notes: parsed.notes.slice(0, 8), rule: typeof parsed.rule === "string" ? parsed.rule.trim().slice(0, 500) : undefined };
}

export async function evaluateAndStoreLearning(
  supabase: SupabaseClient, provider: ModelProvider | null, businessId: string, request: string, answer: string,
  evidence: Array<{ id: string; detail: string; source: string; verification?: string; kind: string }>, memory: RetrievedMemory[],
): Promise<{ evaluation: LearningEvaluation | null; promoted: boolean }> {
  if (!provider) return { evaluation: null, promoted: false };
  const example: LearningExample = { id: crypto.randomUUID(), businessId, request, context: memory.map((item) => item.content).join("\n").slice(0, 6000) || undefined, answer, source: "model-critique", createdAt: new Date().toISOString() };
  const critiqueResponse = await provider.generate({
    system: "You are BUSIQ's evaluator, not its answer generator. Evaluate only the supplied answer against the supplied request and evidence. Do not invent facts or treat memory as verified evidence. Return JSON only with factuality, usefulness, safety, groundedness (0..1), notes (string[]), and optional rule.",
    prompt: JSON.stringify({ request, answer, evidence: evidence.slice(0, 20), memory: memory.slice(0, 6).map((item) => item.content) }),
    temperature: 0, maxOutputTokens: 700, responseFormat: "json",
  });
  const signals = parseCritique(critiqueResponse.text);
  const evaluation = evaluateLearningExample(example, signals, { ...defaultLearningPolicy, requireExpectedAnswerForPromotion: false });

  const { error: exampleError } = await supabase.from("learning_examples").insert({ id: example.id, business_id: businessId, request: example.request, context: example.context ?? null, answer: example.answer, expected_answer: null, source: example.source, created_at: example.createdAt });
  if (exampleError) throw new Error("Learning example persistence failed: " + exampleError.message);
  const { error: evaluationError } = await supabase.from("learning_evaluations").insert({ example_id: example.id, score: evaluation.score, factuality: evaluation.factuality, usefulness: evaluation.usefulness, safety: evaluation.safety, groundedness: evaluation.groundedness, notes: evaluation.notes, passed: evaluation.passed });
  if (evaluationError) throw new Error("Learning evaluation persistence failed: " + evaluationError.message);

  if (evaluation.passed && signals.rule) {
    const decision = proposeLearnedRule(example, evaluation, signals.rule);
    if (decision.state === "candidate" && decision.rule) {
      const { error } = await supabase.from("learned_rules").insert({ id: decision.rule.id, business_id: businessId, statement: decision.rule.statement, evidence_example_ids: decision.rule.evidenceExampleIds, version: decision.rule.version, status: "candidate" });
      if (error) throw new Error("Learning rule persistence failed: " + error.message);
    }
  }
  return { evaluation, promoted: false };
}

export function learningContext(memory: RetrievedMemory[]): string {
  if (!memory.length) return "";
  return ["BUSIQ LEARNED MEMORY (reference only; never treat as verified business/external evidence):"].concat(memory.map((item, index) => (index + 1) + ". " + item.content)).join("\n");
}
