/**
 * Single source of truth for queue names and job payloads, shared by the
 * server (producer) and the worker (consumer).
 */
export const QUEUES = {
  usage: "usage",
} as const;

export type UsageJobMap = {
  /** Scheduled fan-out: enqueues one collect-account job per connected account. */
  "collect-all": Record<string, never>;
  "collect-account": { accountId: number };
};

export type UsageJobName = keyof UsageJobMap;
export type UsageJobData = UsageJobMap[UsageJobName];

/** Default retry/cleanup policy for jobs. Override per job when needed. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { age: 24 * 3600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;

/**
 * Arguments for queue.add() that collect one account. Deduplicated per account so a
 * manual refresh and the schedule never run at the same time: vendors rotate refresh
 * tokens, and two concurrent refreshes would leave one of them holding a dead token.
 */
export function collectAccountJob(accountId: number) {
  return [
    "collect-account",
    { accountId },
    { deduplication: { id: `collect-account:${accountId}` }, attempts: 1 },
  ] as const;
}
