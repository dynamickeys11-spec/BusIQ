import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessDomain, NormalizedRecord } from "./types.js";

export type PersistedImport = {
  importBatchId: string;
  domain: BusinessDomain;
  inserted: number;
  records: Array<{ id: string; externalId?: string }>;
};

const tables: Record<BusinessDomain, string> = {
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

const isUuid = (value?: string): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function baseRow(businessId: string, record: NormalizedRecord, importBatchId: string) {
  return {
    id: crypto.randomUUID(),
    business_id: businessId,
    external_id: record.externalId ?? null,
    source: record.source,
    metadata: {
      ...(record.metadata ?? {}),
      importBatchId,
      normalizedRecordId: record.id,
      importedAt: new Date().toISOString(),
    },
  };
}

export function toPersistenceRow(
  businessId: string,
  domain: BusinessDomain,
  record: NormalizedRecord,
  importBatchId: string,
): Record<string, unknown> {
  const row = baseRow(businessId, record, importBatchId);

  switch (domain) {
    case "customers":
      if (record.type !== "customer") throw new Error("Record/domain mismatch.");
      return { ...row, name: record.name, email: record.email ?? null, phone: record.phone ?? null, status: record.status ?? null, observed_at: record.observedAt };
    case "sales":
      if (record.type !== "sale") throw new Error("Record/domain mismatch.");
      return {
        ...row,
        occurred_at: record.occurredAt,
        amount: record.amount,
        currency: record.currency,
        customer_id: isUuid(record.customerId) ? record.customerId : null,
        product_id: isUuid(record.productId) ? record.productId : null,
        quantity: record.quantity ?? null,
        status: record.status ?? null,
      };
    case "money":
    case "expenses":
      if (record.type !== "money") throw new Error("Record/domain mismatch.");
      return { ...row, occurred_at: record.occurredAt, type: record.typeName, amount: record.amount, currency: record.currency, category: record.category ?? null };
    case "products":
      if (record.type !== "product") throw new Error("Record/domain mismatch.");
      return { ...row, name: record.name, sku: record.sku ?? null, category: record.category ?? null, price: record.price ?? null, currency: record.currency ?? null, status: record.status ?? null };
    case "inventory":
      if (record.type !== "inventory") throw new Error("Record/domain mismatch.");
      return { ...row, product_id: isUuid(record.productId) ? record.productId : null, location: record.location ?? null, quantity: record.quantity, occurred_at: record.occurredAt };
    case "suppliers":
      if (record.type !== "supplier") throw new Error("Record/domain mismatch.");
      return { ...row, name: record.name, status: record.status ?? null };
    case "operations":
      if (record.type !== "operation") throw new Error("Record/domain mismatch.");
      return { ...row, operation_type: record.operationType, status: record.status ?? null, occurred_at: record.occurredAt };
    case "projects":
      if (record.type !== "project") throw new Error("Record/domain mismatch.");
      return { ...row, name: record.name, status: record.status ?? null, start_at: record.startAt ?? null, end_at: record.endAt ?? null };
    case "marketing":
      if (record.type !== "marketing") throw new Error("Record/domain mismatch.");
      return { ...row, channel: record.channel, campaign: record.campaign ?? null, metric: record.metric, value: record.value, occurred_at: record.occurredAt };
    case "people":
      if (record.type !== "person") throw new Error("Record/domain mismatch.");
      return { ...row, name: record.name, role: record.role ?? null, status: record.status ?? null };
  }
}

async function resolveRelationId(
  supabase: SupabaseClient,
  businessId: string,
  table: "business_customers" | "business_products",
  value?: string,
): Promise<string | null> {
  if (!value?.trim()) return null;
  if (isUuid(value)) return value;
  const external = await supabase.from(table).select("id").eq("business_id", businessId).eq("external_id", value).limit(1).maybeSingle();
  if (!external.error && external.data?.id) return String(external.data.id);
  const name = await supabase.from(table).select("id").eq("business_id", businessId).eq("name", value).limit(1).maybeSingle();
  if (!name.error && name.data?.id) return String(name.data.id);
  return null;
}

export async function persistNormalizedImport(
  supabase: SupabaseClient,
  businessId: string,
  domain: BusinessDomain,
  records: NormalizedRecord[],
  importBatchId = crypto.randomUUID(),
): Promise<PersistedImport> {
  if (!businessId) throw new Error("businessId is required.");
  if (!records.length) return { importBatchId, domain, inserted: 0, records: [] };

  const table = tables[domain];
  const rows = [] as Record<string, unknown>[];
  for (const record of records) {
    const row = toPersistenceRow(businessId, domain, record, importBatchId);
    if (record.type === "sale") {
      row.customer_id = await resolveRelationId(supabase, businessId, "business_customers", record.customerId);
      row.product_id = await resolveRelationId(supabase, businessId, "business_products", record.productId);
    }
    if (record.type === "inventory") {
      row.product_id = await resolveRelationId(supabase, businessId, "business_products", record.productId);
    }
    rows.push(row);
  }
  const { data, error } = await supabase.from(table).insert(rows).select("id,external_id");
  if (error) throw new Error("Business import persistence failed: " + error.message);

  return {
    importBatchId,
    domain,
    inserted: data?.length ?? 0,
    records: (data ?? []).map((row) => ({ id: String(row.id), externalId: typeof row.external_id === "string" ? row.external_id : undefined })),
  };
}
