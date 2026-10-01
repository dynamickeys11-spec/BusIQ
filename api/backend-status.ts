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
      { resource: "database", readiness: "available", provider: "Supabase Postgres", note: "Durable business, work, library, context, intelligence history, knowledge and normalized business-data contracts are defined; latest domain migration still requires live verification." },
      { resource: "auth", readiness: "available", provider: "Supabase Auth", note: "Permanent and anonymous sessions are supported; permanent accounts unlock business persistence." },
      { resource: "business-data", readiness: "configured", provider: "BUSIQ normalized data + CSV import", note: "Normalized customer, sales, money, product, inventory, supplier, people, operations, project and marketing contracts are present; OAuth/live connectors remain unconfigured." },
      { resource: "audit-log", readiness: "configured", provider: "Supabase Postgres", note: "Durable action-event schema and server-only audit boundary exist; execution remains disabled until the secret key and action provider are configured." },
    ],
  };

  return new Response(JSON.stringify({ service: "BUSIQ backend", status }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
