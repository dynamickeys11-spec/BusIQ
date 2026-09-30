import type {
  ActionExecutionRequest,
  ActionExecutionResult,
  ActionProvider,
  BusinessDataProvider,
  BusinessDataRecord,
  BusinessDataRequest,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ProviderHealth,
  ResearchProvider,
  ResearchRequest,
  ResearchResult,
} from "./types";

function unavailable(provider: string): ProviderHealth {
  return {
    availability: "unavailable",
    provider,
    checkedAt: new Date().toISOString(),
    detail: "No production provider is configured.",
  };
}

export class UnconfiguredModelProvider implements ModelProvider {
  async generate(_request: ModelRequest): Promise<ModelResponse> {
    throw new Error("No production AI model provider is configured.");
  }
  async health(): Promise<ProviderHealth> { return unavailable("unconfigured-model"); }
}

export class UnconfiguredResearchProvider implements ResearchProvider {
  async search(_request: ResearchRequest): Promise<ResearchResult> {
    throw new Error("No production research provider is configured.");
  }
  async health(): Promise<ProviderHealth> { return unavailable("unconfigured-research"); }
}

export class UnconfiguredBusinessDataProvider implements BusinessDataProvider {
  async read(_request: BusinessDataRequest): Promise<BusinessDataRecord[]> {
    throw new Error("No business-data connector is configured.");
  }
  async health(): Promise<ProviderHealth> { return unavailable("unconfigured-business-data"); }
}

export class UnconfiguredActionProvider implements ActionProvider {
  async execute(_request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    throw new Error("No production action provider is configured.");
  }
  async health(): Promise<ProviderHealth> { return unavailable("unconfigured-action"); }
}
