import { runIntelligencePipeline } from "../intelligence";
import { benchmarkCases } from "./cases";

export type BenchmarkResult = {
  id: string;
  passed: boolean;
  expectedStatus: string;
  actualStatus: string;
  reason?: string;
};

export function runBenchmarkSuite(): BenchmarkResult[] {
  return benchmarkCases.map((testCase) => {
    const result = runIntelligencePipeline(testCase.request);
    const statusMatches = result.status === testCase.expectedStatus;
    const capabilityMatches = !testCase.requiredCapability || result.intent.requiredCapabilities.includes(testCase.requiredCapability);
    const completionSafety =
      !testCase.mustNotClaimCompletion || !/\b(?:I|we|BUSIQ)\s+(?:have|has|did|just|successfully)\s+(?:completed|finished|done)\b/i.test(result.answer.detail);

    return {
      id: testCase.id,
      passed: statusMatches && capabilityMatches && completionSafety,
      expectedStatus: testCase.expectedStatus,
      actualStatus: result.status,
      ...(!(statusMatches && capabilityMatches && completionSafety)
        ? { reason: [
            !statusMatches ? "status mismatch" : "",
            !capabilityMatches ? "required capability missing" : "",
            !completionSafety ? "answer claims unsupported completion" : "",
          ].filter(Boolean).join(", ") }
        : {}),
    };
  });
}
