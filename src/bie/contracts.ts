export type ProvenanceClass = "verified" | "user" | "retrieved" | "inferred" | "predicted" | "ai";

export type Evidence = {
  id: string;
  label: string;
  detail: string;
  provenance: ProvenanceClass;
};

export type IntelligenceOutput = {
  id: string;
  kind: "opportunity" | "recommendation" | "prediction" | "explanation";
  title: string;
  meaning: string;
  whyItMatters: string;
  confidence: number;
  assumptions: string[];
  evidence: Evidence[];
  methodology: string;
  trace: string[];
  nextBestAction?: string;
  illustrative: boolean;
};

export type ResolvedBusinessContext = {
  context: Record<string, unknown>;
  intent: Record<string, unknown>;
  knowledge: Record<string, unknown>;
  learning: Record<string, unknown>;
  environment: Record<string, unknown>;
  time: Record<string, unknown>;
  completeness: number;
};

export interface BusinessIntelligenceEngine {
  resolve(input: Partial<ResolvedBusinessContext>): ResolvedBusinessContext;
  analyse(context: ResolvedBusinessContext): IntelligenceOutput[];
}
