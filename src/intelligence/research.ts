import type { ResolvedIntent } from "../bie/intent";
import type { ResearchStep } from "./types";
import { researchPlanFor } from "./research-engine";

export function buildResearchPlan(intent: ResolvedIntent): ResearchStep[] {
  return researchPlanFor(intent);
}
