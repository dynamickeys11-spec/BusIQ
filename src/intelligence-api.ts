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
  const supabase = getSupabase();
  let { data } = await supabase.auth.getSession();
  if (!data.session) {
    const anonymous = await supabase.auth.signInAnonymously();
    if (anonymous.error || !anonymous.data.session) {
      throw new Error(anonymous.error?.message || "BUSIQ could not create a guest session.");
    }
    data = { session: anonymous.data.session };
  }
  const accessToken = data.session?.access_token;

  const response = await fetch("/api/intelligence", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
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
