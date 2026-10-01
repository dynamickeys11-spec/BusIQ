import { describe, expect, it } from "vitest";
import { buildSemanticModel } from "./semantic-model.js";

describe("semantic model", () => {
  it("separates a pre-business request from actual evidence", () => {
    const model = buildSemanticModel("I don't have a business idea and want to start something unusual", [
      { id: "request", kind: "user", label: "User request", detail: "I don't have a business idea and want to start something unusual", source: "User input" },
    ], "unknown");

    expect(model.intent.stage).toBe("pre-business");
    expect(model.intent.uncertainty).toBe("high");
    expect(model.possibilities[0]?.type).toBe("opportunity");
    expect(model.possibilities[0]?.status).toBe("candidate");
    expect(model.actual[0]?.kind).toBe("assumed");
  });

  it("does not turn an investigation hypothesis into an actual fact", () => {
    const model = buildSemanticModel("Why are my sales down?", [
      { id: "s1", kind: "verified", label: "Sales", detail: "Revenue fell 20%", source: "Connected sales", verification: "verified" },
    ], "investigate", ["FINDING"]);

    expect(model.intent.stage).toBe("existing-business");
    expect(model.possibilities[0]?.type).toBe("hypothesis");
    expect(model.possibilities[0]?.status).toBe("unresolved");
    expect(model.actual.some(item => item.kind === "observed")).toBe(true);
  });
});
