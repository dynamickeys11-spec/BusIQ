import { describe, expect, it } from "vitest";
import { resolveIntent } from "../bie/intent.js";
import { understandRequest } from "./semantic-understanding.js";

describe("semantic understanding", () => {
  it("classifies natural language and extracts context", () => {
    const cases = [
      ["What should I focus on when starting a small business?", "plan"],
      ["My sales have fallen. What's going on?", "investigate"],
      ["Make me a business plan for a laundry service.", "plan"],
      ["How much did we sell last month?", "retrieve"],
      ["Explain gross profit to me.", "explain"],
      ["Which is better for this business, option A or B?", "compare"],
    ] as const;
    for (const [request, expected] of cases) {
      const intent = resolveIntent(request);
      expect(intent.kind, request).toBe(expected);
      const understanding = understandRequest(request, intent);
      expect(understanding.normalizedText).toBe(request);
      expect(understanding.desiredOutcome).toBeDefined();
    }
  });

  it("detects pre-business constraints and conversation references", () => {
    const request = "I don't have a business idea. What can I start with ₦100,000?";
    const preBusiness = understandRequest(request, resolveIntent(request));
    expect(preBusiness.stage).toBe("pre-business");
    expect(preBusiness.quantities.some(value => value.includes("100,000"))).toBe(true);
    const followUp = understandRequest("What about the second option?", resolveIntent("What about the second option?"), "Compare three business ideas for me.");
    expect(followUp.operation).toBe("EXPANSION");
    expect(followUp.references.length).toBeGreaterThan(0);
  });
});
