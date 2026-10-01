import { describe, expect, it } from "vitest";
import { buildBusinessWorldModel } from "./world-model.js";
import { buildInvestigationPlan } from "./investigation.js";

describe("business world model", () => {
  it("represents normalized records and explicit relationships", () => {
    const model = buildBusinessWorldModel([
      {
        type: "sale", id: "s1", occurredAt: "2026-10-01T00:00:00Z",
        amount: 100, currency: "NGN", customerId: "c1", productId: "p1", source: "test",
      },
      { type: "customer", id: "c1", name: "Customer", source: "test", observedAt: "2026-10-01T00:00:00Z" },
    ]);
    expect(model.entities).toHaveLength(2);
    expect(model.relationships).toHaveLength(2);
    expect(model.relationships.map(item => item.relation)).toEqual(["sold-to", "contains-product"]);
  });

  it("does not turn missing evidence into a conclusion", () => {
    const model = buildBusinessWorldModel();
    const plan = buildInvestigationPlan("Why are my sales down?", model, []);
    expect(plan.hypotheses.length).toBeGreaterThan(1);
    expect(plan.informationGaps).toContain("Connected business evidence");
    expect(plan.stoppingReason).toMatch(/evidence-limited/i);
  });
});
