import { defaultUsagePolicy, runIntelligencePipeline } from "../src/intelligence/index.js";
import { resolveIntent } from "../src/bie/intent.js";
import { createFreeWebResearchProvider, SupabaseEdgeModelProvider } from "../src/providers/index.js";
import type { BusinessDomain } from "../src/business-data/index.js";
import { validateRequestBody } from "../src/intelligence/api-validation.js";
import { getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth.js";
import { interpretRequest, semanticInterpretationToIntent } from "../src/intelligence/semantic-interpreter.js";

type ServerRequest = {
  method?: string;
  headers?: { get?: (name: string) => string | null; authorization?: string };
  json?: () => Promise<unknown>;
  body?: unknown;
};

export async function POST(request: ServerRequest): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (request.method !== "POST") {
    console.warn(JSON.stringify({ event: "api.intelligence.rejected", requestId, reason: "method" }));
    return json({ error: "Method not allowed", requestId }, 405, { allow: "POST" });
  }

  const authentication = await getAuthenticatedUser(request);
  if (!authentication.user || !authentication.supabase) {
    return json({ error: authentication.error || "Guest session required.", requestId }, 401);
  }

  const { data: usageRows, error: usageError } = await authentication.supabase.rpc("consume_distributed_rate_limit", {
    p_user_id: authentication.user.id,
    p_window_seconds: Math.ceil(defaultUsagePolicy.windowMs / 1000),
    p_max_requests: defaultUsagePolicy.maxRequests,
  });
  if (usageError) {
    console.error(JSON.stringify({
      event: "api.intelligence.rate_limit_failed",
      requestId,
      userId: authentication.user.id,
      anonymous: authentication.isAnonymous,
      error: usageError.message,
    }));
    return json({ error: "Rate limiting is temporarily unavailable.", requestId }, 503);
  }
  const usage = usageRows?.[0];
  if (!usage?.allowed) {
    console.warn(JSON.stringify({
      event: "api.intelligence.rate_limited",
      requestId,
      userId: authentication.user.id,
      anonymous: authentication.isAnonymous,
    }));
    return json(
      { error: authentication.isAnonymous
          ? "Guest rate limit reached. Sign in or create an account for the full BUSIQ workspace."
          : "Rate limit exceeded", requestId },
      429,
      { "retry-after": String(usage?.retry_after_seconds ?? 1) },
    );
  }

  try {
    const body = typeof request.json === "function"
      ? await request.json()
      : request.body ?? {};
    const validation = validateRequestBody(body, defaultUsagePolicy.maxRequestChars);
    if (!validation.ok) {
      return json({ error: validation.error, requestId }, validation.status);
    }

    let externalEvidence: import("../src/intelligence/types.js").EvidenceItem[] = [];
    let resolvedIntent: ReturnType<typeof resolveIntent>;
    let semanticInterpretationAttempted = false;
    let semanticInterpretationSucceeded = false;
    let semanticInterpretation: import("../src/intelligence/semantic-interpreter.js").ModelSemanticInterpretation | undefined;
    let semanticUnderstandingMode: "model-primary" | "deterministic-fallback" = "deterministic-fallback";
    try {
      const { getConfiguredModelProvider } = await import("../src/learning/runtime.js");
      const configuredProvider = getConfiguredModelProvider();
      const provider = configuredProvider ?? new SupabaseEdgeModelProvider(authentication.supabase);
      semanticInterpretationAttempted = true;
      const interpretation = await interpretRequest(provider, validation.request, validation.context?.conversation ?? []);
      semanticInterpretation = interpretation;
      resolvedIntent = semanticInterpretationToIntent(validation.request, interpretation);
      semanticInterpretationSucceeded = true;
      semanticUnderstandingMode = "model-primary";
    } catch (error) {
      resolvedIntent = resolveIntent(validation.request);
      console.warn(JSON.stringify({
        event: "api.intelligence.semantic_interpretation_unavailable",
        requestId,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
    console.info(JSON.stringify({
      event: "api.intelligence.resolved",
      requestId,
      anonymous: authentication.isAnonymous,
      requestLength: validation.request.length,
      intent: resolvedIntent.kind,
      needsBusinessData: resolvedIntent.needsBusinessData,
      needsExternalResearch: resolvedIntent.needsExternalResearch,
      requiredCapabilities: resolvedIntent.requiredCapabilities,
      semanticInterpretationAttempted,
      semanticInterpretationSucceeded,
      semanticUnderstandingMode,
    }));

    if (resolvedIntent.needsExternalResearch) {
      try {
        const research = await createFreeWebResearchProvider().search({
          query: validation.request,
          intent: resolvedIntent.kind,
          entities: resolvedIntent.context?.entities ?? [],
          time: resolvedIntent.context?.time,
          sourceClasses: ["external-research"],
        });

        externalEvidence = research.claims.map((claim, index) => ({
          id: "research-" + index + "-" + crypto.randomUUID(),
          kind: "retrieved" as const,
          label: research.sources.find((source) => claim.sourceIds.includes(source.id))?.title ?? "External research source",
          detail: claim.statement,
          source: research.sources.find((source) => claim.sourceIds.includes(source.id))?.url ?? research.provider,
          authority: research.sources.find((source) => claim.sourceIds.includes(source.id))?.authority === "primary" ? "connected-source" as const : "unknown" as const,
          freshness: "current" as const,
          verification: "verified" as const,
          relevance: "direct" as const,
          quality: "limited" as const,
        }));
      } catch (error) {
        console.warn(JSON.stringify({
          event: "api.intelligence.research_unavailable",
          requestId,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    }

    if (authentication.isAnonymous) {
      if (validation.businessId) {
        return json({ error: "Sign in or create an account before accessing a business workspace.", requestId }, 403);
      }

      let result = runIntelligencePipeline(validation.request, {
        context: validation.context,
        externalEvidence,
        intentOverride: resolvedIntent,
        semanticInterpretation,
      });
      let modelAttempted = false;
      let modelSucceeded = false;
      let modelProvider: string | null = null;
      let modelName: string | null = null;

      try {
        const { getConfiguredModelProvider } = await import("../src/learning/runtime.js");
        const configuredProvider = getConfiguredModelProvider();
        modelAttempted = result.status !== "needs_clarification";
        modelProvider = configuredProvider ? "groq-or-compatible" : "supabase-edge-fallback";
        modelName = configuredProvider ? (runtimeEnv("BUSIQ_MODEL_NAME") || "configured") : "supabase-edge";
        const { generateModelAnswer } = await import("../src/intelligence/model-answer.js");
        const provider = configuredProvider ?? new SupabaseEdgeModelProvider(authentication.supabase);
        result = await generateModelAnswer(provider, result);
        modelSucceeded = modelAttempted;
      } catch (error) {
        console.warn(JSON.stringify({
          event: "api.intelligence.guest_model_unavailable",
          requestId,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }

      console.info(JSON.stringify({
        event: "api.intelligence.guest_completed",
        requestId,
        userId: authentication.user.id,
        status: result.status,
        intent: result.intent.kind,
        modelAttempted,
        modelSucceeded,
        modelProvider,
        model: modelName,
        durationMs: Date.now() - startedAt,
      }));
      return json({ requestId, result }, 200);
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

    let businessEvidence: import("../src/intelligence/types.js").EvidenceItem[] = [];
    let businessRecords: import("../src/business-data/types.js").NormalizedRecord[] = [];
    if (resolvedIntent.needsBusinessData) {
      const domains = resolvedIntent.requiredCapabilities.filter((capability): capability is BusinessDomain =>
        ["sales","customers","money","expenses","products","inventory","suppliers","people","operations","marketing","projects"].includes(capability),
      );

      try {
        const { retrieveBusinessEvidence } = await import("../src/business-data/runtime.js");
        const retrieved: Array<{ id: string; domain: BusinessDomain; detail: string; source: string; record?: import("../src/business-data/types.js").NormalizedRecord }> = [];
        for (const domain of [...new Set(domains)]) {
          const rows = await retrieveBusinessEvidence(authentication.supabase, businessId, domain);
          retrieved.push(...rows);
        }
        businessRecords = retrieved.flatMap((item) => item.record ? [{
          ...item.record,
          metadata: { ...(item.record.metadata ?? {}), evidenceId: item.id },
        }] : []);
        businessEvidence = retrieved.map((item) => ({
          id: item.id,
          kind: "retrieved" as const,
          label: item.domain + " record",
          detail: item.detail,
          source: item.source,
          authority: "connected-source" as const,
          freshness: "current" as const,
          verification: "verified" as const,
          relevance: "direct" as const,
          quality: "strong" as const,
          scope: { businessId },
          evidenceDate: new Date().toISOString(),
        }));
      } catch (error) {
        console.warn(JSON.stringify({
          event: "api.intelligence.business_data_unavailable",
          requestId,
          businessId,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    }

    const context = validation.context
      ? {
          ...validation.context,
          business: validation.context.business.filter((entry) => !entry.businessId || entry.businessId === businessId),
        }
      : undefined;

    let learningMemory: Array<{ id: string; exampleId: string; content: string; similarity: number }> = [];
    let knowledgeMemory: Array<{ id: string; documentId: string; content: string; similarity: number }> = [];
    try {
      const { retrieveLearningMemory } = await import("../src/learning/runtime.js");
      learningMemory = await retrieveLearningMemory(authentication.supabase, businessId, validation.request);
    } catch (error) {
      console.warn(JSON.stringify({
        event: "api.intelligence.learning_memory_unavailable",
        requestId,
        businessId,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }

    try {
      const { retrieveKnowledge } = await import("../src/knowledge/runtime.js");
      knowledgeMemory = await retrieveKnowledge(authentication.supabase, businessId, validation.request);
    } catch (error) {
      console.warn(JSON.stringify({
        event: "api.intelligence.knowledge_unavailable",
        requestId,
        businessId,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }

    const knowledgeEntries = knowledgeMemory.map((item) => ({
      id: "knowledge-" + item.id,
      kind: "knowledge" as const,
      key: "knowledge-" + item.documentId,
      value: item.content,
      source: "BUSIQ business knowledge; reference only",
      createdAt: new Date().toISOString(),
      businessId,
    }));

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
      ? { ...context, knowledge: [...context.knowledge, ...learningEntries, ...knowledgeEntries] }
      : learningEntries.length || knowledgeEntries.length
        ? { business: [], user: [], conversation: [], work: [], decisions: [], knowledge: [...learningEntries, ...knowledgeEntries], provenance: [] }
        : undefined;

    let result = runIntelligencePipeline(validation.request, {
      context: enrichedContext,
      externalEvidence,
      businessEvidence,
      businessRecords,
      intentOverride: resolvedIntent,
      semanticInterpretation,
    });

    try {
      const { getConfiguredModelProvider } = await import("../src/learning/runtime.js");
      const { generateModelAnswer } = await import("../src/intelligence/model-answer.js");
      const provider = getConfiguredModelProvider() ?? new SupabaseEdgeModelProvider(authentication.supabase);
      result = await generateModelAnswer(provider, result);
    } catch (error) {
      console.warn(JSON.stringify({
        event: "api.intelligence.model_unavailable",
        requestId,
        businessId,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }

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
      const { getConfiguredModelProvider, evaluateAndStoreLearning } = await import("../src/learning/runtime.js");
      const evaluatorProvider = getConfiguredModelProvider() ?? new SupabaseEdgeModelProvider(authentication.supabase);
      await evaluateAndStoreLearning(
        authentication.supabase,
        evaluatorProvider,
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
      anonymous: authentication.isAnonymous,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    return json({ error: "Internal server error", requestId }, 500);
  }
}

function runtimeEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}
