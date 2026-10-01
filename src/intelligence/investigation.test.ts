import { describe, expect, it } from "vitest";
import { buildInvestigationPlan } from "./investigation.js";

describe("investigation planning", () => {
  it("records missing evidence per hypothesis", () => {
    const result = buildInvestigationPlan("Why are my sales down?", { entities: [], relationships: [], evidenceIds: [], domainsPresent: [], limitations: [] }, []);
    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.hypotheses.every(h => h.missingEvidence.length > 0)).toBe(true);
    expect(result.informationGaps.length).toBeGreaterThan(0);
  });
});
