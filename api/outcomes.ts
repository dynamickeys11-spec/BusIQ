import { getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") return json({ error: "Method not allowed", requestId }, 405);

  const authentication = await getAuthenticatedUser(request);
  if (!authentication.user || !authentication.supabase) return json({ error: "Authentication required.", requestId }, 401);
  if (authentication.isAnonymous) return json({ error: "Create an account before recording business outcomes.", requestId }, 403);

  try {
    const body = await request.json() as {
      businessId?: string;
      decisionId?: string;
      actionEventId?: string;
      metric?: string;
      expectedValue?: number;
      observedValue?: number;
      unit?: string;
      observedAt?: string;
      notes?: string;
    };

    if (!body.businessId || !body.metric || typeof body.observedValue !== "number") {
      return json({ error: "businessId, metric and numeric observedValue are required.", requestId }, 400);
    }

    const scope = await getAuthorizedBusinessIds(authentication.supabase, authentication.user.id);
    if (scope.error) return json({ error: scope.error, requestId }, 500);
    if (!scope.businessIds.includes(body.businessId)) return json({ error: "You do not have access to this business.", requestId }, 403);

    const { data, error } = await authentication.supabase.from("business_outcomes").insert({
      business_id: body.businessId,
      decision_id: body.decisionId ?? null,
      action_event_id: body.actionEventId ?? null,
      metric: body.metric.trim().slice(0, 200),
      expected_value: typeof body.expectedValue === "number" ? body.expectedValue : null,
      observed_value: body.observedValue,
      unit: body.unit?.trim().slice(0, 80) ?? null,
      observed_at: body.observedAt ?? new Date().toISOString(),
      notes: body.notes?.trim().slice(0, 3000) ?? null,
    }).select("id").single();

    if (error || !data) return json({ error: "BUSIQ could not record the outcome.", requestId }, 500);
    return json({ requestId, outcomeId: data.id, status: "observed" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Outcome recording failed.", requestId }, 500);
  }
}
