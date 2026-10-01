export type ProviderAvailability = "available" | "unavailable" | "degraded";

export type ProviderHealth = {
  availability: ProviderAvailability;
  provider: string;
  checkedAt: string;
  detail?: string;
};

export type ModelRequest = {
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: "text" | "json";
};

export type ModelResponse = {
  text: string;
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

export interface ModelProvider {
  generate(request: ModelRequest): Promise<ModelResponse>;
  health(): Promise<ProviderHealth>;
}

export type ResearchRequest = {
  query: string;
  intent: string;
  entities: string[];
  time?: string;
  sourceClasses?: string[];
};

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publishedAt?: string;
  retrievedAt: string;
  authority: "primary" | "secondary";
};

export type ResearchResult = {
  provider: string;
  sources: ResearchSource[];
  claims: Array<{
    statement: string;
    sourceIds: string[];
  }>;
};

export interface ResearchProvider {
  search(request: ResearchRequest): Promise<ResearchResult>;
  health(): Promise<ProviderHealth>;
}

export type BusinessDataRequest = {
  businessId: string;
  domain: "sales" | "customers" | "money" | "products" | "inventory" | "marketing" | "operations";
  query: string;
};

export type BusinessDataRecord = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  source: string;
  retrievedAt: string;
};

export interface BusinessDataProvider {
  read(request: BusinessDataRequest): Promise<BusinessDataRecord[]>;
  health(): Promise<ProviderHealth>;
}

export type ActionExecutionRequest = {
  businessId: string;
  actionId: string;
  inputs: Record<string, unknown>;
  confirmationId: string;
};

export type ActionExecutionResult = {
  actionId: string;
  provider: string;
  state: "completed" | "failed";
  externalReference?: string;
  detail?: string;
};

export interface ActionProvider {
  execute(request: ActionExecutionRequest): Promise<ActionExecutionResult>;
  health(): Promise<ProviderHealth>;
}
