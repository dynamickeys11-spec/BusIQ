import type { ResolvedBusinessContext } from "./contracts";

const domains = ["context", "intent", "knowledge", "learning", "environment", "time"] as const;

export function resolveBusinessContext(
  input: Partial<ResolvedBusinessContext>,
): ResolvedBusinessContext {
  const resolved = Object.fromEntries(
    domains.map((domain) => [domain, input[domain] ?? {}]),
  ) as ResolvedBusinessContext;

  const completeness =
    domains.filter((domain) => Object.keys(resolved[domain]).length > 0).length / domains.length;

  return { ...resolved, completeness };
}
