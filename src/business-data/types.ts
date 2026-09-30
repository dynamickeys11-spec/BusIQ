export type BusinessDomain =
  | "customers"
  | "sales"
  | "money"
  | "expenses"
  | "products"
  | "inventory"
  | "operations"
  | "projects"
  | "marketing"
  | "suppliers"
  | "people";

export type NormalizedRecord =
  | { type: "customer"; id: string; externalId?: string; name: string; email?: string; phone?: string; status?: string; source: string; observedAt: string; metadata?: Record<string, unknown> }
  | { type: "sale"; id: string; externalId?: string; occurredAt: string; amount: number; currency: string; customerId?: string; productId?: string; quantity?: number; status?: string; source: string; metadata?: Record<string, unknown> }
  | { type: "money"; id: string; externalId?: string; occurredAt: string; typeName: "income" | "expense" | "transfer" | "refund" | "unknown"; amount: number; currency: string; category?: string; source: string; metadata?: Record<string, unknown> }
  | { type: "product"; id: string; externalId?: string; name: string; sku?: string; category?: string; price?: number; currency?: string; status?: string; source: string; metadata?: Record<string, unknown> }
  | { type: "inventory"; id: string; externalId?: string; productId: string; location?: string; quantity: number; occurredAt: string; source: string; metadata?: Record<string, unknown> }
  | { type: "supplier"; id: string; externalId?: string; name: string; status?: string; source: string; metadata?: Record<string, unknown> }
  | { type: "operation"; id: string; externalId?: string; operationType: string; status?: string; occurredAt: string; source: string; metadata?: Record<string, unknown> }
  | { type: "project"; id: string; externalId?: string; name: string; status?: string; startAt?: string; endAt?: string; source: string; metadata?: Record<string, unknown> }
  | { type: "marketing"; id: string; externalId?: string; channel: string; campaign?: string; metric: string; value: number; occurredAt: string; source: string; metadata?: Record<string, unknown> }
  | { type: "person"; id: string; externalId?: string; name: string; role?: string; status?: string; source: string; metadata?: Record<string, unknown> };

export type ConnectorQuery = {
  businessId: string;
  domain: BusinessDomain;
  query: string;
};

export type ConnectorResult = {
  provider: string;
  records: NormalizedRecord[];
  retrievedAt: string;
};

export interface BusinessConnector {
  readonly id: string;
  readonly label: string;
  readonly domains: BusinessDomain[];
  read(query: ConnectorQuery): Promise<ConnectorResult>;
  health(): Promise<{ availability: "available" | "unavailable" | "degraded"; detail?: string }>;
}
