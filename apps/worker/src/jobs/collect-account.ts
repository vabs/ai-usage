import { db } from "@app/db";
import { ADAPTERS, collectUsage, openCredentials, ProviderError, sealCredentials } from "@app/providers";
import { type ErrorKind, isProvider, type UsageJobMap, type UsageReport } from "@app/shared";
import type { Job } from "bullmq";
import { logger, sealer } from "../config";

/**
 * Collects one account: refreshes its token if needed, calls the vendor's usage
 * endpoint, and stores the result. Fails soft: errors are recorded on the account
 * (the last good windows stay visible, marked stale) and the job itself succeeds.
 */
export async function collectAccount(job: Job<UsageJobMap["collect-account"]>) {
  const { accountId } = job.data;
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return { skipped: "account deleted" };

  await db.account.updateMany({ where: { id: accountId }, data: { status: "running", lastAttemptAt: new Date() } });

  try {
    if (!isProvider(account.provider)) throw new Error(`Unknown provider "${account.provider}"`);
    const report = await collectUsage(
      ADAPTERS[account.provider],
      openCredentials(sealer, account.credentials),
      async (credentials) => {
        await db.account.updateMany({ where: { id: accountId }, data: { credentials: sealCredentials(sealer, credentials) } });
      },
    );
    await saveReport(accountId, report);
    return { windows: report.windows.length };
  } catch (err) {
    const kind: ErrorKind = err instanceof ProviderError ? err.kind : "internal";
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Collect failed for account ${accountId} (${account.provider})`, { kind, err: message });
    await db.account.updateMany({
      where: { id: accountId },
      data: { status: "idle", lastError: message, lastErrorKind: kind },
    });
    return { error: message };
  }
}

async function saveReport(accountId: number, report: UsageReport) {
  const capturedAt = new Date();
  const keys = report.windows.map((w) => w.key);

  await db.$transaction([
    // Windows the vendor stopped reporting would otherwise linger as stale bars.
    db.usageWindow.deleteMany({ where: { accountId, key: { notIn: keys } } }),
    ...report.windows.map((w) =>
      db.usageWindow.upsert({
        where: { accountId_key: { accountId, key: w.key } },
        create: { accountId, ...w, capturedAt },
        update: { label: w.label, usedPct: w.usedPct, resetsAt: w.resetsAt, capturedAt },
      }),
    ),
    db.usageSnapshot.createMany({
      data: report.windows.map((w) => ({ accountId, key: w.key, usedPct: w.usedPct, resetsAt: w.resetsAt, capturedAt })),
    }),
    db.account.updateMany({
      where: { id: accountId },
      data: {
        status: "idle",
        lastOkAt: capturedAt,
        lastError: null,
        lastErrorKind: null,
        plan: report.plan,
        bankedResets: report.bankedResets,
        lastRaw: JSON.stringify(report.raw),
      },
    }),
  ]);
}
