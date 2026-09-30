import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessDomain } from "./types";

const tableByDomain: Record<BusinessDomain, string> = {
  customers: "business_customers",
  sales: "business_sales",
  money: "business_money",
  products: "business_products",
  inventory: "business_inventory",
  operations: "business_operations",
  projects: "business_projects",
  marketing: "business_marketing",
  suppliers: "business_suppliers",
  people: "business_people",
};

const fieldsByDomain: Record<BusinessDomain, string> = {
  customers: "id,name,email,phone,status,source,observed_at",
  sales: "id,occurred_at,amount,currency,quantity,status,source",
  money: "id,occurred_at,type,amount,currency,category,source",
  products: "id,name,sku,category,price,currency,status,source",
  inventory: "id,product_id,location,quantity,occurred_at,source",
  operations: "id,operation_type,status,occurred_at,source",
  projects: "id,name,status,start_at,end_at,source",
  marketing: "id,channel,campaign,metric,value,occurred_at,source",
  suppliers: "id,name,status,source",
  people: "id,name,role,status,source",
};

export type RetrievedBusinessEvidence = {
  id: string;
  domain: BusinessDomain;
  detail: string;
  source: string;
};

export async function retrieveBusinessEvidence(
  supabase: SupabaseClient,
  businessId: string,
  domain: BusinessDomain,
  limit = 20,
): Promise<RetrievedBusinessEvidence[]> {
  const table = tableByDomain[domain];
  if (!table) return [];

  const { data, error } = await supabase
    .from(table)
    .select(fieldsByDomain[domain])
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) throw new Error("Business data retrieval failed: " + error.message);

  return (data ?? []).map((row: Record<string, unknown>, index) => ({
    id: "business-" + domain + "-" + index + "-" + String(row.id),
    domain,
    detail: JSON.stringify(row),
    source: "BUSIQ normalized " + domain + " data",
  }));
}
