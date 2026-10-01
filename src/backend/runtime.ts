export type JobState = "queued" | "running" | "completed" | "failed";

export type BackgroundJob<TPayload = unknown> = {
  id: string;
  kind: string;
  payload: TPayload;
  state: JobState;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export interface JobQueue {
  enqueue<TPayload>(job: Omit<BackgroundJob<TPayload>, "id" | "state" | "createdAt">): Promise<string>;
}

export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
