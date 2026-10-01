import{describe,expect,it}from"vitest";import{assessEvidence}from"./evidence-engine.js";
describe("evidence engine",()=>{it("detects incompleteness",()=>{const r=assessEvidence([],["sales"]);expect(r.sufficiency).toBe("insufficient");expect(r.completeness).toBe(0)});it("flags unverified evidence",()=>{const r=assessEvidence([{id:"1",kind:"retrieved",label:"sales",detail:"x",source:"test",verification:"unverified",freshness:"current",relevance:"direct"}]);expect(r.diagnostics.some(x=>x.category==="verification")).toBe(true)})});

it("reports completeness and contradictions", () => {
  const result = assessEvidence([
    { id: "a", kind: "retrieved", label: "sales", detail: "100", source: "source-a", verification: "verified", freshness: "current", relevance: "direct", scope: { periodStart: "2026-09-01" } },
    { id: "b", kind: "retrieved", label: "sales", detail: "120", source: "source-b", verification: "verified", freshness: "current", relevance: "direct", scope: { periodStart: "2026-09-01" } },
  ], ["sales", "customers"]);
  expect(result.completeness).toBe(0.5);
  expect(result.contradictions).toHaveLength(1);
  expect(result.sufficiency).toBe("insufficient");
});
