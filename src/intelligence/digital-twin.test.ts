import { describe, expect, it } from "vitest";
import { buildBusinessDigitalTwin, simulateTwinScenario } from "./digital-twin.js";
import { buildBusinessWorldModel } from "./world-model.js";

describe("business digital twin", () => {
  it("builds an evidence-grounded state from normalized records", () => {
    const records = [
      { type: "sale" as const, id: "s1", occurredAt: "2026-09-01T00:00:00Z", amount: 1000, currency: "NGN", source: "test", metadata: { evidenceId: "e1" } },
      { type: "customer" as const, id: "c1", name: "A", source: "test", observedAt: "2026-09-01T00:00:00Z", metadata: { evidenceId: "e2" } },
    ];
    const evidence = [
      { id: "e1", kind: "retrieved" as const, label: "sales record", detail: "₦1000", source: "test", verification: "verified" as const },
      { id: "e2", kind: "retrieved" as const, label: "customer record", detail: "A", source: "test", verification: "verified" as const },
    ];
    const world = buildBusinessWorldModel(records, evidence, []);
    const twin = buildBusinessDigitalTwin(records, evidence, world);
    expect(twin.entityCount).toBe(2);
    expect(twin.metrics.find(item => item.id === "sales-revenue")?.value).toBe(1000);
    expect(twin.metrics.find(item => item.id === "sales-revenue")?.evidenceIds).toContain("e1");
  });

  it("keeps scenarios separate from observed state", () => {
    const world = buildBusinessWorldModel([], [], []);
    const twin = buildBusinessDigitalTwin([], [], world);
    const scenario = simulateTwinScenario(twin, "price test", { "sales-revenue": 0.1 });
    expect(twin.scenarios).toHaveLength(0);
    expect(scenario.name).toBe("price test");
    expect(scenario.projectedMetrics).toHaveLength(twin.metrics.length);
  });
});
