import type { BusinessDomain, NormalizedRecord } from "./types.js";

export type ImportRow = Record<string, string>;

export type ImportMapping = {
  domain: BusinessDomain;
  columns: Record<string, string>;
};

export type ImportIssue = {
  row: number;
  field?: string;
  message: string;
};

export type ImportResult = {
  domain: BusinessDomain;
  records: NormalizedRecord[];
  issues: ImportIssue[];
  headers: string[];
  mappedFields: string[];
};

const aliases: Record<BusinessDomain, Record<string, string[]>> = {
  customers: { name: ["name","customer","customer_name"], email: ["email","email_address"], phone: ["phone","phone_number"], status: ["status","customer_status"], observedAt: ["observed_at","date","created_at"] },
  sales: { occurredAt: ["occurred_at","date","sale_date","transaction_date"], amount: ["amount","revenue","sales","total","total_amount"], currency: ["currency","currency_code"], customerId: ["customer_id","customer"], productId: ["product_id","product"], quantity: ["quantity","qty"], status: ["status","sale_status"] },
  money: { occurredAt: ["occurred_at","date","transaction_date"], typeName: ["type","transaction_type"], amount: ["amount","value","total"], currency: ["currency","currency_code"], category: ["category","type_category"] },
  expenses: { occurredAt: ["occurred_at","date","expense_date"], typeName: ["type","expense_type"], amount: ["amount","expense","value","total"], currency: ["currency","currency_code"], category: ["category","expense_category"] },
  products: { name: ["name","product","product_name"], sku: ["sku","product_sku"], category: ["category","product_category"], price: ["price","unit_price"], currency: ["currency","currency_code"], status: ["status","product_status"] },
  inventory: { productId: ["product_id","product","sku"], location: ["location","warehouse","store"], quantity: ["quantity","qty","stock"], occurredAt: ["occurred_at","date","updated_at"] },
  suppliers: { name: ["name","supplier","supplier_name"], status: ["status","supplier_status"] },
  operations: { operationType: ["operation_type","operation","type"], status: ["status","operation_status"], occurredAt: ["occurred_at","date","operation_date"] },
  projects: { name: ["name","project","project_name"], status: ["status","project_status"], startAt: ["start_at","start_date"], endAt: ["end_at","end_date"] },
  marketing: { channel: ["channel","source"], campaign: ["campaign","campaign_name"], metric: ["metric","metric_name"], value: ["value","amount","metric_value"], occurredAt: ["occurred_at","date","campaign_date"] },
  people: { name: ["name","person","employee","employee_name"], role: ["role","job_title"], status: ["status","employee_status"] },
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function findColumn(headers: string[], candidates: string[]): string | undefined {
  const normalized = new Map(headers.map(header => [normalizeHeader(header), header]));
  for (const candidate of candidates) {
    const exact = normalized.get(candidate);
    if (exact) return exact;
  }
  return undefined;
}

function numberValue(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const cleaned = value.replace(/[$,₦€£]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function required(result: ImportResult, row: number, field: string, value: string | undefined): string | undefined {
  if (!value?.trim()) {
    result.issues.push({ row, field, message: `Missing required field: ${field}` });
    return undefined;
  }
  return value.trim();
}

function value(row: ImportRow, columns: Record<string, string>, field: string): string | undefined {
  const column = columns[field];
  return column ? row[column] : undefined;
}

export function inferImportMapping(headers: string[], domain: BusinessDomain): ImportMapping {
  const columns: Record<string, string> = {};
  for (const [field, candidates] of Object.entries(aliases[domain])) {
    const column = findColumn(headers, candidates);
    if (column) columns[field] = column;
  }
  return { domain, columns };
}

export function importRows(
  rows: ImportRow[],
  mapping: ImportMapping,
  source = "user-import",
): ImportResult {
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const result: ImportResult = {
    domain: mapping.domain,
    records: [],
    issues: [],
    headers,
    mappedFields: Object.keys(mapping.columns),
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const id = row.id?.trim() || `${mapping.domain}-import-${index + 1}`;

    if (mapping.domain === "customers") {
      const name = required(result, rowNumber, "name", value(row, mapping.columns, "name"));
      if (!name) return;
      result.records.push({ type: "customer", id, name, email: value(row,mapping.columns,"email")?.trim() || undefined, phone: value(row,mapping.columns,"phone")?.trim() || undefined, status: value(row,mapping.columns,"status")?.trim() || undefined, source, observedAt: value(row,mapping.columns,"observedAt")?.trim() || new Date(0).toISOString() });
      return;
    }

    if (mapping.domain === "sales" || mapping.domain === "money" || mapping.domain === "expenses") {
      const occurredAt = required(result, rowNumber, "occurredAt", value(row,mapping.columns,"occurredAt"));
      const amountRaw = value(row,mapping.columns,"amount");
      const amount = numberValue(amountRaw);
      if (!occurredAt || amount === undefined) {
        if (amount === undefined) result.issues.push({ row: rowNumber, field: "amount", message: "Amount must be a number." });
        return;
      }
      if (mapping.domain === "sales") {
        result.records.push({ type:"sale", id, occurredAt, amount, currency:value(row,mapping.columns,"currency")?.trim() || "unknown", customerId:value(row,mapping.columns,"customerId")?.trim() || undefined, productId:value(row,mapping.columns,"productId")?.trim() || undefined, quantity:numberValue(value(row,mapping.columns,"quantity")), status:value(row,mapping.columns,"status")?.trim() || undefined, source });
      } else {
        const rawType = value(row,mapping.columns,"typeName")?.trim().toLowerCase();
        const typeName = rawType === "income" || rawType === "expense" || rawType === "transfer" || rawType === "refund" ? rawType : "unknown";
        result.records.push({ type:"money", id, occurredAt, typeName, amount, currency:value(row,mapping.columns,"currency")?.trim() || "unknown", category:value(row,mapping.columns,"category")?.trim() || undefined, source });
      }
      return;
    }

    if (mapping.domain === "products") {
      const name = required(result,rowNumber,"name",value(row,mapping.columns,"name"));
      if (!name) return;
      result.records.push({ type:"product", id, name, sku:value(row,mapping.columns,"sku")?.trim() || undefined, category:value(row,mapping.columns,"category")?.trim() || undefined, price:numberValue(value(row,mapping.columns,"price")), currency:value(row,mapping.columns,"currency")?.trim() || undefined, status:value(row,mapping.columns,"status")?.trim() || undefined, source });
      return;
    }

    if (mapping.domain === "inventory") {
      const productId = required(result,rowNumber,"productId",value(row,mapping.columns,"productId"));
      const occurredAt = required(result,rowNumber,"occurredAt",value(row,mapping.columns,"occurredAt"));
      const quantity = numberValue(value(row,mapping.columns,"quantity"));
      if (!productId || !occurredAt || quantity === undefined) {
        if (quantity === undefined) result.issues.push({ row: rowNumber, field:"quantity", message:"Quantity must be a number." });
        return;
      }
      result.records.push({ type:"inventory",id,productId,location:value(row,mapping.columns,"location")?.trim() || undefined,quantity,occurredAt,source });
      return;
    }

    if (mapping.domain === "suppliers" || mapping.domain === "people" || mapping.domain === "projects") {
      const name = required(result,rowNumber,"name",value(row,mapping.columns,"name"));
      if (!name) return;
      if (mapping.domain === "suppliers") result.records.push({type:"supplier",id,name,status:value(row,mapping.columns,"status")?.trim() || undefined,source});
      if (mapping.domain === "people") result.records.push({type:"person",id,name,role:value(row,mapping.columns,"role")?.trim() || undefined,status:value(row,mapping.columns,"status")?.trim() || undefined,source});
      if (mapping.domain === "projects") result.records.push({type:"project",id,name,status:value(row,mapping.columns,"status")?.trim() || undefined,startAt:value(row,mapping.columns,"startAt")?.trim() || undefined,endAt:value(row,mapping.columns,"endAt")?.trim() || undefined,source});
      return;
    }

    if (mapping.domain === "operations") {
      const operationType = required(result,rowNumber,"operationType",value(row,mapping.columns,"operationType"));
      const occurredAt = required(result,rowNumber,"occurredAt",value(row,mapping.columns,"occurredAt"));
      if (!operationType || !occurredAt) return;
      result.records.push({type:"operation",id,operationType,status:value(row,mapping.columns,"status")?.trim() || undefined,occurredAt,source});
      return;
    }

    if (mapping.domain === "marketing") {
      const channel = required(result,rowNumber,"channel",value(row,mapping.columns,"channel"));
      const metric = required(result,rowNumber,"metric",value(row,mapping.columns,"metric"));
      const occurredAt = required(result,rowNumber,"occurredAt",value(row,mapping.columns,"occurredAt"));
      const metricValue = numberValue(value(row,mapping.columns,"value"));
      if (!channel || !metric || !occurredAt || metricValue === undefined) {
        if (metricValue === undefined) result.issues.push({row:rowNumber,field:"value",message:"Value must be a number."});
        return;
      }
      result.records.push({type:"marketing",id,channel,campaign:value(row,mapping.columns,"campaign")?.trim() || undefined,metric,value:metricValue,occurredAt,source});
    }
  });

  return result;
}
