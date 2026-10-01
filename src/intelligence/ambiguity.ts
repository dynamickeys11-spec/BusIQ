import type { AmbiguityIssue } from "./types.js";
import type { ResolvedIntent } from "../bie/intent.js";

export function detectAmbiguity(request: string, intent: ResolvedIntent): AmbiguityIssue[] {
  const words = request.trim().split(/\s+/).filter(Boolean);
  if (!request.trim()) return [{ field: "goal", reason: "No request was supplied.", question: "What would you like to understand or accomplish?" }];
  if (intent.kind === "unknown" && !intent.answerMode && !intent.needsExternalResearch && !intent.needsBusinessData) {
    return [{ field: "goal", reason: "BUSIQ cannot reliably determine the requested outcome from the wording provided.", question: "What would you like BUSIQ to understand, find, compare, plan, create, or explain?" }];
  }
  if (intent.secondaryIntents?.length) {
    return [{ field: "goal", reason: `The request contains multiple distinct goals: ${[intent.kind, ...intent.secondaryIntents].join(", ")}.`, question: "Which outcome should BUSIQ handle first?" }];
  }
  if (words.length < 3 && intent.kind !== "explain" && intent.answerMode !== "system_explanation" && intent.answerMode !== "direct_answer") {
    return [{ field: "goal", reason: "The request is too short to determine the intended outcome reliably.", question: "What exactly would you like BUSIQ to do?" }];
  }
  if ((intent.kind === "compare" || intent.kind === "retrieve") && !/\b(sales|revenue|profit|customers?|products?|inventory|suppliers?|expenses?|cash|price|business|plan|option|company|market|competitors?)\b/i.test(request)) {
    return [{ field: "subject", reason: "The request names an action but not the subject to act on.", question: "What should I compare or retrieve?" }];
  }
  return [];
}
