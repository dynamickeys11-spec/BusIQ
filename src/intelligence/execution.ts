import type { ToolExecutionRequest, ToolExecutionResult } from "./tools";
import { getTool } from "./tools";

export function executeTool(request: ToolExecutionRequest): ToolExecutionResult {
  const tool = getTool(request.toolId);

  if (!tool) {
    return { state: "blocked", toolId: request.toolId, reason: "Tool is not registered.", missingInputs: [] };
  }

  if (tool.availability !== "available") {
    return {
      state: "blocked",
      toolId: tool.id,
      reason: `${tool.label} is not connected.`,
      missingInputs: tool.requiredInputs,
    };
  }

  const missingInputs = tool.requiredInputs.filter(input => request.inputs[input] === undefined);
  if (missingInputs.length) {
    return {
      state: "blocked",
      toolId: tool.id,
      reason: "Required execution inputs are missing.",
      missingInputs,
    };
  }

  return {
    state: "blocked",
    toolId: tool.id,
    reason: "The tool is registered and available, but no real executor has been implemented yet.",
    missingInputs: [],
  };
}
