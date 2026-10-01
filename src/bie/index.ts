import type { BusinessIntelligenceEngine, IntelligenceOutput, ResolvedBusinessContext } from "./contracts.js";
import { resolveBusinessContext } from "./resolution.js";
import { deterministicAnalyse } from "./providers/deterministic.js";

const engine: BusinessIntelligenceEngine = {
  resolve: resolveBusinessContext,
  analyse: deterministicAnalyse,
};

export const bie = {
  resolve(input: Partial<ResolvedBusinessContext>) {
    return engine.resolve(input);
  },
  analyse(context: ResolvedBusinessContext): IntelligenceOutput[] {
    return engine.analyse(context);
  },
};

export type {
  BusinessIntelligenceEngine,
  Evidence,
  IntelligenceOutput,
  ProvenanceClass,
  ResolvedBusinessContext,
} from "./contracts.js";
