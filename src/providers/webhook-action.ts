import type {
  ActionExecutionRequest,
  ActionExecutionResult,
  ActionProvider,
  ProviderHealth,
} from "./types";

const runtimeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

export class WebhookActionProvider implements ActionProvider {
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const url = runtimeProcess?.BUSIQ_ACTION_WEBHOOK_URL;
    const secret = runtimeProcess?.BUSIQ_ACTION_WEBHOOK_SECRET;
    if (!url) throw new Error("No BUSIQ action webhook is configured.");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: "Bearer " + secret } : {}),
        "x-busiq-confirmation-id": request.confirmationId,
      },
      body: JSON.stringify({
        businessId: request.businessId,
        actionId: request.actionId,
        inputs: request.inputs,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const detail = await response.text().catch(() => "");
    if (!response.ok) {
      return {
        actionId: request.actionId,
        provider: "webhook",
        state: "failed",
        detail: "Webhook returned HTTP " + response.status + ": " + detail.slice(0, 500),
      };
    }

    return {
      actionId: request.actionId,
      provider: "webhook",
      state: "completed",
      detail: detail.slice(0, 1000),
    };
  }

  async health(): Promise<ProviderHealth> {
    return {
      availability: runtimeProcess?.BUSIQ_ACTION_WEBHOOK_URL ? "available" : "unavailable",
      provider: "webhook",
      checkedAt: new Date().toISOString(),
      detail: runtimeProcess?.BUSIQ_ACTION_WEBHOOK_URL
        ? "Configured HTTPS action webhook."
        : "No action webhook configured.",
    };
  }
}
