export type ContextKind = "business" | "user" | "conversation" | "work" | "decision" | "knowledge" | "provenance";
export type ContextFreshness = "persistent" | "current" | "expiring" | "expired";

export type ContextEntry = {
  id: string;
  kind: ContextKind;
  key: string;
  value: string;
  source?: string;
  sourceDate?: string;
  createdAt: string;
  expiresAt?: string;
  businessId?: string;
  workId?: string;
};

export type ContextState = {
  business: ContextEntry[];
  user: ContextEntry[];
  conversation: ContextEntry[];
  work: ContextEntry[];
  decisions: ContextEntry[];
  knowledge: ContextEntry[];
  provenance: ContextEntry[];
};

export function contextFreshness(entry: ContextEntry, now = new Date()): ContextFreshness {
  if (!entry.expiresAt) return "persistent";
  const expiry = new Date(entry.expiresAt).getTime();
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) return "expired";
  const remaining = expiry - now.getTime();
  return remaining <= 24 * 60 * 60 * 1000 ? "expiring" : "current";
}

export function isContextUsable(entry: ContextEntry, now = new Date()): boolean {
  return contextFreshness(entry, now) !== "expired";
}

export function filterUsableContext(entries: ContextEntry[], now = new Date()): ContextEntry[] {
  return entries.filter(entry => isContextUsable(entry, now));
}

export function createContextEntry(
  kind: ContextKind,
  key: string,
  value: string,
  options: Omit<Partial<ContextEntry>, "id" | "kind" | "key" | "value" | "createdAt"> = {},
): ContextEntry {
  return {
    id: `context-${crypto.randomUUID()}`,
    kind,
    key,
    value,
    createdAt: new Date().toISOString(),
    ...options,
  };
}

export function rememberDecision(
  decision: string,
  rationale: string,
  options: { workId?: string; businessId?: string } = {},
): ContextEntry {
  return createContextEntry("decision", decision, rationale, options);
}

export function rememberProvenance(
  source: string,
  sourceDate?: string,
  options: { businessId?: string; workId?: string } = {},
): ContextEntry {
  return createContextEntry("provenance", source, sourceDate ?? "date unknown", {
    ...options,
    source,
    sourceDate,
  });
}

export function mergeContext(
  current: ContextEntry[],
  incoming: ContextEntry[],
): ContextEntry[] {
  const byKey = new Map(current.map(entry => [`${entry.kind}:${entry.key}`, entry]));
  for (const entry of incoming) byKey.set(`${entry.kind}:${entry.key}`, entry);
  return [...byKey.values()];
}
