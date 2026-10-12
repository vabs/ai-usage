import type { UsageWindow } from "@app/db";
import { formatAge, formatCountdown, isProvider, PROVIDER_NAMES } from "@app/shared";
import { type AccountWithWindows, isInFlight, isStale, STALE_AFTER_MS } from "../../lib/accounts";

const level = (pct: number) => (pct >= 90 ? "high" : pct >= 70 ? "mid" : "low");

function WindowRow({ window: w, now }: { window: UsageWindow; now: number }) {
  const pct = Math.round(w.usedPct);
  return (
    <li class="window">
      <div class="window__head">
        <span class="window__label" safe>
          {w.label}
        </span>
        <span class="window__pct">{pct}%</span>
      </div>
      <div
        class={`bar bar--${level(w.usedPct)}`}
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={String(pct)}
        aria-label={`${w.label} used`}
      >
        <span class="bar__fill" style={`width: ${Math.min(100, Math.max(0, w.usedPct)).toFixed(1)}%`}></span>
      </div>
      {w.resetsAt ? (
        <div class="window__reset">
          Resets in{" "}
          <time datetime={w.resetsAt.toISOString()} data-countdown safe>
            {formatCountdown(w.resetsAt.getTime() - now)}
          </time>
        </div>
      ) : null}
    </li>
  );
}

export function AccountCard({ account: a }: { account: AccountWithWindows }) {
  const now = Date.now();
  const inFlight = isInFlight(a, now);
  const stale = isStale(a, now);
  const name = isProvider(a.provider) ? PROVIDER_NAMES[a.provider] : a.provider;
  const needsReconnect = a.lastErrorKind === "auth";

  // Polls itself: every second while a collection runs, otherwise every minute to pick up
  // scheduled collections. The re-rendered card decides the next interval.
  return (
    <li
      id={`account-${a.id}`}
      class={`card${stale ? " is-stale" : ""}`}
      data-stale-after={String(STALE_AFTER_MS)}
      hx-get={`/accounts/${a.id}`}
      hx-trigger={inFlight ? "every 1s" : "every 60s"}
      hx-swap="outerHTML"
    >
      <header class="card__head">
        <div>
          <h2 class="card__title">
            <span class={`provider provider--${a.provider}`} safe>
              {name}
            </span>{" "}
            <span class="card__label" safe>
              {a.label}
            </span>
          </h2>
          <p class="card__meta">
            {a.plan ? (
              <span class="tag" safe>
                {a.plan}
              </span>
            ) : null}
            {a.bankedResets !== null ? <span class="tag">{a.bankedResets} banked resets</span> : null}
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
        <div class="card__actions">
          <button
            type="button"
            hx-post={`/accounts/${a.id}/refresh`}
            hx-target="closest li"
            hx-swap="outerHTML"
            disabled={inFlight}
          >
            Refresh
          </button>
          <details class="menu">
            <summary class="button--quiet" aria-label="More actions">
              ⋯
            </summary>
            <div class="menu__items">
              <a href={`/connect/${a.provider}?account=${a.id}`}>Reconnect</a>
              <a href={`/accounts/${a.id}/raw`} target="_blank" rel="noopener">
                Raw response
              </a>
              <button
                type="button"
                class="button--danger"
                hx-delete={`/accounts/${a.id}`}
                hx-target="closest li.card"
                hx-swap="outerHTML"
                hx-confirm="Disconnect this account? Its stored tokens and history are deleted."
              >
                Disconnect
              </button>
            </div>
          </details>
        </div>
      </header>

      {a.lastError ? (
        <p class={`card__error${needsReconnect ? " card__error--auth" : ""}`}>
          <span safe>{needsReconnect ? "Sign-in expired or revoked." : a.lastError}</span>
          {needsReconnect ? (
            <>
              {" "}
              <a href={`/connect/${a.provider}?account=${a.id}`}>Reconnect</a>
            </>
          ) : null}
        </p>
      ) : null}

      {a.windows.length ? (
        <ul class="windows">
          {a.windows.map((w) => (
            <WindowRow window={w} now={now} />
          ))}
        </ul>
      ) : (
        <p class="card__empty">No usage data yet.</p>
      )}
    </li>
  );
}
