import { type Account, db, type UsageWindow } from "@app/db";
import type { Request } from "express";
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

/** Share of a window still available, 0 to 100. The dashboard speaks in "left", like a fuel gauge. */
export const remainingPct = (usedPct: number) => Math.max(0, Math.min(100, 100 - usedPct));

export type Level = "ok" | "low" | "critical";
export const levelOf = (remaining: number): Level => (remaining <= 10 ? "critical" : remaining <= 30 ? "low" : "ok");

/** Most used first; on a tie, the one that resets later binds longer. */
const byTightness = (a: Pick<UsageWindow, "usedPct" | "resetsAt">, b: Pick<UsageWindow, "usedPct" | "resetsAt">) =>
  b.usedPct - a.usedPct || (b.resetsAt?.getTime() ?? 0) - (a.resetsAt?.getTime() ?? 0);

/** The window closest to its limit: the account's headline number. */
export const tightestWindow = (windows: UsageWindow[]) => [...windows].sort(byTightness)[0] ?? null;

export type WindowGroup = { labels: string[]; usedPct: number; resetsAt: Date | null };

/** Resets this close together count as the same reset (vendors stagger per-model quotas by minutes). */
const SAME_RESET_MS = 15 * 60_000;

/**
 * Collapses windows that read the same (equal rounded usage, same reset) into one row, so a provider
 * with a dozen near-identical per-model quotas shows as a few lines. Tightest group first.
 */
export function groupWindows(windows: UsageWindow[]): WindowGroup[] {
  const groups: WindowGroup[] = [];
  for (const w of [...windows].sort(byTightness)) {
    const match = groups.find(
      (g) =>
        Math.round(g.usedPct) === Math.round(w.usedPct) &&
        (g.resetsAt && w.resetsAt
          ? Math.abs(g.resetsAt.getTime() - w.resetsAt.getTime()) <= SAME_RESET_MS
          : g.resetsAt === w.resetsAt),
    );
    if (match) match.labels.push(w.label);
    else groups.push({ labels: [w.label], usedPct: w.usedPct, resetsAt: w.resetsAt });
  }
  return groups;
}

const positiveInt = (raw: unknown) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * The account tab the viewer has open: ?account= on a page load, or the same parameter in
 * HX-Current-URL for htmx fragments (the browser script keeps it in the address bar).
 */
export function requestedAccountId(req: Request): number | null {
  const fromQuery = positiveInt(req.query.account);
  if (fromQuery) return fromQuery;
  const current = req.get("HX-Current-URL");
  if (!current) return null;
  try {
    return positiveInt(new URL(current).searchParams.get("account"));
  } catch {
    return null;
  }
}

/** The requested account if it still exists, otherwise the first one in list order. */
export function selectedAccountId(accounts: Pick<Account, "id">[], requested: number | null): number | null {
  if (requested && accounts.some((a) => a.id === requested)) return requested;
  return accounts[0]?.id ?? null;
}

/** Selection for a single-account fragment, without loading every account. */
export async function isSelected(req: Request, accountId: number): Promise<boolean> {
  const requested = requestedAccountId(req);
  if (requested === accountId) return true;
  if (requested && (await db.account.count({ where: { id: requested } }))) return false;
  const first = await db.account.findFirst({ orderBy: [{ provider: "asc" }, { createdAt: "asc" }], select: { id: true } });
  return first?.id === accountId;
}

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
