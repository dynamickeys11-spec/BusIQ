import { describe, expect, it } from "vitest";
import {
  authorizeResource,
  checkBusinessIsolation,
  checkResourceSensitivity,
  createLocalSecurityPolicy,
  validateTruthfulnessClaim,
} from "./security";

describe("security policy", () => {
  it("enforces business-level isolation", () => {
    expect(checkBusinessIsolation({ businessId: "b1" }, { id: "r1", businessId: "b1", sensitivity: "internal" }).state).toBe("allowed");
    expect(checkBusinessIsolation({ businessId: "b1" }, { id: "r2", businessId: "b2", sensitivity: "internal" }).state).toBe("blocked");
    expect(checkBusinessIsolation({}, { id: "r3", businessId: "b1", sensitivity: "internal" }).state).toBe("blocked");
  });

  it("enforces tool permissions and sensitive-data policy", () => {
    const permission = { toolId: "business-data", modes: ["read" as const], allowedBusinessIds: ["b1"], sensitiveDataAllowed: false };
    const resource = { id: "r1", businessId: "b1", sensitivity: "sensitive" as const };
    expect(checkResourceSensitivity(permission, resource, "read").state).toBe("blocked");
    expect(checkResourceSensitivity(permission, { ...resource, sensitivity: "internal" }, "write").state).toBe("blocked");
    expect(checkResourceSensitivity(permission, { ...resource, sensitivity: "internal" }, "read").state).toBe("allowed");
  });

  it("fails closed for sensitive data unless explicit sensitive-data permission is granted", () => {
    const resource = { id: "secret-1", businessId: "b1", sensitivity: "sensitive" as const };
    const denied = { toolId: "business-data", modes: ["read" as const], allowedBusinessIds: ["b1"], sensitiveDataAllowed: false };
    const allowed = { ...denied, sensitiveDataAllowed: true };
    expect(checkResourceSensitivity(denied, resource, "read").state).toBe("blocked");
    expect(checkResourceSensitivity(allowed, resource, "read").state).toBe("allowed");
  });

  it("requires permission before resource authorization", () => {
    const policy = createLocalSecurityPolicy({ businessId: "b1" });
    const result = authorizeResource(policy, { id: "r1", businessId: "b1", sensitivity: "internal" }, "read");
    expect(result.state).toBe("blocked");
  });

  it("does not permit unsupported access or execution claims", () => {
    expect(validateTruthfulnessClaim({ kind: "access", resource: "sales system", hasAccess: false }).state).toBe("blocked");
    expect(validateTruthfulnessClaim({ kind: "action", actionId: "send-message", executed: false }).state).toBe("blocked");
    expect(validateTruthfulnessClaim({ kind: "evidence", evidenceId: "e1", verified: false }).state).toBe("blocked");
    expect(validateTruthfulnessClaim({ kind: "action", actionId: "create-local-plan", executed: true }).state).toBe("allowed");
  });
});
