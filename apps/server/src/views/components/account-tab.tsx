import { formatCountdown, isProvider, PROVIDER_NAMES } from "@app/shared";
import {
  type AccountWithWindows,
  isInFlight,
  isStale,
  levelOf,
  remainingPct,
  STALE_AFTER_MS,
  tightestWindow,
} from "../../lib/accounts";

type Status = { key: string; text: string };

function statusOf(a: AccountWithWindows, now: number): Status | null {
  if (isInFlight(a, now)) return { key: "refreshing", text: "Refreshing" };
  if (a.lastErrorKind === "auth") return { key: "error", text: "Sign-in expired" };
  if (a.lastError) return { key: "error", text: "Last refresh failed" };
  if (isStale(a, now)) return { key: "stale", text: "Data is out of date" };
  return null;
}

/**
 * One gauge in the tab strip: provider, account, and how much of its tightest window is left.
 * Rendered out-of-band next to every panel fragment so polling keeps the strip current.
 */
export function AccountTab({ account: a, selected, oob = false }: { account: AccountWithWindows; selected: boolean; oob?: boolean }) {
  const now = Date.now();
  const tight = tightestWindow(a.windows);
  const remaining = tight ? remainingPct(tight.usedPct) : null;
  const level = remaining === null ? "none" : levelOf(remaining);
  const status = statusOf(a, now);
  const name = isProvider(a.provider) ? PROVIDER_NAMES[a.provider] : a.provider;

  // A real link, so the tab works without JavaScript (full page load with ?account=).
  // hx-boost="false": tabs.ts switches instantly instead of fetching the page.
  return (
    <a
      id={`tab-${a.id}`}
      role="tab"
      href={`/?account=${a.id}`}
      hx-boost="false"
      hx-swap-oob={oob ? "true" : undefined}
      aria-selected={selected ? "true" : "false"}
      aria-controls={`panel-${a.id}`}
      tabindex={selected ? "0" : "-1"}
      class={`tab tab--${level}${isStale(a, now) ? " is-stale" : ""}`}
      data-account={String(a.id)}
      data-stale-after={String(STALE_AFTER_MS)}
      data-updated-at={a.lastOkAt?.toISOString()}
    >
      <span class="tab__head">
        <span class={`tab__provider provider--${a.provider}`} safe>
          {name}
        </span>
        {status ? (
          <span class={`tab__status tab__status--${status.key}`} title={status.text}>
            <span class="visually-hidden" safe>
              {status.text}
            </span>
          </span>
        ) : null}
      </span>
      <span class="tab__label" safe>
        {a.label}
      </span>
      {remaining !== null ? (
        <span class="tab__reading">
          <span class="tab__pct">{Math.round(remaining)}</span>
          <span class="tab__unit">% left</span>
        </span>
      ) : (
        <span class="tab__reading tab__reading--none">
          {a.lastErrorKind === "auth" ? "Sign in again" : "No data yet"}
        </span>
      )}
      <span class="tab__fuel" aria-hidden="true">
        <span style={`width: ${(remaining ?? 0).toFixed(1)}%`}></span>
      </span>
      {tight ? (
        <span class="tab__window">
          <span safe>{tight.label}</span>
          {tight.resetsAt ? (
            <>
              {" resets in "}
              <time datetime={tight.resetsAt.toISOString()} data-countdown safe>
                {formatCountdown(tight.resetsAt.getTime() - now)}
              </time>
            </>
          ) : null}
        </span>
      ) : null}
    </a>
  );
}
