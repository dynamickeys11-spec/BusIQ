import type { ModelProvider, ModelRequest, ModelResponse, ProviderHealth } from "./types.js";

export type OpenAICompatibleConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  provider: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export class OpenAICompatibleModelProvider implements ModelProvider {
  constructor(private readonly config: OpenAICompatibleConfig) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch(this.config.baseUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.config.apiKey ? { authorization: "Bearer " + this.config.apiKey } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          ...(request.system ? [{ role: "system", content: request.system }] : []),
          { role: "user", content: request.prompt },
        ],
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        ...(request.maxOutputTokens === undefined ? {} : { max_tokens: request.maxOutputTokens }),
        ...(request.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error("Model provider request failed (" + response.status + "): " + detail.slice(0, 300));
    }

    const payload = await response.json() as ChatCompletionResponse;
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Model provider returned no text.");

    return {
      text,
      provider: this.config.provider,
      model: this.config.model,
      usage: payload.usage
        ? {
            inputTokens: payload.usage.prompt_tokens,
            outputTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
    };
  }

  async health(): Promise<ProviderHealth> {
    return {
      availability: "available",
      provider: this.config.provider,
      checkedAt: new Date().toISOString(),
      detail: "Configured model: " + this.config.model,
    };
  }
}

export function createOllamaModelProvider(
  model: string,
  baseUrl = "http://localhost:11434/v1",
): OpenAICompatibleModelProvider {
  return new OpenAICompatibleModelProvider({
    baseUrl,
    model,
    provider: "ollama",
  });
}

export function createGroqModelProvider(
  model = "openai/gpt-oss-120b",
  apiKey: string,
  baseUrl = "https://api.groq.com/openai/v1",
): OpenAICompatibleModelProvider {
  if (!apiKey.trim()) throw new Error("Groq API key is required.");
  return new OpenAICompatibleModelProvider({
    baseUrl,
    apiKey,
    model,
    provider: "groq",
  });
}
