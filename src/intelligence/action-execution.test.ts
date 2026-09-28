import { describe, expect, it } from "vitest";
import { executeActionSafely } from "./action-execution";
import { getActionForKind } from "./actions";

describe("safe action execution", () => {
  it("blocks a write before an unavailable executor can claim success", () => {
    const result = executeActionSafely(getActionForKind("send")!, {
      authorization: { granted: true, scope: "messaging" },
      confirmed: true,
    });
    expect(result.state).toBe("blocked");
    expect(result.audit.map(event => event.state)).toEqual(["requested", "blocked"]);
  });

  it("requires confirmation even when authorization exists", () => {
    const result = executeActionSafely(getActionForKind("send")!, {
      authorization: { granted: true },
    });
    expect(result.state).toBe("blocked");
    expect(result.audit.at(-1)?.reason).toContain("confirmation");
  });

  it("records a safe execution for an available no-side-effect action", () => {
    const result = executeActionSafely(getActionForKind("create")!, {});
    expect(result.state).toBe("executed");
    expect(result.audit.map(event => event.state)).toEqual(["requested", "executed"]);
  });
});
