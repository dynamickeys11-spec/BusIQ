import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleModelProvider, createOllamaModelProvider } from "./openai-compatible";

describe("OpenAI-compatible model provider", () => {
  it("maps a successful chat completion into BUSIQ's model contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Use contribution margin to compare the products." } }],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    }), { status: 200 })));

    const provider = new OpenAICompatibleModelProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      model: "free-model",
      provider: "test-provider",
    });

    const result = await provider.generate({
      prompt: "Compare two products.",
      system: "Be evidence-aware.",
      temperature: 0,
      maxOutputTokens: 100,
    });

    expect(result.text).toContain("contribution margin");
    expect(result.provider).toBe("test-provider");
    expect(result.model).toBe("free-model");
    expect(result.usage?.totalTokens).toBe(18);
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer test-key" }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("provides an Ollama configuration without requiring an API key", async () => {
    const provider = createOllamaModelProvider("local-model");
    const health = await provider.health();
    expect(health.provider).toBe("ollama");
    expect(health.availability).toBe("available");
  });

  it("surfaces upstream failures instead of pretending generation succeeded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream unavailable", { status: 503 })));
    const provider = new OpenAICompatibleModelProvider({
      baseUrl: "https://example.test/v1",
      model: "free-model",
      provider: "test-provider",
    });
    await expect(provider.generate({ prompt: "test" })).rejects.toThrow("503");
    vi.unstubAllGlobals();
  });
});
