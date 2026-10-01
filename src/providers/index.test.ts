import { describe, expect, it } from "vitest";
import {
  UnconfiguredActionProvider,
  UnconfiguredBusinessDataProvider,
  UnconfiguredModelProvider,
  UnconfiguredResearchProvider,
} from "./unconfigured";

describe("provider contracts", () => {
  it("report unconfigured model providers without pretending availability", async () => {
    const provider = new UnconfiguredModelProvider();
    const health = await provider.health();
    expect(health.availability).toBe("unavailable");
    await expect(provider.generate({ prompt: "test" })).rejects.toThrow("No production AI model provider is configured.");
  });

  it("report unconfigured research providers without pretending availability", async () => {
    const provider = new UnconfiguredResearchProvider();
    expect((await provider.health()).availability).toBe("unavailable");
  });

  it("report unconfigured business-data providers without pretending availability", async () => {
    const provider = new UnconfiguredBusinessDataProvider();
    expect((await provider.health()).availability).toBe("unavailable");
  });

  it("report unconfigured action providers without pretending availability", async () => {
    const provider = new UnconfiguredActionProvider();
    expect((await provider.health()).availability).toBe("unavailable");
  });
});
