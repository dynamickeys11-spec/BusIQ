import { describe, expect, it } from "vitest";
import { authorizeBusinessMembership, requireAuthenticated } from "./auth";

describe("authentication and authorization", () => {
  it("does not treat an unverified session as authenticated", () => {
    expect(requireAuthenticated("unauthenticated").state).toBe("blocked");
    expect(requireAuthenticated("unknown", { userId: "u1", authenticatedAt: "2026-09-28T00:00:00.000Z" }).state).toBe("blocked");
    expect(requireAuthenticated("authenticated", { userId: "u1", authenticatedAt: "2026-09-28T00:00:00.000Z" }).state).toBe("allowed");
  });

  it("enforces business membership and role scope", () => {
    const memberships = [
      { userId: "u1", businessId: "b1", role: "member" as const },
      { userId: "u2", businessId: "b1", role: "admin" as const },
    ];
    expect(authorizeBusinessMembership({ userId: "u1", businessId: "b1" }, memberships).state).toBe("allowed");
    expect(authorizeBusinessMembership({ userId: "u1", businessId: "b2" }, memberships).state).toBe("blocked");
    expect(authorizeBusinessMembership({ userId: "u1", businessId: "b1", requiredRoles: ["admin"] }, memberships).state).toBe("blocked");
    expect(authorizeBusinessMembership({ userId: "u2", businessId: "b1", requiredRoles: ["admin"] }, memberships).state).toBe("allowed");
  });
});
