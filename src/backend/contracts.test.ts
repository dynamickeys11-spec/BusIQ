import { describe, expect, it } from "vitest";
import type { BackendStatus } from "./contracts";

describe("backend contracts", () => {
  it("represent unconfigured resources explicitly", () => {
    const status: BackendStatus = {
      capabilities: [
        { resource: "database", readiness: "not-configured", note: "No persistent database is connected." },
        { resource: "auth", readiness: "not-configured", note: "No production identity provider is connected." },
        { resource: "audit-log", readiness: "not-configured", note: "Audit persistence is not connected." },
      ],
    };
    expect(status.capabilities.every(x => x.readiness === "not-configured")).toBe(true);
  });
});
