export type ActionAuditState = "requested" | "blocked" | "confirmed" | "executed" | "failed";

export type ActionAuditEvent = {
  id: string;
  actionId: string;
  state: ActionAuditState;
  timestamp: string;
  reason?: string;
  scope?: string;
};

export function createActionAuditEvent(
  actionId: string,
  state: ActionAuditState,
  reason?: string,
  scope?: string,
): ActionAuditEvent {
  return {
    id: `action-audit-${crypto.randomUUID()}`,
    actionId,
    state,
    timestamp: new Date().toISOString(),
    ...(reason ? { reason } : {}),
    ...(scope ? { scope } : {}),
  };
}

export function appendActionAuditEvent(
  events: ActionAuditEvent[],
  event: ActionAuditEvent,
): ActionAuditEvent[] {
  return [...events, event].slice(-100);
}
