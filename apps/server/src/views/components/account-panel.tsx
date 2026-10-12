import { formatAge, formatCountdown, isProvider, PROVIDER_NAMES } from "@app/shared";
import {
  type AccountWithWindows,
  groupWindows,
  isInFlight,
  isStale,
  levelOf,
  remainingPct,
  STALE_AFTER_MS,
  type WindowGroup,
} from "../../lib/accounts";
import { AccountTab } from "./account-tab";

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

/**
 * Detail for one account. It polls itself (every second while a refresh runs, every minute
 * otherwise); the server answers with this panel plus its tab out-of-band.
 */
export function AccountPanel({ account: a, selected }: { account: AccountWithWindows; selected: boolean }) {
  const now = Date.now();
  const inFlight = isInFlight(a, now);
  const name = isProvider(a.provider) ? PROVIDER_NAMES[a.provider] : a.provider;
  const needsReconnect = a.lastErrorKind === "auth";
  const groups = groupWindows(a.windows);

  return (
    <section
      id={`panel-${a.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${a.id}`}
      class={`panel${isStale(a, now) ? " is-stale" : ""}`}
      hidden={!selected}
      data-account={String(a.id)}
      data-stale-after={String(STALE_AFTER_MS)}
      data-updated-at={a.lastOkAt?.toISOString()}
      hx-get={`/accounts/${a.id}`}
      hx-trigger={inFlight ? "every 1s" : "every 60s"}
      hx-swap="outerHTML"
    >
      <header class="panel__head">
        <div class="panel__title">
          <h2>
            <span class={`provider provider--${a.provider}`} safe>
              {name}
            </span>{" "}
            <span class="panel__label" safe>
              {a.label}
            </span>
          </h2>
          <p class="panel__meta">
            {a.plan ? (
              <span class="tag" safe>
                {a.plan}
              </span>
            ) : null}
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
        </div>
        <div class="panel__actions">
          <button
            id={`refresh-${a.id}`}
            type="button"
            hx-post={`/accounts/${a.id}/refresh`}
            hx-target={`#panel-${a.id}`}
            hx-swap="outerHTML"
            disabled={inFlight}
          >
            Refresh
          </button>
          <details class="menu">
            <summary aria-label="More actions">⋯</summary>
            <div class="menu__items">
              <a href={`/connect/${a.provider}?account=${a.id}`}>Reconnect</a>
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
      </header>

      {a.lastError ? (
        <p class="panel__error" role="status">
          <span safe>{needsReconnect ? "Sign-in expired or revoked." : a.lastError}</span>
          {needsReconnect ? (
            <>
              {" "}
              <a href={`/connect/${a.provider}?account=${a.id}`}>Reconnect</a>
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
        <p class="panel__empty">
          {needsReconnect ? "No usage yet. Reconnect to start collecting." : "No usage yet. Refresh to collect it now."}
        </p>
      )}
    </section>
  );
}

/** A polled or refreshed account: the panel, plus its tab swapped out-of-band. */
export function AccountFragment({ account, selected }: { account: AccountWithWindows; selected: boolean }) {
  return (
    <>
      <AccountPanel account={account} selected={selected} />
      <AccountTab account={account} selected={selected} oob />
    </>
  );
}
