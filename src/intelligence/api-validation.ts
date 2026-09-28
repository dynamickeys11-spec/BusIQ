export type ApiValidationResult =
  | { ok: true; request: string }
  | { ok: false; status: 400 | 413 | 415; error: string };

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
  return { ok: true, request };
}
