import type { ResolvedBusinessContext } from "./contracts";
const domains = ["context","intent","knowledge","learning","environment","time"] as const;
export function resolveBusinessContext(input: Partial<ResolvedBusinessContext>): ResolvedBusinessContext {
  const resolved: ResolvedBusinessContext = {
    context: input.context ?? {},
    intent: input.intent ?? {},
    knowledge: input.knowledge ?? {},
    learning: input.learning ?? {},
    environment: input.environment ?? {},
    time: input.time ?? {},
    completeness: 0,
  };
  resolved.completeness = domains.filter(domain => Object.keys(resolved[domain]).length > 0).length / domains.length;
  return resolved;
}