import { describe, expect, it } from "vitest";
import { evaluateAutonomyGates } from "./gates";

describe("autonomy gates", () => {
  it("keeps autonomy disabled until every required gate passes", () => {
    const snapshot = evaluateAutonomyGates({
      authenticated: true,
      businessConnected: true,
      realModelAvailable: true,
      researchAvailable: true,
      businessDataAvailable: true,
      actionAuditAvailable: true,
      actionProviderAvailable: true,
      outcomeTrackingAvailable: true,
      benchmarkPassed: false,
    });

    expect(snapshot.enabled).toBe(false);
    expect(snapshot.gates.find((gate) => gate.id === "benchmark")?.passed).toBe(false);
  });

  it("enables autonomy only when every gate passes", () => {
    const snapshot = evaluateAutonomyGates({
      authenticated: true,
      businessConnected: true,
      realModelAvailable: true,
      researchAvailable: true,
      businessDataAvailable: true,
      actionAuditAvailable: true,
      actionProviderAvailable: true,
      outcomeTrackingAvailable: true,
      benchmarkPassed: true,
    });

    expect(snapshot.enabled).toBe(true);
  });
});
