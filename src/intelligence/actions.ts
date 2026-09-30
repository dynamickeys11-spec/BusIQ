export type ActionKind = "create" | "update" | "send" | "schedule" | "alert" | "export" | "report";
export type ActionMode = "read" | "write";
export type ActionRisk = "none" | "low" | "consequential";
export type ActionAvailability = "available" | "unavailable";

export type ActionDefinition = {
  id: string;
  kind: ActionKind;
  label: string;
  purpose: string;
  mode: ActionMode;
  risk: ActionRisk;
  availability: ActionAvailability;
  sideEffect: "none" | "read" | "write";
  authorizationRequired: boolean;
  confirmationRequired: boolean;
  requiredInputs: string[];
  outputType: string;
};

export type ActionAuthorization = {
  granted: boolean;
  scope?: string;
};

export type ActionConfirmation = {
  required: boolean;
  confirmed: boolean;
  reason: string;
};

export type ActionRequest = {
  kind: ActionKind;
  target?: string;
  payload?: string;
};

export type ActionDecision =
  | { state: "ready"; action: ActionDefinition; confirmation: ActionConfirmation }
  | { state: "blocked"; action: ActionDefinition; reason: string; confirmation: ActionConfirmation };

const runtimeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const webhookAvailable = Boolean(runtimeProcess?.BUSIQ_ACTION_WEBHOOK_URL);

const actions: ActionDefinition[] = [
  {
    id: "create-local-plan",
    kind: "create",
    label: "Create local plan",
    purpose: "Create a deterministic plan structure without external side effects.",
    mode: "write",
    risk: "low",
    availability: "available",
    sideEffect: "none",
    authorizationRequired: false,
    confirmationRequired: false,
    requiredInputs: ["request"],
    outputType: "plan",
  },
  {
    id: "update-business-record",
    kind: "update",
    label: "Update business record",
    purpose: "Change a connected business record.",
    mode: "write",
    risk: "consequential",
    availability: webhookAvailable ? "available" : "unavailable",
    sideEffect: "write",
    authorizationRequired: true,
    confirmationRequired: true,
    requiredInputs: ["connection", "target", "payload"],
    outputType: "updated-record",
  },
  {
    id: "send-message",
    kind: "send",
    label: "Send message",
    purpose: "Send a message through a connected communication service.",
    mode: "write",
    risk: "consequential",
    availability: "unavailable",
    sideEffect: "write",
    authorizationRequired: true,
    confirmationRequired: true,
    requiredInputs: ["connection", "recipient", "message"],
    outputType: "delivery-result",
  },
  {
    id: "schedule-action",
    kind: "schedule",
    label: "Schedule action",
    purpose: "Create a scheduled task through a connected scheduling service.",
    mode: "write",
    risk: "consequential",
    availability: "unavailable",
    sideEffect: "write",
    authorizationRequired: true,
    confirmationRequired: true,
    requiredInputs: ["connection", "schedule", "action"],
    outputType: "schedule-result",
  },
  {
    id: "create-alert",
    kind: "alert",
    label: "Create alert",
    purpose: "Create a monitoring alert through a connected source.",
    mode: "write",
    risk: "consequential",
    availability: "unavailable",
    sideEffect: "write",
    authorizationRequired: true,
    confirmationRequired: true,
    requiredInputs: ["connection", "condition", "destination"],
    outputType: "alert-result",
  },
  {
    id: "export-data",
    kind: "export",
    label: "Export data",
    purpose: "Export connected business data into a user-requested format.",
    mode: "write",
    risk: "consequential",
    availability: "unavailable",
    sideEffect: "write",
    authorizationRequired: true,
    confirmationRequired: true,
    requiredInputs: ["connection", "scope", "format"],
    outputType: "export",
  },
  {
    id: "generate-report",
    kind: "report",
    label: "Generate report",
    purpose: "Generate a report from connected or supplied evidence.",
    mode: "write",
    risk: "low",
    availability: "unavailable",
    sideEffect: "none",
    authorizationRequired: false,
    confirmationRequired: false,
    requiredInputs: ["evidence"],
    outputType: "report",
  },
];

export function listActions(): ActionDefinition[] {
  return actions.map(action => ({ ...action, requiredInputs: [...action.requiredInputs] }));
}

export function getAction(id: string): ActionDefinition | undefined {
  return actions.find(action => action.id === id);
}

export function getActionForKind(kind: ActionKind): ActionDefinition | undefined {
  return actions.find(action => action.kind === kind);
}

export function describeAction(action: ActionDefinition): string {
  return action.availability === "available"
    ? `${action.label} is available.`
    : `${action.label} is not connected yet.`;
}

export function authorizeAction(action: ActionDefinition, authorization?: ActionAuthorization): boolean {
  return !action.authorizationRequired || authorization?.granted === true;
}

export function buildActionDecision(
  action: ActionDefinition,
  options: { authorization?: ActionAuthorization; confirmed?: boolean } = {},
): ActionDecision {
  const confirmation: ActionConfirmation = {
    required: action.confirmationRequired,
    confirmed: action.confirmationRequired ? options.confirmed === true : true,
    reason: action.confirmationRequired
      ? "This action can create an external or consequential side effect."
      : "No consequential confirmation is required.",
  };

  if (!authorizeAction(action, options.authorization)) {
    return { state: "blocked", action, reason: "Authorization is required before this action can execute.", confirmation };
  }
  if (!confirmation.confirmed) {
    return { state: "blocked", action, reason: "Explicit confirmation is required before this consequential action can execute.", confirmation };
  }
  if (action.availability !== "available") {
    return { state: "blocked", action, reason: describeAction(action), confirmation };
  }
  return { state: "ready", action, confirmation };
}

export function resolveActionRequest(request: string): ActionRequest | undefined {
  const clean = request.trim();
  if (/\b(send|email|message|text)\b/i.test(clean)) return { kind: "send", target: clean };
  if (/\b(schedule|book|set a reminder|remind)\b/i.test(clean)) return { kind: "schedule", target: clean };
  if (/\b(alert|notify me|notify us|warn me)\b/i.test(clean)) return { kind: "alert", target: clean };
  if (/\b(export|download)\b/i.test(clean)) return { kind: "export", target: clean };
  if (/\b(report|generate a report)\b/i.test(clean)) return { kind: "report", target: clean };
  if (/\b(update|change|edit|modify)\b/i.test(clean)) return { kind: "update", target: clean };
  if (/\b(create|make|draft|build)\b/i.test(clean) && /\b(plan|report|document|template)\b/i.test(clean)) {
    return { kind: "create", target: clean };
  }
  return undefined;
}
