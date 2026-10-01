export type AutonomyGate = {
  id: string;
  required: boolean;
  passed: boolean;
  reason: string;
};

export type AutonomyGateSnapshot = {
  enabled: boolean;
  gates: AutonomyGate[];
};

export function evaluateAutonomyGates(input: {
  authenticated: boolean;
  businessConnected: boolean;
  realModelAvailable: boolean;
  researchAvailable: boolean;
  businessDataAvailable: boolean;
  actionAuditAvailable: boolean;
  actionProviderAvailable: boolean;
  outcomeTrackingAvailable: boolean;
  benchmarkPassed: boolean;
}): AutonomyGateSnapshot {
  const gates: AutonomyGate[] = [
    { id: "authenticated", required: true, passed: input.authenticated, reason: "Autonomous business work requires a permanent account." },
    { id: "business-connected", required: true, passed: input.businessConnected, reason: "A business workspace must be selected." },
    { id: "real-model", required: true, passed: input.realModelAvailable, reason: "A real model provider must be available." },
    { id: "research", required: true, passed: input.researchAvailable, reason: "Current external evidence must be available." },
    { id: "business-data", required: true, passed: input.businessDataAvailable, reason: "Connected business evidence must be available." },
    { id: "action-audit", required: true, passed: input.actionAuditAvailable, reason: "Actions require durable audit events." },
    { id: "action-provider", required: true, passed: input.actionProviderAvailable, reason: "A real action provider must be configured." },
    { id: "outcomes", required: true, passed: input.outcomeTrackingAvailable, reason: "Outcome tracking must be available." },
    { id: "benchmark", required: true, passed: input.benchmarkPassed, reason: "The intelligence benchmark must pass before autonomy is enabled." },
  ];

  return {
    enabled: gates.every((gate) => !gate.required || gate.passed),
    gates,
  };
}
