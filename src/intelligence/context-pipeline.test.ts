import { describe, expect, it } from "vitest";
import { runIntelligencePipeline } from "./pipeline";
import { createContextEntry } from "./context";

describe("pipeline persistent context", () => {
  const now = new Date("2026-09-28T09:00:00.000Z");

  it("uses persistent context for planning without promoting it to verified evidence", () => {
    const context = [
      createContextEntry("business", "name", "Nexa Example"),
      createContextEntry("knowledge", "sales-note", "Weekend sales are usually stronger."),
    ];
    const result = runIntelligencePipeline("Create a business plan", { context, now });
    expect(result.status).toBe("ready");
    expect(result.contextUsed?.map(item => item.key)).toEqual(["name", "sales-note"]);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].kind).toBe("user");
  });

  it("excludes expired persistent context", () => {
    const context = [
      createContextEntry("business", "name", "Nexa Example", { expiresAt: "2026-09-27T09:00:00.000Z" }),
      createContextEntry("business", "location", "Lagos"),
    ];
    const result = runIntelligencePipeline("Create a business plan", { context, now });
    expect(result.contextUsed?.map(item => item.key)).toEqual(["location"]);
  });

  it("keeps decisions distinct from business facts", () => {
    const context = [
      createContextEntry("decision", "pricing", "Focus on repeat customers."),
      createContextEntry("business", "name", "Nexa Example"),
    ];
    const result = runIntelligencePipeline("Create a business plan", { context, now });
    expect(result.contextUsed?.some(item => item.kind === "decision")).toBe(true);
    expect(result.evidence.some(item => item.label === "pricing")).toBe(false);
  });
});
