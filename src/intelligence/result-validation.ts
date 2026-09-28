import type { ToolExecutionResult } from "./tools";

export function validateToolResult(result: ToolExecutionResult): ToolExecutionResult {
  if (result.state === "blocked") return result;
  if (!result.toolId || !Array.isArray(result.evidence)) {
    return { state: "blocked", toolId: result.toolId || "unknown", reason: "Tool result failed structural validation.", missingInputs: [] };
  }
  return result;
}
