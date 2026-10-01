import { getAction, buildActionDecision } from "../src/intelligence/actions";
import { WebhookActionProvider } from "../src/providers";
import { getAdminSupabase, getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth";

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
  if (authentication.isAnonymous) return json({ error: "Create an account before executing business actions.", requestId }, 403);

  try {
    const body = await request.json() as {
      businessId?: string;
      actionId?: string;
      mode?: "preview" | "execute";
      inputs?: Record<string, unknown>;
      confirmationId?: string;
    };

    if (!body.businessId || !body.actionId || !body.mode) {
      return json({ error: "businessId, actionId and mode are required.", requestId }, 400);
    }

    const scope = await getAuthorizedBusinessIds(authentication.supabase, authentication.user.id);
    if (scope.error) return json({ error: scope.error, requestId }, 500);
    if (!scope.businessIds.includes(body.businessId)) {
      return json({ error: "You do not have access to this business.", requestId }, 403);
    }

    const action = getAction(body.actionId);
    if (!action) return json({ error: "Unknown action.", requestId }, 404);

    if (body.mode === "preview") {
      const confirmationId = crypto.randomUUID();
      const decision = buildActionDecision(action, { confirmed: false });
      return json({
        requestId,
        mode: "preview",
        confirmationId,
        action,
        decision,
        message: decision.state === "ready"
          ? "This action is ready for explicit confirmation."
          : decision.reason,
      });
    }

    if (!body.confirmationId) return json({ error: "A confirmationId from an action preview is required.", requestId }, 400);

    const decision = buildActionDecision(action, { confirmed: true });
    if (decision.state === "blocked") return json({ error: decision.reason, requestId, action, decision }, 409);

    const admin = getAdminSupabase();
    if (!admin) {
      return json({
        error: "Durable action audit is not configured. BUSIQ will not execute a consequential action without a server-only Supabase secret key.",
        requestId,
        code: "ACTION_AUDIT_NOT_CONFIGURED",
      }, 503);
    }

    const { data: requestedEvent, error: requestError } = await admin.from("action_events").insert({
      business_id: body.businessId,
      action_id: action.id,
      actor_user_id: authentication.user.id,
      state: "requested",
      confirmation_id: body.confirmationId,
      request_payload: body.inputs ?? {},
      reason: "Explicit action confirmation received.",
    }).select("id").single();

    if (requestError || !requestedEvent) return json({ error: "BUSIQ could not create the durable action audit event.", requestId }, 500);

    const provider = new WebhookActionProvider();
    const result = await provider.execute({
      businessId: body.businessId,
      actionId: action.id,
      inputs: body.inputs ?? {},
      confirmationId: body.confirmationId,
    });

    const { error: resultError } = await admin.from("action_events").insert({
      business_id: body.businessId,
      action_id: action.id,
      actor_user_id: authentication.user.id,
      state: result.state === "completed" ? "executed" : "failed",
      confirmation_id: body.confirmationId,
      request_payload: body.inputs ?? {},
      result_payload: result,
      reason: result.detail ?? null,
    });

    if (resultError) {
      return json({ error: "The action result could not be durably audited. BUSIQ stopped after provider execution.", requestId }, 500);
    }

    return json({ requestId, action, decision, result, auditEventId: requestedEvent.id });
  } catch (error) {
    console.error(JSON.stringify({
      event: "api.actions.failed",
      requestId,
      userId: authentication.user.id,
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    return json({ error: "Action request failed.", requestId }, 500);
  }
}
