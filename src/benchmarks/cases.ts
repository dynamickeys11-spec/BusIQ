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
  { id: "local-90-day", request: "Build a 90-day growth plan", expectedStatus: "ready" },
  { id: "business-sales", request: "Why are my sales down?", expectedStatus: "needs_connection", requiredCapability: "sales", mustNotClaimCompletion: true },
  { id: "business-inventory", request: "Why is my inventory not moving?", expectedStatus: "needs_connection", requiredCapability: "inventory", mustNotClaimCompletion: true },
  { id: "business-profit", request: "How is my profit changing?", expectedStatus: "needs_connection", requiredCapability: "money", mustNotClaimCompletion: true },
  { id: "business-customers", request: "Why are my customers leaving?", expectedStatus: "needs_connection", requiredCapability: "customers", mustNotClaimCompletion: true },
  { id: "external-market", request: "What are the latest market trends?", expectedStatus: "needs_connection", requiredCapability: "external-research", mustNotClaimCompletion: true },
  { id: "external-competitors", request: "Research my competitors", expectedStatus: "needs_connection", requiredCapability: "external-research", mustNotClaimCompletion: true },
  { id: "pricing-decision", request: "Should I increase my price?", expectedStatus: "needs_connection", requiredCapability: "business-data-retrieval", mustNotClaimCompletion: true },
  { id: "marketing-plan", request: "Create a marketing plan for my business", expectedStatus: "needs_connection", requiredCapability: "marketing", mustNotClaimCompletion: true },
  { id: "explain-gross-profit", request: "Explain gross profit", expectedStatus: "ready" },
];
