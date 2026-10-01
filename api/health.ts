export default function handler(request: Request): Response {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "GET" },
    });
  }

  const requestId = crypto.randomUUID();
  console.info(JSON.stringify({ event: "api.health", requestId }));
  return new Response(JSON.stringify({
    ok: true,
    service: "BUSIQ backend",
    version: "foundation",
    requestId,
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
