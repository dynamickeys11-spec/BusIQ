import { describe, expect, it } from "vitest";
import { runIntelligencePipeline } from "./pipeline";
import { validateRequestBody } from "./api-validation";
import { consumeUsage } from "./usage";
import { executeTool } from "./execution";
import { executeActionSafely } from "./action-execution";
import { getAction } from "./actions";

describe("BUSIQ final verification: performance and recovery", () => {
  it("keeps the deterministic intelligence pipeline within a bounded local execution budget", () => {
    const requests = [
      "Create a business plan",
      "Build a 90-day growth plan",
      "Why are my sales down?",
      "Show my expenses",
      "What are the latest market trends?",
    ];

    const started = performance.now();
    for (let i = 0; i < 100; i += 1) {
      runIntelligencePipeline(requests[i % requests.length]);
    }
    const elapsedMs = performance.now() - started;

    // This is a regression guard, not a production SLA. The local deterministic
    // pipeline should remain comfortably below this ceiling on CI hardware.
    expect(elapsedMs).toBeLessThan(5_000);
  });

  it("preserves deterministic output across repeated runs", () => {
    const first = runIntelligencePipeline("Create a business plan");
    const second = runIntelligencePipeline("Create a business plan");

    expect(second.status).toBe(first.status);
    expect(second.intent.kind).toBe(first.intent.kind);
    expect(second.answer.type).toBe(first.answer.type);
    expect(second.execution.map(item => item.toolId)).toEqual(first.execution.map(item => item.toolId));
  });

  it("rejects malformed API bodies without attempting intelligence execution", () => {
    expect(validateRequestBody(undefined, 4_000)).toMatchObject({ ok: false, status: 400 });
    expect(validateRequestBody({ request: "" }, 4_000)).toMatchObject({ ok: false, status: 400 });
    expect(validateRequestBody({ request: "x".repeat(4_001) }, 4_000)).toMatchObject({ ok: false, status: 413 });
    expect(validateRequestBody({ request: "Create a plan" }, 4_000)).toEqual({ ok: true, request: "Create a plan" });
  });

  it("recovers usage state after the configured window", () => {
    const states = new Map();
    const policy = { windowMs: 1_000, maxRequests: 2, maxRequestChars: 4_000 };

    expect(consumeUsage(states, "client", 0, policy).allowed).toBe(true);
    expect(consumeUsage(states, "client", 10, policy).allowed).toBe(true);
    expect(consumeUsage(states, "client", 20, policy).allowed).toBe(false);

    const recovered = consumeUsage(states, "client", 1_000, policy);
    expect(recovered.allowed).toBe(true);
    expect(recovered.state.count).toBe(1);
  });

  it("blocks unknown tools and records a recoverable execution result", () => {
    const result = executeTool({ toolId: "missing-tool", inputs: {} });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("not registered");
  });

  it("records action failure without pretending the action executed", () => {
    const action = getAction("update-business-record");
    expect(action).toBeTruthy();

    const result = executeActionSafely(action!, {
      authorization: { granted: true, scope: "business:test" },
      confirmed: true,
    });

    expect(result.state).not.toBe("executed");
    expect(result.audit.map(event => event.state)).toEqual(["requested", "blocked"]);
    expect(result.reason).toBeTruthy();
  });
});
