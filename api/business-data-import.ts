import { parseCsv } from "../src/business-data/csv.js";
import { importRows, inferImportMapping } from "../src/business-data/import.js";
import type { BusinessDomain, NormalizedRecord } from "../src/business-data";
import { getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const tableByDomain: Record<BusinessDomain, string> = {
  customers: "business_customers", sales: "business_sales", money: "business_money", expenses: "business_money",
  products: "business_products", inventory: "business_inventory", operations: "business_operations",
  projects: "business_projects", marketing: "business_marketing", suppliers: "business_suppliers", people: "business_people",
};

function uuid(value: string | undefined): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function persistRecord(record: NormalizedRecord, businessId: string, source: string, importId: string): Record<string, unknown> {
  const metadata = { imported: true, importId, source, normalizedRecordId: record.id };
  const base = { id: crypto.randomUUID(), business_id: businessId, external_id: record.id, source, metadata };
  switch (record.type) {
    case "customer": return { ...base, name: record.name, email: record.email ?? null, phone: record.phone ?? null, status: record.status ?? null, observed_at: record.observedAt };
    case "sale": return { ...base, occurred_at: record.occurredAt, amount: record.amount, currency: record.currency, customer_id: uuid(record.customerId), product_id: uuid(record.productId), quantity: record.quantity ?? null, status: record.status ?? null };
    case "money": return { ...base, occurred_at: record.occurredAt, type: record.typeName, amount: record.amount, currency: record.currency, category: record.category ?? null };
    case "product": return { ...base, name: record.name, sku: record.sku ?? null, category: record.category ?? null, price: record.price ?? null, currency: record.currency ?? null, status: record.status ?? null };
    case "inventory": return { ...base, product_id: uuid(record.productId), location: record.location ?? null, quantity: record.quantity, occurred_at: record.occurredAt };
    case "supplier": return { ...base, name: record.name, status: record.status ?? null };
    case "operation": return { ...base, operation_type: record.operationType, status: record.status ?? null, occurred_at: record.occurredAt };
    case "project": return { ...base, name: record.name, status: record.status ?? null, start_at: record.startAt ?? null, end_at: record.endAt ?? null };
    case "marketing": return { ...base, channel: record.channel, campaign: record.campaign ?? null, metric: record.metric, value: record.value, occurred_at: record.occurredAt };
    case "person": return { ...base, name: record.name, role: record.role ?? null, status: record.status ?? null };
  }
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
    if (!Object.prototype.hasOwnProperty.call(tableByDomain, body.domain)) return json({ error: "Unsupported business domain.", requestId }, 400);
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

    const importId = crypto.randomUUID();
    const records = imported.records.map((record) => persistRecord(record, body.businessId!, source, importId));
    const { error } = await authentication.supabase.from(tableByDomain[body.domain]).insert(records);
    if (error) return json({ error: "Business data import failed.", requestId, detail: error.message }, 500);

    return json({ requestId, importId, domain: body.domain, imported: records.length, rejected: 0, truncated: rows.length > 5000, mappedFields: imported.mappedFields });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Business data import failed.", requestId }, 500);
  }
}
