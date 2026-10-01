import { describe, expect, it } from "vitest";
import { resolveIntent } from "../bie/intent.js";
import { understandRequest } from "./semantic-understanding.js";

const first = "Compare three business ideas I could start.";
const firstIntent = resolveIntent(first);
const follow = "What about the second one?";
const followIntent = resolveIntent(follow);
const understood = understandRequest(
  follow,
  followIntent,
  first,
  [
    { key: "last-request", value: first },
    { key: "last-response", value: "Option one, option two, option three." },
  ],
);

if (understood.operation !== "EXPANSION") throw new Error("Expected conversational expansion.");
if (!understood.references.includes("second one")) throw new Error("Expected ordinal reference.");
if (!understood.signals.includes("context-memory")) throw new Error("Expected context-memory signal.");

const scenario = understandRequest(
  "What if I only have ₦100,000?",
  resolveIntent("What if I only have ₦100,000?"),
  first,
  [{ key: "last-request", value: first }],
);
if (scenario.operation !== "SCENARIO") throw new Error("Expected scenario operation.");
if (!scenario.quantities.some(value => value.includes("100,000"))) throw new Error("Expected quantity.");



describe("conversation memory", () => {
  it("resolves follow-ups and scenarios using prior context", () => {
    import { resolveIntent } from "../bie/intent.js";
import { understandRequest } from "./semantic-understanding.js";

const first = "Compare three business ideas I could start.";
const firstIntent = resolveIntent(first);
const follow = "What about the second one?";
const followIntent = resolveIntent(follow);
const understood = understandRequest(
  follow,
  followIntent,
  first,
  [
    { key: "last-request", value: first },
    { key: "last-response", value: "Option one, option two, option three." },
  ],
);

if (understood.operation !== "EXPANSION") throw new Error("Expected conversational expansion.");
if (!understood.references.includes("second one")) throw new Error("Expected ordinal reference.");
if (!understood.signals.includes("context-memory")) throw new Error("Expected context-memory signal.");

const scenario = understandRequest(
  "What if I only have ₦100,000?",
  resolveIntent("What if I only have ₦100,000?"),
  first,
  [{ key: "last-request", value: first }],
);
if (scenario.operation !== "SCENARIO") throw new Error("Expected scenario operation.");
if (!scenario.quantities.some(value => value.includes("100,000"))) throw new Error("Expected quantity.");



  });
});
