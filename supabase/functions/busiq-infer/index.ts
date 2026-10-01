import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const modelName = Deno.env.get("BUSIQ_MODEL_NAME") ?? "mistral";
const session = new Supabase.ai.Session(modelName);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  try {
    const body = await req.json() as {
      prompt?: string;
      system?: string;
    };
    const prompt = body.prompt?.trim();
    if (!prompt || prompt.length > 20_000) {
      return Response.json({ error: "A prompt between 1 and 20000 characters is required." }, { status: 400 });
    }

    const fullPrompt = [
      body.system?.trim() ? "SYSTEM:\n" + body.system.trim() : "",
      "USER:\n" + prompt,
    ].filter(Boolean).join("\n\n");

    const output = await session.run(fullPrompt, { stream: false, timeout: 30 });
    const text = typeof output === "string"
      ? output
      : typeof output?.response === "string"
        ? output.response
        : "";

    if (!text.trim()) return Response.json({ error: "Model returned no text." }, { status: 502 });

    return Response.json({ text: text.trim(), model: modelName, provider: "supabase-ai-ollama" });
  } catch (error) {
    console.error("BUSIQ inference failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Model inference failed." }, { status: 502 });
  }
});