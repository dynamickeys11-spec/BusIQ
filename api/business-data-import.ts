import { dateValue, numberValue, parseCsv } from "../src/business-data/csv";
import type { BusinessDomain } from "../src/business-data";
import { getAuthenticatedUser, getAuthorizedBusinessIds } from "./auth";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const tableByDomain: Record<BusinessDomain, string> = {
  customers: "business_customers",
  sales: "business_sales",
  money: "business_money",
  expenses: "business_money",
  products: "business_products",
  inventory: "business_inventory",
  operations: "business_operations",
  projects: "business_projects",
  marketing: "business_marketing",
  suppliers: "business_suppliers",
  people: "business_people",
};

function mapRow(domain: BusinessDomain, row: Record<string, string>, businessId: string, source: string): Record<string, unknown> {
  const metadata = { imported: true, sourceRow: row };
  if (domain === "customers") return { business_id: businessId, external_id: row.external_id || row.id || null, name: row.name || row.customer_name || "Unnamed customer", email: row.email || null, phone: row.phone || null, status: row.status || null, source, observed_at: dateValue(row.observed_at || row.updated_at), metadata };
  if (domain === "products") return { business_id: businessId, external_id: row.external_id || row.id || row.sku || null, name: row.name || row.product_name || "Unnamed product", sku: row.sku || null, category: row.category || null, price: numberValue(row.price), currency: row.currency || null, status: row.status || null, source, metadata };
  if (domain === "sales") return { business_id: businessId, external_id: row.external_id || row.id || null, occurred_at: dateValue(row.occurred_at || row.date || row.created_at), amount: numberValue(row.amount || row.total || row.revenue) ?? 0, currency: row.currency || "NGN", customer_id: null, product_id: null, quantity: numberValue(row.quantity), status: row.status || null, source, metadata };
  if (domain === "money") return { business_id: businessId, external_id: row.external_id || row.id || null, occurred_at: dateValue(row.occurred_at || row.date || row.created_at), type: /expense/i.test(row.type || row.category || "") ? "expense" : /refund/i.test(row.type || "") ? "refund" : /transfer/i.test(row.type || "") ? "transfer" : "income", amount: numberValue(row.amount || row.value) ?? 0, currency: row.currency || "NGN", category: row.category || null, source, metadata };
  if (domain === "inventory") return { business_id: businessId, external_id: row.external_id || row.id || null, product_id: row.product_id || crypto.randomUUID(), location: row.location || null, quantity: numberValue(row.quantity || row.stock) ?? 0, occurred_at: dateValue(row.occurred_at || row.date || row.updated_at), source, metadata };
  if (domain === "suppliers") return { business_id: businessId, external_id: row.external_id || row.id || null, name: row.name || row.supplier_name || "Unnamed supplier", status: row.status || null, source, metadata };
  if (domain === "operations") return { business_id: businessId, external_id: row.external_id || row.id || null, operation_type: row.operation_type || row.type || "operation", status: row.status || null, occurred_at: dateValue(row.occurred_at || row.date || row.updated_at), source, metadata };
  if (domain === "projects") return { business_id: businessId, external_id: row.external_id || row.id || null, name: row.name || row.project_name || "Unnamed project", status: row.status || null, start_at: row.start_at ? dateValue(row.start_at) : null, end_at: row.end_at ? dateValue(row.end_at) : null, source, metadata };
  if (domain === "marketing") return { business_id: businessId, external_id: row.external_id || row.id || null, channel: row.channel || "unknown", campaign: row.campaign || null, metric: row.metric || "value", value: numberValue(row.value || row.amount) ?? 0, occurred_at: dateValue(row.occurred_at || row.date || row.created_at), source, metadata };
  return { business_id: businessId, external_id: row.external_id || row.id || null, name: row.name || row.person_name || "Unnamed person", role: row.role || null, status: row.status || null, source, metadata };
}

export default async function handler(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") return json({ error: "Method not allowed", requestId }, 405);

  const authentication = await getAuthenticatedUser(request);
  if (!authentication.user || !authentication.supabase) return json({ error: "Authentication required.", requestId }, 401);
  if (authentication.isAnonymous) return json({ error: "Create an account before importing business data.", requestId }, 403);

  try {
    const body = await request.json() as { businessId?: string; domain?: BusinessDomain; csv?: string; source?: string };
    if (!body.businessId || !body.domain || !body.csv) return json({ error: "businessId, domain and csv are required.", requestId }, 400);
    if (!Object.prototype.hasOwnProperty.call(tableByDomain, body.domain)) return json({ error: "Unsupported business domain.", requestId }, 400);
    if (body.csv.length > 2_000_000) return json({ error: "CSV exceeds the 2MB synchronous import limit.", requestId }, 413);

    const scope = await getAuthorizedBusinessIds(authentication.supabase, authentication.user.id);
    if (scope.error) return json({ error: scope.error, requestId }, 500);
    if (!scope.businessIds.includes(body.businessId)) return json({ error: "You do not have access to this business.", requestId }, 403);

    const rows = parseCsv(body.csv);
    if (!rows.length) return json({ error: "CSV contains no data rows.", requestId }, 400);

    const records = rows.slice(0, 5000).map((row) => mapRow(body.domain!, row, body.businessId!, body.source?.slice(0, 200) || "CSV import"));
    const { error } = await authentication.supabase.from(tableByDomain[body.domain]).insert(records);
    if (error) return json({ error: "Business data import failed: " + error.message, requestId }, 500);

    return json({ requestId, domain: body.domain, imported: records.length, truncated: rows.length > records.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Business data import failed.", requestId }, 500);
  }
}
