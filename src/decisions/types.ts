export type DecisionOption = {
  id: string;
  label: string;
  description?: string;
  evidenceIds: string[];
  risks: string[];
  assumptions: string[];
};

export type DecisionScenario = {
  id: string;
  label: string;
  assumptions: string[];
  expectedOutcomes: string[];
};

export type Decision = {
  id: string;
  businessId: string;
  question: string;
  context: string[];
  evidenceIds: string[];
  options: DecisionOption[];
  assumptions: string[];
  scenarios: DecisionScenario[];
  selectedOptionId?: string;
  confirmation?: {
    required: boolean;
    confirmed: boolean;
    confirmedBy?: string;
    confirmedAt?: string;
  };
  status: "draft" | "ready" | "confirmed" | "acted" | "observed" | "closed";
  createdAt: string;
  updatedAt: string;
};
