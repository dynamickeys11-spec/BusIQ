import { describe, expect, it } from "vitest";
import { resolveIntent } from "../bie/intent.js";
import { understandRequest } from "./semantic-understanding.js";

describe("conversation memory", () => {
  it("resolves follow-ups using prior context", () => {
    const first = "Compare three business ideas I could start.";
    const follow = "What about the second one?";
    const understood = understandRequest(
      follow,
      resolveIntent(follow),
      first,
      [
        { key: "last-request", value: first },
        { key: "last-response", value: "Option one, option two, option three." },
      ],
    );

    expect(understood.operation).toBe("EXPANSION");
    expect(understood.references).toContain("second one");
    expect(understood.signals).toContain("context-memory");
  });

  it("recognizes scenario changes and preserves quantities", () => {
    const first = "Compare three business ideas I could start.";
    const scenario = understandRequest(
      "What if I only have ₦100,000?",
      resolveIntent("What if I only have ₦100,000?"),
      first,
      [{ key: "last-request", value: first }],
    );

    expect(scenario.operation).toBe("SCENARIO");
    expect(scenario.quantities.some((value) => value.includes("100,000"))).toBe(true);
  });
});
