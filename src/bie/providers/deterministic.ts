import type { IntelligenceOutput, ResolvedBusinessContext } from "../contracts";

export function deterministicAnalyse(
  context: ResolvedBusinessContext,
): IntelligenceOutput[] {
  const complete = context.completeness === 1;

  return [
    {
      id: "foundation-001",
      kind: "recommendation",
      title: complete ? "Context is ready for a decision" : "Resolve the missing business picture first",
      meaning: complete
        ? "The current foundation can support a bounded business decision."
        : "The intelligence layer should not present a confident decision while material context is missing.",
      whyItMatters:
        "BUSIQ treats context resolution as a prerequisite to useful business intelligence.",
      confidence: complete ? 0.92 : 0.98,
      assumptions: complete
        ? ["The supplied business context is current."]
        : ["No external business facts have been retrieved."],
      evidence: [
        {
          id: "foundation-resolution",
          label: "Resolution completeness",
          detail: `${Math.round(context.completeness * 100)}% of resolution domains contain information.`,
          provenance: "inferred",
        },
      ],
      methodology: "Deterministic foundation provider; no live model or external data source.",
      trace: [
        "Resolve Context",
        "Resolve Intent",
        "Resolve Knowledge",
        "Resolve Learning",
        "Resolve Environment",
        "Resolve Time",
        "Assess completeness",
      ],
      nextBestAction: complete
        ? "State the decision you want BUSIQ to prepare."
        : "Provide the missing business context before asking for a decision.",
      illustrative: true,
    },
  ];
}
