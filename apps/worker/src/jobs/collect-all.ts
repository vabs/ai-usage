import { db } from "@app/db";
import { collectAccountJob, type UsageJobData, type UsageJobName } from "@app/shared";
import type { Queue } from "bullmq";

const PENDING_AUTH_TTL_MS = 3600_000;

/** Scheduled fan-out: one collect-account job per connected account. */
export function createCollectAll(queue: Queue<UsageJobData, unknown, UsageJobName>) {
  return async function collectAll() {
    const accounts = await db.account.findMany({ select: { id: true } });
    for (const { id } of accounts) await queue.add(...collectAccountJob(id));

    // Housekeeping: abandoned "connect account" attempts.
    await db.pendingAuth.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - PENDING_AUTH_TTL_MS) } } });
    return { accounts: accounts.length };
  };
}
