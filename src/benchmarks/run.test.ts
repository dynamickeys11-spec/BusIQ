import { describe, expect, it } from "vitest";
import { runBenchmarkSuite } from "./run";

describe("BUSIQ benchmark suite", () => {
  it("passes the baseline intelligence safety cases", () => {
    const results = runBenchmarkSuite();
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.filter((result) => !result.passed)).toEqual([]);
  });
});
