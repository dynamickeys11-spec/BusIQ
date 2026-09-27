import type { ToolExecutionRequest, ToolExecutionResult } from "./tools";
import { getTool } from "./tools";

function buildLocalPlan(request: string) {
  const clean = request.trim();
  return {
    objective: clean,
    stages: [
      { id: "clarify", label: "Clarify the objective", output: "A precise outcome and scope." },
      { id: "context", label: "Establish business context", output: "Relevant known context and constraints." },
      { id: "evidence", label: "Gather required evidence", output: "Only evidence available from connected sources or user-provided material." },
      { id: "options", label: "Develop options", output: "Practical options supported by the available evidence." },
      { id: "decision", label: "Choose the next action", output: "A clearly stated next step." },
    ],
    limitation: "This local planner creates structure only. It does not invent business facts, market data, financial figures, or research findings.",
  };
}

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

  if (tool.id === "local-context") {
    const value = String(request.inputs.request);
    return {
      state: "success",
      toolId: tool.id,
      output: { requestContext: value },
      evidence: [{ id: "local-request", kind: "user", label: "Request context", detail: value, source: "User input" }],
    };
  }

  if (tool.id === "deterministic-intent") {
    return {
      state: "success",
      toolId: tool.id,
      output: { resolved: true, request: String(request.inputs.request) },
      evidence: [],
    };
  }

  if (tool.id === "local-plan-builder") {
    const value = String(request.inputs.request);
    return {
      state: "success",
      toolId: tool.id,
      output: buildLocalPlan(value),
      evidence: [{ id: "local-plan", kind: "inferred", label: "Generated plan structure", detail: "Deterministic planning structure derived from the user's request.", source: "BUSIQ local plan builder" }],
    };
  }

  return {
    state: "blocked",
    toolId: tool.id,
    reason: "No real executor is registered for this tool.",
    missingInputs: [],
  };
}
