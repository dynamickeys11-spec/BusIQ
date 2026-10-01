import type { NormalizedRecord } from "../business-data/types.js";
import type { EvidenceItem, ReasoningConclusion } from "./types.js";

export type SalesDiagnosis = {
  conclusion: ReasoningConclusion;
  metrics: {
    earlierRevenue: number;
    recentRevenue: number;
    revenueChangePct: number;
    earlierOrders: number;
    recentOrders: number;
    orderChangePct: number;
    earlierAverageOrderValue: number;
    recentAverageOrderValue: number;
    averageOrderValueChangePct: number;
  };
};

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function evidenceIds(records: NormalizedRecord[]): string[] {
  return records.flatMap((record) => {
    const id = record.metadata?.evidenceId;
    return typeof id === "string" ? [id] : [];
  });
}

export function diagnoseSales(records: NormalizedRecord[], request: string): SalesDiagnosis | undefined {
  const sales = records.filter((record): record is Extract<NormalizedRecord, { type: "sale" }> => record.type === "sale");
  if (sales.length < 4) return undefined;

  const ordered = [...sales].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const midpoint = Math.floor(ordered.length / 2);
  const earlier = ordered.slice(0, midpoint);
  const recent = ordered.slice(midpoint);
  if (earlier.length === 0 || recent.length === 0) return undefined;

  const earlierRevenue = earlier.reduce((sum, sale) => sum + sale.amount, 0);
  const recentRevenue = recent.reduce((sum, sale) => sum + sale.amount, 0);
  const earlierOrders = earlier.length;
  const recentOrders = recent.length;
  const earlierAov = earlierRevenue / earlierOrders;
  const recentAov = recentRevenue / recentOrders;
  const revenueChangePct = pctChange(recentRevenue, earlierRevenue);
  const orderChangePct = pctChange(recentOrders, earlierOrders);
  const aovChangePct = pctChange(recentAov, earlierAov);

  if (revenueChangePct >= 0) return undefined;

  const driver = orderChangePct < 0 && aovChangePct >= 0
    ? "The observed decline is explained by fewer transactions while average transaction value did not decline."
    : orderChangePct >= 0 && aovChangePct < 0
      ? "The observed decline is explained by lower average transaction value while transaction count did not decline."
      : orderChangePct < 0 && aovChangePct < 0
        ? "The observed decline reflects both fewer transactions and lower average transaction value."
        : "Revenue declined, but the supplied sales records do not isolate a single driver.";

  const ids = evidenceIds([...earlier, ...recent]);
  return {
    metrics: {
      earlierRevenue: round(earlierRevenue),
      recentRevenue: round(recentRevenue),
      revenueChangePct: round(revenueChangePct),
      earlierOrders,
      recentOrders,
      orderChangePct: round(orderChangePct),
      earlierAverageOrderValue: round(earlierAov),
      recentAverageOrderValue: round(recentAov),
      averageOrderValueChangePct: round(aovChangePct),
    },
    conclusion: {
      type: "FINDING",
      statement: `For ${request}, the supplied sales records show revenue changed ${round(revenueChangePct)}% between the earlier and recent record groups. Orders changed ${round(orderChangePct)}% and average transaction value changed ${round(aovChangePct)}%. ${driver} This is a descriptive decomposition, not proof of the underlying business cause.`,
      evidenceIds: ids,
      support: "supported",
    },
  };
}
