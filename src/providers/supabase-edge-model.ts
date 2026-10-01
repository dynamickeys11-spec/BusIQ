import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelProvider, ModelRequest, ModelResponse, ProviderHealth } from "./types.js";

export class SupabaseEdgeModelProvider implements ModelProvider {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly model = "mistral",
  ) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const { data, error } = await this.supabase.functions.invoke("busiq-infer", {
      body: {
        prompt: request.prompt,
        system: request.system,
      },
    });

    if (error || !data?.text) {
      throw new Error(error?.message || "BUSIQ local inference function returned no text.");
    }

    return {
      text: String(data.text),
      provider: "supabase-ai-ollama",
      model: String(data.model ?? this.model),
    };
  }

  async health(): Promise<ProviderHealth> {
    return {
      availability: "available",
      provider: "supabase-ai-ollama",
      checkedAt: new Date().toISOString(),
      detail: "Supabase Edge Function backed by Ollama-compatible local/self-hosted inference.",
    };
  }
}
