import { describe, expect, it } from "vitest";
import {
  buildActionDecision,
  getActionForKind,
  listActions,
  resolveActionRequest,
} from "./actions";
import { appendActionAuditEvent, createActionAuditEvent } from "./action-audit";

describe("action registry", () => {
  it("contains the roadmap action families", () => {
    const kinds = new Set(listActions().map(action => action.kind));
    expect(kinds).toEqual(new Set(["create", "update", "send", "schedule", "alert", "export", "report"]));
  });

  it("keeps consequential writes authorization and confirmation gated", () => {
    const send = getActionForKind("send")!;
    expect(send.mode).toBe("write");
    expect(send.authorizationRequired).toBe(true);
    expect(send.confirmationRequired).toBe(true);

    const blocked = buildActionDecision(send, { authorization: { granted: true } });
    expect(blocked.state).toBe("blocked");
    if (blocked.state === "blocked") {
      expect(blocked.reason).toContain("confirmation");
    }

    const ready = buildActionDecision(send, {
      authorization: { granted: true, scope: "messaging" },
      confirmed: true,
    });
    expect(ready.state).toBe("blocked");
    if (ready.state === "blocked") {
      expect(ready.reason).toContain("not connected");
    }
  });

  it("never treats unavailable actions as executable", () => {
    const update = getActionForKind("update")!;
    const result = buildActionDecision(update, { authorization: { granted: true }, confirmed: true });
    expect(result.state).toBe("blocked");
  });

  it("resolves explicit operational requests", () => {
    expect(resolveActionRequest("Send the customer an email")).toMatchObject({ kind: "send" });
    expect(resolveActionRequest("Schedule a reminder for tomorrow")).toMatchObject({ kind: "schedule" });
    expect(resolveActionRequest("Export my sales")).toMatchObject({ kind: "export" });
    expect(resolveActionRequest("Update the customer record")).toMatchObject({ kind: "update" });
  });
});

describe("action audit trail", () => {
  it("creates and retains ordered audit events", () => {
    const first = createActionAuditEvent("send-message", "requested", "User requested a message.");
    const second = createActionAuditEvent("send-message", "blocked", "Connection is missing.");
    const events = appendActionAuditEvent([first], second);
    expect(events.map(event => event.state)).toEqual(["requested", "blocked"]);
    expect(events[1].actionId).toBe("send-message");
  });
});
