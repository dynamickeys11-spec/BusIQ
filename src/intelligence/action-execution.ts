import {
  buildActionDecision,
  type ActionAuthorization,
  type ActionDefinition,
  type ActionConfirmation,
} from "./actions";
import { appendActionAuditEvent, createActionAuditEvent, type ActionAuditEvent } from "./action-audit";

export type ActionExecutionState = "executed" | "blocked" | "failed";

export type ActionExecutionResult = {
  state: ActionExecutionState;
  actionId: string;
  reason?: string;
  audit: ActionAuditEvent[];
};

export function executeActionSafely(
  action: ActionDefinition,
  options: {
    authorization?: ActionAuthorization;
    confirmed?: boolean;
    audit?: ActionAuditEvent[];
  } = {},
): ActionExecutionResult {
  const priorAudit = options.audit ?? [];
  const requested = createActionAuditEvent(action.id, "requested");
  const withRequest = appendActionAuditEvent(priorAudit, requested);
  const decision = buildActionDecision(action, options);

  if (decision.state === "blocked") {
    return {
      state: "blocked",
      actionId: action.id,
      reason: decision.reason,
      audit: appendActionAuditEvent(withRequest, createActionAuditEvent(action.id, "blocked", decision.reason)),
    };
  }

  if (action.sideEffect === "write" && action.availability !== "available") {
    const reason = "Write executor is unavailable.";
    return {
      state: "failed",
      actionId: action.id,
      reason,
      audit: appendActionAuditEvent(withRequest, createActionAuditEvent(action.id, "failed", reason)),
    };
  }

  return {
    state: "executed",
    actionId: action.id,
    audit: appendActionAuditEvent(
      withRequest,
      createActionAuditEvent(
        action.id,
        decision.confirmation.required ? "confirmed" : "executed",
        decision.confirmation.reason,
      ),
    ),
  };
}

export function actionConfirmationSummary(confirmation: ActionConfirmation): string {
  return confirmation.required
    ? confirmation.confirmed
      ? "Explicit confirmation received."
      : "Explicit confirmation required."
    : "No consequential confirmation required.";
}
