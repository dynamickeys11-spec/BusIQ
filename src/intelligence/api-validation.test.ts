import { describe, expect, it } from "vitest";
import { validateRequestBody } from "./api-validation";

describe("API request validation", () => {
  it("rejects empty or missing requests", () => {
    expect(validateRequestBody({}, 400)).toMatchObject({ ok: false, status: 400 });
    expect(validateRequestBody({ request: "   " }, 400)).toMatchObject({ ok: false, status: 400 });
  });
  it("rejects oversized requests", () => {
    expect(validateRequestBody({ request: "x".repeat(401) }, 400)).toMatchObject({ ok: false, status: 413 });
  });
  it("accepts bounded requests", () => {
    expect(validateRequestBody({ request: "Why are sales down?" }, 400).ok).toBe(true);
  });
  it("accepts a valid business scope", () => {
    const result = validateRequestBody({
      request: "Why are sales down?",
      businessId: "550e8400-e29b-41d4-a716-446655440000",
    }, 400);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.businessId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
  it("rejects malformed business scope", () => {
    expect(validateRequestBody({
      request: "Why are sales down?",
      businessId: "not-a-uuid",
    }, 400)).toMatchObject({ ok: false, status: 400 });
  });
  it("accepts a valid local context payload", () => {
    const result = validateRequestBody({
      request: "Why are sales down?",
      context: {
        business: [{ id: "1", kind: "business", key: "name", value: "Example", createdAt: "2026-09-30T00:00:00.000Z" }],
        user: [],
        conversation: [],
        work: [],
        decisions: [],
        knowledge: [],
        provenance: [],
      },
    }, 400);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context?.business[0]?.value).toBe("Example");
  });
  it("rejects malformed context payloads", () => {
    expect(validateRequestBody({
      request: "Why are sales down?",
      context: { business: "not-an-array" },
    }, 400)).toMatchObject({ ok: false, status: 400 });
  });
});
