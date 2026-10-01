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

export function summarizeActionAudit(events: ActionAuditEvent[]): {
  actionId: string;
  latestState: ActionAuditState;
  eventCount: number;
  lastReason?: string;
  lastTimestamp?: string;
}[] {
  const byAction = new Map<string, ActionAuditEvent[]>();
  for (const event of events) {
    const existing = byAction.get(event.actionId) ?? [];
    byAction.set(event.actionId, [...existing, event]);
  }

  return [...byAction.entries()].map(([actionId, actionEvents]) => {
    const latest = actionEvents[actionEvents.length - 1];
    return {
      actionId,
      latestState: latest.state,
      eventCount: actionEvents.length,
      ...(latest.reason ? { lastReason: latest.reason } : {}),
      ...(latest.timestamp ? { lastTimestamp: latest.timestamp } : {}),
    };
  });
}
