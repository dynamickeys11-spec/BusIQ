import { describe, expect, it } from "vitest";
import {
  contextFreshness,
  createContextEntry,
  filterUsableContext,
  mergeContext,
  rememberDecision,
  rememberProvenance,
} from "./context";

describe("persistent context", () => {
  const now = new Date("2026-09-28T09:00:00.000Z");

  it("expires time-bound context instead of treating it as permanent truth", () => {
    const expired = createContextEntry("business", "sales", "100", {
      expiresAt: "2026-09-27T09:00:00.000Z",
    });
    const expiring = createContextEntry("business", "inventory", "10", {
      expiresAt: "2026-09-28T20:00:00.000Z",
    });
    expect(contextFreshness(expired, now)).toBe("expired");
    expect(contextFreshness(expiring, now)).toBe("current");
    expect(filterUsableContext([expired, expiring], now)).toHaveLength(1);
  });

  it("preserves decision and source provenance as distinct context", () => {
    const decision = rememberDecision("Focus on repeat customers", "Chosen during the planning session.", { workId: "work-1" });
    const provenance = rememberProvenance("internal-sales-export", "2026-09-27", { workId: "work-1" });
    expect(decision.kind).toBe("decision");
    expect(provenance.kind).toBe("provenance");
    expect(provenance.sourceDate).toBe("2026-09-27");
  });

  it("replaces the same context key without duplicating it", () => {
    const first = createContextEntry("business", "name", "Old");
    const second = createContextEntry("business", "name", "New");
    const merged = mergeContext([first], [second]);
    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe("New");
  });
});
