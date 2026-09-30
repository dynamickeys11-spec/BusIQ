import type { ContextState, IntelligencePipelineResult } from "./intelligence";

type IntelligenceApiResponse = {
  requestId?: string;
  result?: IntelligencePipelineResult;
  error?: string;
};

export async function requestIntelligence(
  request: string,
  context: ContextState,
): Promise<IntelligencePipelineResult> {
  const response = await fetch("/api/intelligence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request, context }),
  });

  const payload = (await response.json().catch(() => ({}))) as IntelligenceApiResponse;

  if (!response.ok) {
    throw new Error(payload.error || `BUSIQ intelligence request failed (${response.status}).`);
  }

  if (!payload.result) {
    throw new Error("BUSIQ returned no intelligence result.");
  }

  return payload.result;
}
