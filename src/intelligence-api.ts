import type { ContextState, IntelligencePipelineResult } from "./intelligence";
import { getSupabase } from "./supabase";

type IntelligenceApiResponse = {
  requestId?: string;
  result?: IntelligencePipelineResult;
  error?: string;
};

export async function requestIntelligence(
  request: string,
  context: ContextState,
  businessId?: string,
): Promise<IntelligencePipelineResult> {
  const { data } = await getSupabase().auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Your BUSIQ session has expired. Please sign in again.");
  }

  const response = await fetch("/api/intelligence", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ request, context, ...(businessId ? { businessId } : {}) }),
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
