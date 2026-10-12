import { formatAge, formatCountdown, isProvider, PROVIDER_NAMES } from "@app/shared";
import {
  type AccountWithWindows,
  groupWindows,
  isInFlight,
  isStale,
  levelOf,
  remainingPct,
  STALE_AFTER_MS,
  tightestWindow,
  type WindowGroup,
} from "../../lib/accounts";

type Status = { key: string; text: string };

function statusOf(a: AccountWithWindows, now: number): Status | null {
  if (isInFlight(a, now)) return { key: "refreshing", text: "Refreshing" };
  if (a.lastErrorKind === "auth") return { key: "error", text: "Sign-in expired" };
  if (a.lastError) return { key: "error", text: "Refresh failed" };
  if (isStale(a, now)) return { key: "stale", text: "Out of date" };
  return null;
}

function MeterRow({ group, now }: { group: WindowGroup; now: number }) {
  const remaining = remainingPct(group.usedPct);
  const pct = Math.round(remaining);
  const name = group.labels.join(", ");
  return (
    <li class={`meter meter--${levelOf(remaining)}`}>
      {group.labels.length > 1 ? (
        <span class="meter__label meter__label--group">
          {group.labels.map((label) => (
            <span class="chip" safe>
              {label}
            </span>
          ))}
        </span>
      ) : (
        <span class="meter__label" safe>
          {name}
        </span>
      )}
      <span
        class="meter__bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={String(pct)}
        aria-label={`${name}: ${pct}% left`}
      >
        <span class="meter__fill" style={`width: ${remaining.toFixed(1)}%`}></span>
      </span>
      <span class="meter__pct">{pct}% left</span>
      <span class="meter__reset">
        {group.resetsAt ? (
          <>
            {"resets in "}
            <time datetime={group.resetsAt.toISOString()} data-countdown safe>
              {formatCountdown(group.resetsAt.getTime() - now)}
            </time>
          </>
        ) : (
          "no reset time"
        )}
      </span>
    </li>
  );
}

/** Opens the connect dialog on the reconnect form for this account (a plain page without JS). */
function ReconnectLink({ account: a }: { account: AccountWithWindows }) {
  const href = `/connect/${a.provider}?account=${a.id}`;
  return (
    <a href={href} hx-get={href} hx-target="#connect-step" hx-swap="innerHTML" data-connect-open>
      Reconnect
    </a>
  );
}

/**
 * What goes inside a row: the folded summary and the detail under it. Polls and refreshes swap
 * only this, so the <details> around it keeps the viewer's open/closed state. The detail polls
 * (every second while a refresh runs, every minute otherwise), open or not, so the summary stays
 * current.
 */
