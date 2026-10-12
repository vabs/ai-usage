import { type Account, db, type UsageWindow } from "@app/db";
import { env } from "../config";
import { notFound } from "./http-error";

export type AccountWithWindows = Account & { windows: UsageWindow[] };

const withWindows = { windows: { orderBy: { key: "asc" } } } as const;

/** A queued/running status older than this is a crashed job, not real progress. */
const IN_FLIGHT_TIMEOUT_MS = 2 * 60_000;

/** Two missed collections plus a minute of slack. */
export const STALE_AFTER_MS = (env.COLLECT_INTERVAL_MINUTES * 2 + 1) * 60_000;

export const listAccounts = () =>
  db.account.findMany({ include: withWindows, orderBy: [{ provider: "asc" }, { createdAt: "asc" }] });

export async function findAccount(rawId: string): Promise<AccountWithWindows> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Account");
  const account = await db.account.findUnique({ where: { id }, include: withWindows });
  if (!account) throw notFound("Account");
  return account;
}

export const isInFlight = (a: Account, now = Date.now()) =>
  a.status !== "idle" && now - a.updatedAt.getTime() < IN_FLIGHT_TIMEOUT_MS;

export const isStale = (a: Account, now = Date.now()) => !a.lastOkAt || now - a.lastOkAt.getTime() > STALE_AFTER_MS;

/** The /api/usage shape. Never includes credentials or raw responses. */
export function toApi(a: AccountWithWindows, now = Date.now()) {
  return {
    id: a.id,
    provider: a.provider,
    label: a.label,
    plan: a.plan,
    bankedResets: a.bankedResets,
    status: isInFlight(a, now) ? a.status : "idle",
    stale: isStale(a, now),
    lastOkAt: a.lastOkAt,
    lastAttemptAt: a.lastAttemptAt,
    error: a.lastError ? { kind: a.lastErrorKind, message: a.lastError } : null,
    windows: a.windows.map((w) => ({
      key: w.key,
      label: w.label,
      usedPct: w.usedPct,
      resetsAt: w.resetsAt,
      capturedAt: w.capturedAt,
    })),
  };
}
