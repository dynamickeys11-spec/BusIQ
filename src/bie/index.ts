import type { BusinessIntelligenceEngine, IntelligenceOutput, ResolvedBusinessContext } from "./contracts";
import { resolveBusinessContext } from "./resolution";
import { deterministicAnalyse } from "./providers/deterministic";

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
} from "./contracts";
