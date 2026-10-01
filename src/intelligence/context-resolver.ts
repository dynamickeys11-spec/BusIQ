import type { ContextEntry } from "./context.js";

export type ContextResolution = {
  entries: ContextEntry[];
  references: Array<{ reference: string; resolved: boolean; targetId?: string; reason: string }>;
  unresolvedReferences: string[];
  summary: string[];
};

function score(reference: string, entry: ContextEntry): number {
  const ref = reference.trim().toLowerCase();
  const haystack = (entry.key + " " + entry.value).toLowerCase();
  if (!ref || !haystack) return 0;
  if (haystack === ref) return 100;
  if (haystack.includes(ref) || ref.includes(haystack)) return 80;
  const tokens = ref.split(/[^a-z0-9]+/i).filter(token => token.length >= 3);
  return tokens.filter(token => haystack.includes(token)).length * 10;
}

export function resolveSemanticContext(
  references: string[],
  entries: ContextEntry[],
  now = new Date(),
): ContextResolution {
  const usable = entries.filter(entry => {
    if (!entry.expiresAt) return true;
    const expiry = new Date(entry.expiresAt).getTime();
    return Number.isFinite(expiry) && expiry > now.getTime();
  });
  const selected = new Map<string, ContextEntry>();
  const resolved: ContextResolution["references"] = [];

  for (const reference of references) {
    const candidates = usable
      .map(entry => ({ entry, score: score(reference, entry) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const second = candidates[1];
    if (!best || (second && best.score === second.score)) {
      resolved.push({
        reference,
        resolved: false,
        reason: best ? "Multiple context entries are equally plausible." : "No supplied context entry matches the semantic reference.",
      });
      continue;
    }
    selected.set(best.entry.id, best.entry);
    resolved.push({
      reference,
      resolved: true,
      targetId: best.entry.id,
      reason: "Resolved against supplied context.",
    });
  }

  for (const entry of usable) {
    if (entry.kind === "business" || entry.kind === "decision" || entry.kind === "knowledge") {
      selected.set(entry.id, entry);
    }
  }

  const unresolvedReferences = resolved.filter(item => !item.resolved).map(item => item.reference);
  return {
    entries: [...selected.values()],
    references: resolved,
    unresolvedReferences,
    summary: [
      `${selected.size} usable context item(s) selected.`,
      unresolvedReferences.length
        ? `${unresolvedReferences.length} semantic reference(s) remain unresolved.`
        : "All supplied semantic references were resolved or none were supplied.",
      "Context is not evidence unless independently verified.",
    ],
  };
}