export function AccountRowContent({ account: a }: { account: AccountWithWindows }) {
  const now = Date.now();
  const name = isProvider(a.provider) ? PROVIDER_NAMES[a.provider] : a.provider;
  const tight = tightestWindow(a.windows);
  const remaining = tight ? remainingPct(tight.usedPct) : null;
  const level = remaining === null ? "none" : levelOf(remaining);
  const status = statusOf(a, now);
  const stale = isStale(a, now) ? " is-stale" : "";
  const inFlight = isInFlight(a, now);
  const needsReconnect = a.lastErrorKind === "auth";
  const groups = groupWindows(a.windows);
  // countdown.ts flips is-stale on these once the data ages past the threshold.
  const staleWatch = { "data-stale-after": String(STALE_AFTER_MS), "data-updated-at": a.lastOkAt?.toISOString() };

  return (
    <>
      {/* An id lets htmx put keyboard focus back on the summary after a swap. */}
      <summary id={`account-${a.id}-head`} class={`sub__head sub__head--${level}${stale}`} {...staleWatch}>
        <span class="sub__chev" aria-hidden="true"></span>
        <span class="sub__who">
          <span class={`sub__provider provider--${a.provider}`} safe>
            {name}
          </span>
          <span class="sub__label" safe>
            {a.label}
          </span>
          {a.plan ? (
            <span class="tag" safe>
              {a.plan}
            </span>
          ) : null}
          {status ? (
            <span class={`pill pill--${status.key}`} safe>
              {status.text}
            </span>
          ) : null}
        </span>
        {remaining !== null ? (
          <>
            <span class="sub__reading">
              <span class="sub__pct">{Math.round(remaining)}</span>
              <span class="sub__unit">% left</span>
            </span>
            <span class="sub__fuel" aria-hidden="true">
              <span style={`width: ${remaining.toFixed(1)}%`}></span>
            </span>
          </>
        ) : (
          <span class="sub__reading sub__reading--none">{needsReconnect ? "Sign in again" : "No data yet"}</span>
        )}
        <span class="sub__window">
          {tight ? (
            <>
              <span safe>{tight.label}</span>
              {tight.resetsAt ? (
                <>
                  {" · resets in "}
                  <time datetime={tight.resetsAt.toISOString()} data-countdown safe>
                    {formatCountdown(tight.resetsAt.getTime() - now)}
                  </time>
                </>
              ) : null}
            </>
          ) : null}
        </span>
      </summary>

      <div
        class={`sub__body${stale}`}
        {...staleWatch}
        hx-get={`/accounts/${a.id}`}
        hx-trigger={inFlight ? "every 1s" : "every 60s"}
        hx-target="closest details"
        hx-swap="innerHTML"
      >
        <div class="sub__bar">
          <p class="sub__meta">
            {a.bankedResets !== null ? (
              <span class="tag tag--banked">
                {a.bankedResets} banked {a.bankedResets === 1 ? "reset" : "resets"}
              </span>
            ) : null}
            {inFlight ? (
              <span class="status status--running">Refreshing…</span>
            ) : a.lastOkAt ? (
              <span class="status status--age">
                Updated{" "}
                <time datetime={a.lastOkAt.toISOString()} data-age safe>
                  {formatAge(now - a.lastOkAt.getTime())}
                </time>
              </span>
            ) : (
              <span class="status">Not collected yet</span>
            )}
          </p>
          <div class="sub__actions">
            <button
              type="button"
              class="button--quiet"
              hx-post={`/accounts/${a.id}/refresh`}
              hx-target="closest details"
              hx-swap="innerHTML"
              disabled={inFlight}
            >
              Refresh
            </button>
            <details class="menu">
              <summary aria-label="More actions">⋯</summary>
              <div class="menu__items">
                <ReconnectLink account={a} />
                <a href={`/accounts/${a.id}/raw`} target="_blank" rel="noopener">
                  Raw response
                </a>
                <button
                  type="button"
                  class="button--danger"
                  hx-delete={`/accounts/${a.id}`}
                  hx-target="#account-list"
                  hx-swap="innerHTML"
                  hx-confirm="Disconnect this account? Its stored tokens and history are deleted."
                >
                  Disconnect
                </button>
              </div>
            </details>
          </div>
        </div>

        {a.lastError ? (
          <p class="sub__error" role="status">
            <span safe>{needsReconnect ? "Sign-in expired or revoked." : a.lastError}</span>
            {needsReconnect ? (
              <>
                {" "}
                <ReconnectLink account={a} />
              </>
            ) : null}
          </p>
        ) : null}

        {groups.length ? (
          <ul class="meters">
            {groups.map((group) => (
              <MeterRow group={group} now={now} />
            ))}
          </ul>
        ) : (
          <p class="sub__empty">
            {needsReconnect ? "No usage yet. Reconnect to start collecting." : "No usage yet. Refresh to collect it now."}
          </p>
        )}
      </div>
    </>
  );
}

/** One connected account as a folding row. */
export function AccountRow({ account, open }: { account: AccountWithWindows; open: boolean }) {
  return (
    <details id={`account-${account.id}`} class="sub" open={open} data-account={String(account.id)}>
      <AccountRowContent account={account} />
    </details>
  );
}
