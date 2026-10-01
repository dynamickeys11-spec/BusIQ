export type UsagePolicy = {
  windowMs: number;
  maxRequests: number;
  maxRequestChars: number;
};

export const defaultUsagePolicy: UsagePolicy = {
  windowMs: 60_000,
  maxRequests: 30,
  maxRequestChars: 4_000,
};

export type UsageState = {
  startedAt: number;
  count: number;
};

export function consumeUsage(
  states: Map<string, UsageState>,
  key: string,
  now: number,
  policy: UsagePolicy = defaultUsagePolicy,
): { allowed: boolean; retryAfterSeconds: number; state: UsageState } {
  const existing = states.get(key);
  if (!existing || now - existing.startedAt >= policy.windowMs) {
    const state = { startedAt: now, count: 1 };
    states.set(key, state);
    return { allowed: true, retryAfterSeconds: 0, state };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((policy.windowMs - (now - existing.startedAt)) / 1000));
  return { allowed: existing.count <= policy.maxRequests, retryAfterSeconds, state: existing };
}
