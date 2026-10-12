import { db } from "@app/db";
import { collectAccountJob, createRedis, DEFAULT_JOB_OPTIONS, QUEUES, type UsageJobData, type UsageJobName } from "@app/shared";
import { Queue } from "bullmq";
import { env } from "../config";

/**
 * Producer-side Redis connection. `enableOfflineQueue: false` makes web requests
 * fail fast when Redis is down instead of hanging until it comes back.
 */
export const redis = createRedis(env.REDIS_URL, { enableOfflineQueue: false });

export const usageQueue = new Queue<UsageJobData, unknown, UsageJobName>(QUEUES.usage, {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Manual refresh. Marks the account queued (so its card starts polling) before
 * enqueueing, so the worker's own status writes always come after this one.
 */
export async function requestCollect(accountId: number) {
  const before = await db.account.findUniqueOrThrow({ where: { id: accountId }, select: { status: true } });
  await db.account.update({ where: { id: accountId }, data: { status: "queued" } });
  try {
    await usageQueue.add(...collectAccountJob(accountId));
  } catch (err) {
    await db.account.update({ where: { id: accountId }, data: { status: before.status } });
    throw err;
  }
}
