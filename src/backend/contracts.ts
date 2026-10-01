export type BackendReadiness =
  | "not-configured"
  | "configured"
  | "available";

export type BackendResource = "database" | "auth" | "business-data" | "audit-log";

export type BackendCapability = {
  resource: BackendResource;
  readiness: BackendReadiness;
  provider?: string;
  note: string;
};

export type BackendStatus = {
  capabilities: BackendCapability[];
};

export interface BusinessRepository {
  getBusiness(businessId: string): Promise<unknown>;
  listBusinessMembers(businessId: string): Promise<unknown[]>;
}

export interface AuditRepository {
  append(event: unknown): Promise<void>;
  list(actionId?: string): Promise<unknown[]>;
}

export interface IdentityProvider {
  getCurrentIdentity(request: Request): Promise<unknown | null>;
}

export interface BackendServices {
  business: BusinessRepository;
  audit: AuditRepository;
  identity: IdentityProvider;
  status: BackendStatus;
}
