import { consumeUsage, defaultUsagePolicy, runIntelligencePipeline } from "../src/intelligence";
import { validateRequestBody } from "../src/intelligence/api-validation";

const rateBuckets = new Map<string, { startedAt: number; count: number }>();

export default async function handler(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const rateKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";

  if (request.method !== "POST") {
    console.warn(JSON.stringify({ event: "api.intelligence.rejected", requestId, reason: "method" }));
    return json({ error: "Method not allowed", requestId }, 405, { allow: "POST" });
  }

  const usage = consumeUsage(rateBuckets, rateKey, startedAt, defaultUsagePolicy);
  if (!usage.allowed) {
    console.warn(JSON.stringify({ event: "api.intelligence.rate_limited", requestId }));
    return json({ error: "Rate limit exceeded", requestId }, 429, { "retry-after": String(usage.retryAfterSeconds) });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    console.warn(JSON.stringify({ event: "api.intelligence.rejected", requestId, reason: "content-type" }));
    return json({ error: "Content-Type must be application/json", requestId }, 415);
  }

  try {
    const body = await request.json() as { request?: unknown };
    if (typeof body.request !== "string" || !body.request.trim()) {
      return json({ error: "A non-empty request string is required", requestId }, 400);
    }
    if (body.request.length > defaultUsagePolicy.maxRequestChars) {
      return json({ error: "Request is too large", requestId }, 413);
    }

    const result = runIntelligencePipeline(body.request);
    console.info(JSON.stringify({
      event: "api.intelligence.completed",
      requestId,
      status: result.status,
      intent: result.intent.kind,
      durationMs: Date.now() - startedAt,
    }));

    return json({ requestId, result }, 200);
  } catch (error) {
    console.error(JSON.stringify({
      event: "api.intelligence.failed",
      requestId,
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
