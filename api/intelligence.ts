import { defaultUsagePolicy, runIntelligencePipeline } from "../src/intelligence";
import { validateRequestBody } from "../src/intelligence/api-validation";
import { getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth";

export default async function handler(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (request.method !== "POST") {
    console.warn(JSON.stringify({ event: "api.intelligence.rejected", requestId, reason: "method" }));
    return json({ error: "Method not allowed", requestId }, 405, { allow: "POST" });
  }

  const authentication = await getAuthenticatedUser(request);
  if (!authentication.user || !authentication.supabase) {
    return json({ error: authentication.error || "Authentication required", requestId }, 401);
  }

  const { data: usageRows, error: usageError } = await authentication.supabase.rpc("consume_distributed_rate_limit", {
    p_user_id: authentication.user.id,
    p_window_seconds: Math.ceil(defaultUsagePolicy.windowMs / 1000),
    p_max_requests: defaultUsagePolicy.maxRequests,
  });
  if (usageError) {
    console.error(JSON.stringify({ event: "api.intelligence.rate_limit_failed", requestId, userId: authentication.user.id, error: usageError.message }));
    return json({ error: "Rate limiting is temporarily unavailable.", requestId }, 503);
  }
  const usage = usageRows?.[0];
  if (!usage?.allowed) {
    console.warn(JSON.stringify({ event: "api.intelligence.rate_limited", requestId, userId: authentication.user.id }));
    return json({ error: "Rate limit exceeded", requestId }, 429, { "retry-after": String(usage?.retry_after_seconds ?? 1) });
  }

  try {
    const body = await request.json();
    const validation = validateRequestBody(body, defaultUsagePolicy.maxRequestChars);
    if (!validation.ok) {
      return json({ error: validation.error, requestId }, validation.status);
    }

    const scope = await getAuthorizedBusinessIds(authentication.supabase, authentication.user.id);
    if (scope.error) {
      return json({ error: scope.error, requestId }, 500);
    }

    const requestedBusinessId = validation.businessId;
    if (requestedBusinessId && !scope.businessIds.includes(requestedBusinessId)) {
      console.warn(JSON.stringify({
        event: "api.intelligence.cross_business_rejected",
        requestId,
        userId: authentication.user.id,
        businessId: requestedBusinessId,
      }));
      return json({ error: "You do not have access to this business.", requestId }, 403);
    }

    const businessId = requestedBusinessId
      ?? (scope.businessIds.length === 1 ? scope.businessIds[0] : undefined);

    if (!businessId) {
      const error = scope.businessIds.length === 0
        ? "No business is connected to this account yet."
        : "Select a business before using BUSIQ.";
      return json({ error, requestId, code: scope.businessIds.length === 0 ? "BUSINESS_SETUP_REQUIRED" : "BUSINESS_SELECTION_REQUIRED" }, 409);
    }

    const context = validation.context
      ? {
          ...validation.context,
          business: validation.context.business.filter((entry) => !entry.businessId || entry.businessId === businessId),
        }
      : undefined;

    let learningMemory: Array<{ id: string; exampleId: string; content: string; similarity: number }> = [];
    try {
      const { retrieveLearningMemory } = await import("../src/learning/runtime");
      learningMemory = await retrieveLearningMemory(authentication.supabase, businessId, validation.request);
    } catch (error) {
      console.warn(JSON.stringify({
        event: "api.intelligence.learning_memory_unavailable",
        requestId,
        businessId,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }

    const learningEntries = learningMemory.map((item) => ({
      id: "learning-" + item.id,
      kind: "knowledge" as const,
      key: "learned-memory-" + item.exampleId,
      value: item.content,
      source: "BUSIQ learned memory; reference only",
      createdAt: new Date().toISOString(),
      businessId,
    }));

    const enrichedContext = context
      ? { ...context, knowledge: [...context.knowledge, ...learningEntries] }
      : learningEntries.length
        ? { business: [], user: [], conversation: [], work: [], decisions: [], knowledge: learningEntries, provenance: [] }
        : undefined;

    const result = runIntelligencePipeline(validation.request, { context: enrichedContext });

    const { error: historyError } = await authentication.supabase.from("intelligence_runs").insert({
      business_id: businessId,
      user_id: authentication.user.id,
      request: validation.request,
      status: result.status,
      intent: result.intent,
      result,
    });
    if (historyError) {
      console.error(JSON.stringify({ event: "api.intelligence.history_failed", requestId, userId: authentication.user.id, businessId, error: historyError.message }));
      return json({ error: "BUSIQ could not persist this intelligence run.", requestId }, 500);
    }

    try {
      const { getConfiguredModelProvider, evaluateAndStoreLearning } = await import("../src/learning/runtime");
      await evaluateAndStoreLearning(
        authentication.supabase,
        getConfiguredModelProvider(),
        businessId,
        validation.request,
        JSON.stringify(result.answer),
        result.evidence.map((item) => ({
          id: item.id,
          detail: item.detail,
          source: item.source,
          verification: item.verification,
          kind: item.kind,
        })),
        learningMemory,
      );
    } catch (error) {
      console.warn(JSON.stringify({
        event: "api.intelligence.learning_evaluation_unavailable",
        requestId,
        businessId,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }

    console.info(JSON.stringify({
      event: "api.intelligence.completed",
      requestId,
      userId: authentication.user.id,
      businessId,
      status: result.status,
      intent: result.intent.kind,
      durationMs: Date.now() - startedAt,
    }));

    return json({ requestId, result }, 200);
  } catch (error) {
    console.error(JSON.stringify({
      event: "api.intelligence.failed",
      requestId,
      userId: authentication.user.id,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    return json({ error: "Internal server error", requestId }, 500);
  }
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}
