import { describe, expect, it } from "vitest";
import { resolveSemanticContext } from "./context-resolver.js";

describe("semantic context resolution", () => {
  it("resolves a semantic reference against current context without treating it as evidence", () => {
    const result = resolveSemanticContext(
      ["second option"],
      [
        { id: "a", kind: "conversation", key: "first option", value: "Laundry", createdAt: "2026-10-01T00:00:00Z" },
        { id: "b", kind: "conversation", key: "second option", value: "Food distribution", createdAt: "2026-10-01T00:00:00Z" },
      ],
    );
    expect(result.references[0]?.targetId).toBe("b");
    expect(result.entries.some(entry => entry.id === "b")).toBe(true);
    expect(result.summary.at(-1)).toContain("not evidence");
  });

  it("leaves ambiguous references unresolved", () => {
    const result = resolveSemanticContext(
      ["the plan"],
      [
        { id: "a", kind: "conversation", key: "plan", value: "Option A", createdAt: "2026-10-01T00:00:00Z" },
        { id: "b", kind: "conversation", key: "plan", value: "Option B", createdAt: "2026-10-01T00:00:00Z" },
      ],
    );
    expect(result.unresolvedReferences).toEqual(["the plan"]);
  });
});
