import { describe, expect, it } from "vitest";
import { executeActionSafely } from "./action-execution";
import { summarizeActionAudit } from "./action-audit";
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

  it("summarizes the latest state per action without pretending the audit is durable", () => {
    const result = executeActionSafely(getActionForKind("send")!, {
      authorization: { granted: true },
    });
    const summary = summarizeActionAudit(result.audit);
    expect(summary).toHaveLength(1);
    expect(summary[0].actionId).toBe("send-message");
    expect(summary[0].latestState).toBe("blocked");
    expect(summary[0].eventCount).toBe(2);
  });
});
