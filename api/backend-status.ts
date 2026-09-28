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
      { resource: "database", readiness: "not-configured", note: "No persistent database is connected yet." },
      { resource: "auth", readiness: "not-configured", note: "No production identity provider is connected yet." },
      { resource: "business-data", readiness: "not-configured", note: "No live business-data connector is connected yet." },
      { resource: "audit-log", readiness: "not-configured", note: "Audit events are not durably persisted yet." },
    ],
  };

  return new Response(JSON.stringify({ service: "BUSIQ backend", status }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
