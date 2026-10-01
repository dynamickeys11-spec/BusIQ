import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessDomain, NormalizedRecord } from "./types.js";

const tableByDomain: Record<BusinessDomain, string> = {
  customers: "business_customers", sales: "business_sales", money: "business_money", expenses: "business_money",
  products: "business_products", inventory: "business_inventory", operations: "business_operations",
  projects: "business_projects", marketing: "business_marketing", suppliers: "business_suppliers", people: "business_people",
};
const fieldsByDomain: Record<BusinessDomain, string> = {
  customers: "id,name,email,phone,status,source,observed_at", sales: "id,occurred_at,amount,currency,quantity,status,source",
  money: "id,occurred_at,type,amount,currency,category,source", expenses: "id,occurred_at,type,amount,currency,category,source",
  products: "id,name,sku,category,price,currency,status,source", inventory: "id,product_id,location,quantity,occurred_at,source",
  operations: "id,operation_type,status,occurred_at,source", projects: "id,name,status,start_at,end_at,source",
  marketing: "id,channel,campaign,metric,value,occurred_at,source", suppliers: "id,name,status,source", people: "id,name,role,status,source",
};

export type RetrievedBusinessEvidence = { id: string; domain: BusinessDomain; detail: string; source: string; record?: NormalizedRecord };
const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;
const asNumber = (value: unknown): number | undefined => typeof value === "number" ? value : undefined;

function normalizeRecord(domain: BusinessDomain, row: Record<string, unknown>): NormalizedRecord | undefined {
  const id = asString(row.id); if (!id) return undefined;
  const source = asString(row.source) ?? "BUSIQ normalized business data";
  switch (domain) {
    case "customers": return { type:"customer", id, name:asString(row.name)??id, email:asString(row.email), phone:asString(row.phone), status:asString(row.status), source, observedAt:asString(row.observed_at)??new Date().toISOString() };
    case "sales": return { type:"sale", id, occurredAt:asString(row.occurred_at)??new Date().toISOString(), amount:asNumber(row.amount)??0, currency:asString(row.currency)??"unknown", quantity:asNumber(row.quantity), status:asString(row.status), source };
    case "money":
    case "expenses": { const t=asString(row.type); const typeName=t==="income"||t==="expense"||t==="transfer"||t==="refund"?t:"unknown"; return { type:"money", id, occurredAt:asString(row.occurred_at)??new Date().toISOString(), typeName, amount:asNumber(row.amount)??0, currency:asString(row.currency)??"unknown", category:asString(row.category), source }; }
    case "products": return { type:"product", id, name:asString(row.name)??id, sku:asString(row.sku), category:asString(row.category), price:asNumber(row.price), currency:asString(row.currency), status:asString(row.status), source };
    case "inventory": return { type:"inventory", id, productId:asString(row.product_id)??"unknown", location:asString(row.location), quantity:asNumber(row.quantity)??0, occurredAt:asString(row.occurred_at)??new Date().toISOString(), source };
    case "suppliers": return { type:"supplier", id, name:asString(row.name)??id, status:asString(row.status), source };
    case "operations": return { type:"operation", id, operationType:asString(row.operation_type)??"unknown", status:asString(row.status), occurredAt:asString(row.occurred_at)??new Date().toISOString(), source };
    case "projects": return { type:"project", id, name:asString(row.name)??id, status:asString(row.status), startAt:asString(row.start_at), endAt:asString(row.end_at), source };
    case "marketing": return { type:"marketing", id, channel:asString(row.channel)??"unknown", campaign:asString(row.campaign), metric:asString(row.metric)??"unknown", value:asNumber(row.value)??0, occurredAt:asString(row.occurred_at)??new Date().toISOString(), source };
    case "people": return { type:"person", id, name:asString(row.name)??id, role:asString(row.role), status:asString(row.status), source };
  }
}

export async function retrieveBusinessEvidence(supabase: SupabaseClient, businessId: string, domain: BusinessDomain, limit = 20): Promise<RetrievedBusinessEvidence[]> {
  const table = tableByDomain[domain]; if (!table) return [];
  const { data, error } = await supabase.from(table).select(fieldsByDomain[domain]).eq("business_id", businessId).order("created_at", { ascending:false }).limit(Math.min(Math.max(limit,1),50));
  if (error) throw new Error("Business data retrieval failed: " + error.message);
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return rows.map((row,index)=>({ id:"business-"+domain+"-"+index+"-"+String(row.id), domain, detail:JSON.stringify(row), source:"BUSIQ normalized "+domain+" data", record:normalizeRecord(domain,row) }));
}
