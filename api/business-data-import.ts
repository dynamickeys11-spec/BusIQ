import { parseCsv } from "../src/business-data/csv.js";
import { importRows, inferImportMapping } from "../src/business-data/import.js";
import type { BusinessDomain } from "../src/business-data";
import { persistNormalizedImport } from "../src/business-data/persistence.js";
import { getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export default async function handler(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") return json({ error: "Method not allowed", requestId }, 405);
  const authentication = await getAuthenticatedUser(request);
  if (!authentication.user || !authentication.supabase) return json({ error: "Authentication required.", requestId }, 401);
  if (authentication.isAnonymous) return json({ error: "Create an account before importing business data.", requestId }, 403);

  try {
    const body = await request.json() as { businessId?: string; domain?: BusinessDomain; csv?: string; source?: string; mapping?: Record<string, string> };
    if (!body.businessId || !body.domain || !body.csv) return json({ error: "businessId, domain and csv are required.", requestId }, 400);
    if (!["customers","sales","money","expenses","products","inventory","suppliers","operations","projects","marketing","people"].includes(body.domain)) return json({ error: "Unsupported business domain.", requestId }, 400);
    if (body.csv.length > 2_000_000) return json({ error: "CSV exceeds the 2MB synchronous import limit.", requestId }, 413);

    const scope = await getAuthorizedBusinessIds(authentication.supabase, authentication.user.id);
    if (scope.error) return json({ error: scope.error, requestId }, 500);
    if (!scope.businessIds.includes(body.businessId)) return json({ error: "You do not have access to this business.", requestId }, 403);

    const rows = parseCsv(body.csv);
    if (!rows.length) return json({ error: "CSV contains no data rows.", requestId }, 400);
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const inferred = inferImportMapping(headers, body.domain);
    const mapping = { domain: body.domain, columns: body.mapping ?? inferred.columns };
    const source = body.source?.trim().slice(0, 200) || "CSV import";
    const imported = importRows(rows.slice(0, 5000), mapping, source);

    if (imported.issues.length) return json({ error: "Import validation failed.", requestId, domain: body.domain, issues: imported.issues.slice(0, 100), validRows: imported.records.length, rejectedRows: imported.issues.length, truncated: rows.length > 5000 }, 422);
    if (!imported.records.length) return json({ error: "CSV contains no valid records.", requestId }, 422);

    const persisted = await persistNormalizedImport(authentication.supabase, body.businessId, body.domain, imported.records);
    return json({ requestId, importId: persisted.importBatchId, domain: body.domain, imported: persisted.inserted, rejected: 0, truncated: rows.length > 5000, mappedFields: imported.mappedFields });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Business data import failed.", requestId }, 500);
  }
}
