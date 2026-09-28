import { describe, expect, it } from "vitest";
import { validateRequestBody } from "./api-validation";

describe("API request validation", () => {
  it("rejects empty or missing requests", () => {
    expect(validateRequestBody({}, 400).status).toBe(400);
    expect(validateRequestBody({ request: "   " }, 400).status).toBe(400);
  });
  it("rejects oversized requests", () => {
    expect(validateRequestBody({ request: "x".repeat(401) }, 400).status).toBe(413);
  });
  it("accepts bounded requests", () => {
    expect(validateRequestBody({ request: "Why are sales down?" }, 400).ok).toBe(true);
  });
});
