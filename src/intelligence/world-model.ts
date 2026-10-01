import type { EvidenceItem } from "./types.js";
import type { ContextEntry } from "./context.js";
import type { NormalizedRecord } from "../business-data/types.js";

export type WorldModelEntityType =
  | "business"
  | "customer"
  | "product"
  | "sale"
  | "money"
  | "inventory"
  | "supplier"
  | "operation"
  | "project"
  | "marketing"
  | "person"
  | "decision"
  | "knowledge";

export type WorldModelEntity = {
  id: string;
  type: WorldModelEntityType;
  label: string;
  attributes: Record<string, unknown>;
  evidenceIds: string[];
};

export type WorldModelRelationship = {
  id: string;
  from: string;
  relation: string;
  to: string;
  evidenceIds: string[];
};

export type BusinessWorldModel = {
  entities: WorldModelEntity[];
  relationships: WorldModelRelationship[];
  evidenceIds: string[];
  domainsPresent: string[];
  limitations: string[];
};

function recordEntity(record: NormalizedRecord): WorldModelEntity {
  const typeMap: Record<NormalizedRecord["type"], WorldModelEntityType> = {
    customer: "customer", sale: "sale", money: "money", product: "product",
    inventory: "inventory", supplier: "supplier", operation: "operation",
    project: "project", marketing: "marketing", person: "person",
  };
  const label =
    "name" in record ? record.name :
    record.type === "sale" ? `Sale ${record.id}` :
    record.type === "money" ? `${record.typeName} ${record.amount} ${record.currency}` :
    record.type === "inventory" ? `Inventory ${record.productId}` :
    record.type === "marketing" ? `${record.channel}: ${record.metric}` :
    `${record.type} ${record.id}`;

  const { id, type, ...attributes } = record;
  return { id: `record:${id}`, type: typeMap[type], label, attributes, evidenceIds: [] };
}

export function buildBusinessWorldModel(
  records: NormalizedRecord[] = [],
  evidence: EvidenceItem[] = [],
  context: ContextEntry[] = [],
): BusinessWorldModel {
  const entities = new Map<string, WorldModelEntity>();
  const relationships: WorldModelRelationship[] = [];

  for (const record of records) entities.set(`record:${record.id}`, recordEntity(record));

  if (!records.length) {
    for (const item of evidence) {
      const label = item.label.toLowerCase();
      const type: WorldModelEntityType = label.includes("sale") ? "sale" : label.includes("customer") ? "customer" : label.includes("product") ? "product" : label.includes("inventory") ? "inventory" : label.includes("money") || label.includes("expense") ? "money" : label.includes("marketing") ? "marketing" : "knowledge";
      entities.set(`evidence:${item.id}`, {
        id: `evidence:${item.id}`,
        type,
        label: item.label,
        attributes: { detail: item.detail, source: item.source, freshness: item.freshness, verification: item.verification },
        evidenceIds: [item.id],
      });
    }
  }

  for (const record of records) {
    if (record.type === "sale" && record.customerId) {
      const from = `record:${record.id}`;
      const to = `record:${record.customerId}`;
      relationships.push({
        id: `rel:${record.id}:customer`,
        from, relation: "sold-to", to,
        evidenceIds: [],
      });
    }
    if (record.type === "sale" && record.productId) {
      relationships.push({
        id: `rel:${record.id}:product`,
        from: `record:${record.id}`,
        relation: "contains-product",
        to: `record:${record.productId}`,
        evidenceIds: [],
      });
    }
    if (record.type === "inventory") {
      relationships.push({
        id: `rel:${record.id}:product`,
        from: `record:${record.id}`,
        relation: "tracks-product",
        to: `record:${record.productId}`,
        evidenceIds: [],
      });
    }
  }

  const evidenceIds = evidence.map(item => item.id);
  const domainsPresent = [...new Set(records.map(record => record.type))];
  const limitations: string[] = [];

  if (!records.length) limitations.push("No normalized business records are available.");
  if (!evidence.length) limitations.push("No connected evidence is available to validate business-world claims.");
  if (context.length) limitations.push("Context can guide interpretation but is not promoted to verified business evidence.");

  return {
    entities: [...entities.values()],
    relationships,
    evidenceIds,
    domainsPresent,
    limitations,
  };
}
