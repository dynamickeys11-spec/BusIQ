import type { BusinessConnector, BusinessDomain, ConnectorQuery, ConnectorResult } from "./types";

class UnconfiguredConnector implements BusinessConnector {
  readonly id = "business-connector-unconfigured";
  readonly label = "Business connector";
  readonly domains: BusinessDomain[] = ["customers", "sales", "money", "products", "inventory", "operations", "projects", "marketing", "suppliers", "people"];

  async read(_query: ConnectorQuery): Promise<ConnectorResult> {
    throw new Error("No business data connector is configured.");
  }

  async health() {
    return { availability: "unavailable" as const, detail: "No production business connector is configured." };
  }
}

const connectors: BusinessConnector[] = [new UnconfiguredConnector()];

export function listBusinessConnectors(): BusinessConnector[] {
  return [...connectors];
}

export function getBusinessConnector(id: string): BusinessConnector | undefined {
  return connectors.find((connector) => connector.id === id);
}
