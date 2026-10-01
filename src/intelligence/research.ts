import type { ResolvedIntent } from "../bie/intent.js";
import type { ResearchStep } from "./types.js";
import { researchPlanFor } from "./research-engine.js";

export function buildResearchPlan(intent: ResolvedIntent): ResearchStep[] {
  return researchPlanFor(intent);
}
