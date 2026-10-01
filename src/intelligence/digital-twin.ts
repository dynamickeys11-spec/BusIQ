import type { EvidenceItem } from "./types.js";
import type { BusinessWorldModel } from "./world-model.js";
import type { NormalizedRecord } from "../business-data/types.js";

export type TwinMetric = {
  id: string;
  label: string;
  value: number | null;
  unit: "currency" | "count" | "ratio" | "quantity";
  evidenceIds: string[];
  confidence: "high" | "medium" | "low";
};

export type TwinAssumption = {
  id: string;
  statement: string;
  evidenceIds: string[];
  status: "supported" | "unresolved" | "challenged";
};

export type TwinScenario = {
  id: string;
  name: string;
  changes: Record<string, number>;
  projectedMetrics: TwinMetric[];
  uncertainty: number;
};

export type BusinessDigitalTwin = {
  generatedAt: string;
  entityCount: number;
  relationshipCount: number;
  domainsPresent: string[];
  metrics: TwinMetric[];
  assumptions: TwinAssumption[];
  scenarios: TwinScenario[];
  limitations: string[];
};

function evidenceForRecord(record: NormalizedRecord, evidence: EvidenceItem[]): string[] {
  const explicit = typeof record.metadata?.evidenceId === "string" ? [record.metadata.evidenceId] : [];
  const direct = evidence.filter(item => item.scope?.entityId === record.id).map(item => item.id);
  return [...new Set([...explicit, ...direct])];
}

export function buildBusinessDigitalTwin(
  records: NormalizedRecord[],
  evidence: EvidenceItem[],
  worldModel: BusinessWorldModel,
): BusinessDigitalTwin {
  const sales = records.filter((r): r is Extract<NormalizedRecord, { type: "sale" }> => r.type === "sale");
  const customers = records.filter(r => r.type === "customer");
  const products = records.filter(r => r.type === "product");
  const inventory = records.filter(r => r.type === "inventory");

  const saleEvidence = sales.flatMap(record => evidenceForRecord(record, evidence));
  const revenue = sales.reduce((sum, sale) => sum + sale.amount, 0);

  const metrics: TwinMetric[] = [
    {
      id: "sales-revenue",
      label: "Observed sales revenue",
      value: sales.length ? revenue : null,
      unit: "currency",
      evidenceIds: [...new Set(saleEvidence)],
      confidence: sales.length ? "high" : "low",
    },
    {
      id: "sales-count",
      label: "Observed sales count",
      value: sales.length || null,
      unit: "count",
      evidenceIds: [...new Set(saleEvidence)],
      confidence: sales.length ? "high" : "low",
    },
    {
      id: "customer-count",
      label: "Observed customer count",
      value: customers.length || null,
      unit: "count",
      evidenceIds: customers.flatMap(record => evidenceForRecord(record, evidence)),
      confidence: customers.length ? "high" : "low",
    },
    {
      id: "product-count",
      label: "Observed product count",
      value: products.length || null,
      unit: "count",
      evidenceIds: products.flatMap(record => evidenceForRecord(record, evidence)),
      confidence: products.length ? "high" : "low",
    },
    {
      id: "inventory-record-count",
      label: "Observed inventory records",
      value: inventory.length || null,
      unit: "count",
      evidenceIds: inventory.flatMap(record => evidenceForRecord(record, evidence)),
      confidence: inventory.length ? "high" : "low",
    },
  ];

  const assumptions: TwinAssumption[] = [
    {
      id: "twin-observation-boundary",
      statement: "The digital twin represents only the supplied or connected business evidence; missing domains remain unknown.",
      evidenceIds: evidence.map(item => item.id),
      status: evidence.length ? "supported" : "unresolved",
    },
  ];

  const limitations = [
    ...worldModel.limitations,
    "The current twin is an evidence-grounded state model, not a causal model.",
    "Scenario projections are not treated as observed outcomes.",
  ];

  return {
    generatedAt: new Date().toISOString(),
    entityCount: worldModel.entities.length,
    relationshipCount: worldModel.relationships.length,
    domainsPresent: [...worldModel.domainsPresent],
    metrics,
    assumptions,
    scenarios: [],
    limitations: [...new Set(limitations)],
  };
}

export function simulateTwinScenario(
  twin: BusinessDigitalTwin,
  name: string,
  changes: Record<string, number>,
  elasticity = 1,
): TwinScenario {
  const uncertainty = 0.1;
  const projectedMetrics = twin.metrics.map(metric => {
    if (metric.value === null) return { ...metric, confidence: "low" as const };
    const change = changes[metric.id] ?? 0;
    return { ...metric, value: metric.value * (1 + change * elasticity), confidence: "medium" as const };
  });
  return {
    id: "scenario:" + crypto.randomUUID(),
    name,
    changes: { ...changes },
    projectedMetrics,
    uncertainty,
  };
}
