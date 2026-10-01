import type { ContextState } from "./context.js";

export type ApiValidationResult =
  | { ok: true; request: string; context?: ContextState; businessId?: string }
  | { ok: false; status: 400 | 413 | 415; error: string };

function isContextEntry(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string"
    && typeof entry.kind === "string"
    && typeof entry.key === "string"
    && typeof entry.value === "string"
    && typeof entry.createdAt === "string";
}

function isContextState(value: unknown): value is ContextState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return ["business", "user", "conversation", "work", "decisions", "knowledge", "provenance"]
    .every((key) => Array.isArray(state[key]) && (state[key] as unknown[]).every(isContextEntry));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateIntelligenceRequest(
  request: Request,
  maxRequestChars: number,
): ApiValidationResult {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return { ok: false, status: 415, error: "Content-Type must be application/json" };
  }
  return { ok: true, request: "" };
}

export function validateRequestBody(body: unknown, maxRequestChars: number): ApiValidationResult {
  const request = typeof body === "object" && body !== null && "request" in body
    ? (body as { request?: unknown }).request
    : undefined;
  if (typeof request !== "string" || !request.trim()) {
    return { ok: false, status: 400, error: "A non-empty request string is required" };
  }
  if (request.length > maxRequestChars) {
    return { ok: false, status: 413, error: "Request is too large" };
  }

  const businessId = typeof body === "object" && body !== null && "businessId" in body
    ? (body as { businessId?: unknown }).businessId
    : undefined;
  if (businessId !== undefined && !isUuid(businessId)) {
    return { ok: false, status: 400, error: "businessId must be a valid UUID" };
  }

  const context = typeof body === "object" && body !== null && "context" in body
    ? (body as { context?: unknown }).context
    : undefined;

  if (context !== undefined && !isContextState(context)) {
    return { ok: false, status: 400, error: "Context payload is invalid" };
  }

  return {
    ok: true,
    request,
    context: context as ContextState | undefined,
    businessId: businessId as string | undefined,
  };
}
