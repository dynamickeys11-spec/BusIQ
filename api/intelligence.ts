import { consumeUsage, defaultUsagePolicy, runIntelligencePipeline } from "../src/intelligence";
import { validateRequestBody } from "../src/intelligence/api-validation";
import { getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth";

const rateBuckets = new Map<string, { startedAt: number; count: number }>();

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

  const usage = consumeUsage(rateBuckets, authentication.user.id, startedAt, defaultUsagePolicy);
  if (!usage.allowed) {
    console.warn(JSON.stringify({ event: "api.intelligence.rate_limited", requestId, userId: authentication.user.id }));
    return json({ error: "Rate limit exceeded", requestId }, 429, { "retry-after": String(usage.retryAfterSeconds) });
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

    const result = runIntelligencePipeline(validation.request, { context });

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
