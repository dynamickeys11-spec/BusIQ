import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const model = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json" } });
  const { input } = await req.json().catch(() => ({ input: null }));
  if (typeof input !== "string" || !input.trim() || input.length > 12000) return new Response(JSON.stringify({ error: "A non-empty input string up to 12000 characters is required." }), { status: 400, headers: { "content-type": "application/json" } });
  const embedding = await model.run(input.trim(), { mean_pool: true, normalize: true });
  return new Response(JSON.stringify({ embedding }), { headers: { "content-type": "application/json" } });
});
