import { describe, expect, it } from "vitest";
import type { BackgroundJob, JobQueue, CacheStore } from "./runtime";

describe("backend runtime contracts", () => {
  it("keeps job state explicit", () => {
    const job: BackgroundJob = { id: "job-1", kind: "research", payload: {}, state: "queued", createdAt: new Date(0).toISOString() };
    expect(job.state).toBe("queued");
  });
  it("defines queue and cache boundaries without pretending they are connected", async () => {
    const queue: JobQueue = { enqueue: async () => "job-1" };
    const cache: CacheStore = { get: async () => undefined, set: async () => undefined, delete: async () => undefined };
    await expect(queue.enqueue({kind:"x",payload:{}})).resolves.toBe("job-1");
    await expect(cache.get("missing")).resolves.toBeUndefined();
  });
});
