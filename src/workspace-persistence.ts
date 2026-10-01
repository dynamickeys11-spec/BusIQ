import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { ContextState, IntelligencePipelineResult } from "./intelligence";

export type PersistedWork = {
  id: string;
  request: string;
  intent: IntelligencePipelineResult["intent"];
  createdAt: string;
  status: "active" | "complete";
  pipeline?: IntelligencePipelineResult;
};

export type PersistedLibraryItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

async function currentUserId() {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

export async function loadBusinessWorkspace(businessId: string) {
  const supabase = getSupabase();
  const [workResult, libraryResult, contextResult] = await Promise.all([
    supabase.from("work_items").select("id,request,intent,created_at,status,pipeline").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100),
    supabase.from("library_items").select("id,title,body,created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100),
    supabase.from("business_context").select("context").eq("business_id", businessId).maybeSingle(),
  ]);

  if (workResult.error) throw workResult.error;
  if (libraryResult.error) throw libraryResult.error;
  if (contextResult.error) throw contextResult.error;

  return {
    work: (workResult.data ?? []).map((row) => ({
      id: row.id,
      request: row.request,
      intent: row.intent as PersistedWork["intent"],
      createdAt: row.created_at,
      status: row.status === "complete" ? "complete" : "active",
      pipeline: row.pipeline as IntelligencePipelineResult | undefined,
    })) satisfies PersistedWork[],
    library: (libraryResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
    })) satisfies PersistedLibraryItem[],
    context: (contextResult.data?.context as ContextState | null) ?? null,
  };
}

export async function persistWork(
  businessId: string,
  item: PersistedWork,
) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Your secure session has expired. Please sign in again.");

  const { error } = await getSupabase().from("work_items").insert({
    id: item.id,
    business_id: businessId,
    created_by: userId,
    request: item.request,
    intent: item.intent,
    status: item.status,
    pipeline: item.pipeline ?? null,
  });
  if (error) throw error;
}

export async function persistIntelligenceRun(
  businessId: string,
  request: string,
  result: IntelligencePipelineResult,
) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Your secure session has expired. Please sign in again.");

  const { error } = await getSupabase().from("intelligence_runs").insert({
    business_id: businessId,
    user_id: userId,
    request,
    status: result.status,
    intent: result.intent,
    result,
  });
  if (error) throw error;
}

export async function completePersistedWork(businessId: string, workId: string) {
  const { error } = await getSupabase().from("work_items").update({ status: "complete" }).eq("id", workId).eq("business_id", businessId);
  if (error) throw error;
}

export async function persistLibraryItem(
  businessId: string,
  item: PersistedLibraryItem,
) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Your secure session has expired. Please sign in again.");

  const { error } = await getSupabase().from("library_items").insert({
    id: item.id,
    business_id: businessId,
    created_by: userId,
    title: item.title,
    body: item.body,
  });
  if (error) throw error;
}

export async function persistBusinessContext(
  businessId: string,
  context: ContextState,
) {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await getSupabase().from("business_context").upsert(
    { business_id: businessId, context, updated_by: userId },
    { onConflict: "business_id" },
  );
  if (error) throw error;
}
