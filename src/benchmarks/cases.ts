export type BenchmarkCase = {
  id: string;
  request: string;
  expectedStatus: "ready" | "needs_clarification" | "needs_connection";
  requiredCapability?: string;
  mustNotClaimCompletion?: boolean;
};

export const benchmarkCases: BenchmarkCase[] = [
  { id: "clarification-compare", request: "Compare", expectedStatus: "needs_clarification" },
  { id: "local-plan", request: "Create a business plan", expectedStatus: "ready" },
  { id: "business-sales", request: "Why are my sales down?", expectedStatus: "needs_connection", requiredCapability: "sales", mustNotClaimCompletion: true },
  { id: "external-market", request: "What are the latest market trends?", expectedStatus: "needs_connection", requiredCapability: "external-research", mustNotClaimCompletion: true },
  { id: "local-90-day", request: "Build a 90-day growth plan", expectedStatus: "ready" },
];
