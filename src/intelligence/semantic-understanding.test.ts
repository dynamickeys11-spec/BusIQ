import { resolveIntent } from "../bie/intent.js";
import { understandRequest } from "./semantic-understanding.js";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const cases = [
  ["What should I focus on when starting a small business?", "plan"],
  ["My sales have fallen. What's going on?", "investigate"],
  ["Make me a business plan for a laundry service.", "create"],
  ["How much did we sell last month?", "retrieve"],
  ["Explain gross profit to me.", "explain"],
  ["Which is better for this business, option A or B?", "compare"],
];

for (const [request, expected] of cases) {
  const intent = resolveIntent(request);
  assert(intent.kind === expected, request + " -> expected " + expected + ", got " + intent.kind);
  const understanding = understandRequest(request, intent);
  assert(understanding.normalizedText === request, "normalization mismatch");
  assert(understanding.desiredOutcome !== undefined, "missing desired outcome for " + request);
}

const preBusiness = understandRequest(
  "I don't have a business idea. What can I start with ₦100,000?",
  resolveIntent("I don't have a business idea. What can I start with ₦100,000?"),
);
assert(preBusiness.stage === "pre-business", "pre-business stage not detected");
assert(preBusiness.quantities.some(value => value.includes("100,000")), "quantity not extracted");

const followUp = understandRequest(
  "What about the second option?",
  resolveIntent("What about the second option?"),
  "Compare three business ideas for me.",
);
assert(followUp.operation === "EXPANSION", "follow-up/expansion operation not detected");
assert(followUp.references.length > 0, "reference not detected");

console.log("semantic-understanding tests passed");
