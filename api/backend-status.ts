import type { BackendStatus } from "../src/backend";

export default function handler(request: Request): Response {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "GET" },
    });
  }

  const status: BackendStatus = {
    capabilities: [
      { resource: "database", readiness: "available", provider: "Supabase Postgres", note: "Durable business, work, library, context and intelligence-run persistence is connected." },
      { resource: "auth", readiness: "available", provider: "Supabase Auth", note: "Authenticated sessions and server-side JWT verification are connected." },
      { resource: "business-data", readiness: "not-configured", note: "No external live business-data connector is connected yet." },
      { resource: "audit-log", readiness: "configured", provider: "Supabase Postgres", note: "Action audit logic exists, but durable action-event storage and execution are not yet connected." },
    ],
  };

  return new Response(JSON.stringify({ service: "BUSIQ backend", status }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
