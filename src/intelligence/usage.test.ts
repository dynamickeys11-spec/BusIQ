import { describe, expect, it } from "vitest";
import { consumeUsage } from "./usage";

describe("usage controls", () => {
  it("allows requests within the window and blocks after the limit", () => {
    const states = new Map();
    const policy = { windowMs: 60_000, maxRequests: 2, maxRequestChars: 4_000 };
    expect(consumeUsage(states, "u1", 0, policy).allowed).toBe(true);
    expect(consumeUsage(states, "u1", 1_000, policy).allowed).toBe(true);
    expect(consumeUsage(states, "u1", 2_000, policy).allowed).toBe(false);
  });

  it("resets usage after the window", () => {
    const states = new Map();
    const policy = { windowMs: 60_000, maxRequests: 1, maxRequestChars: 4_000 };
    expect(consumeUsage(states, "u1", 0, policy).allowed).toBe(true);
    expect(consumeUsage(states, "u1", 1_000, policy).allowed).toBe(false);
    expect(consumeUsage(states, "u1", 60_000, policy).allowed).toBe(true);
  });
});
