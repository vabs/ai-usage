import { type Provider, PROVIDER_NAMES, PROVIDERS } from "@app/shared";
import { env } from "../../config";
import type { AccountWithWindows } from "../../lib/accounts";
import { AccountRow } from "../components/account-row";
import { Layout } from "../layout";

/** Count, expand/collapse controls and one row per account. Renders nothing when there are none (see .empty-state). */
export function AccountList({ accounts, openIds }: { accounts: AccountWithWindows[]; openIds: Set<number> }) {
  if (accounts.length === 0) return <></>;
  return (
    <>
      <div class="list-bar">
        <span safe>{accounts.length === 1 ? "1 account" : `${accounts.length} accounts`}</span>
        <span class="list-bar__actions">
          <button type="button" class="linkish" data-rows="open">
            Expand all
          </button>
          <button type="button" class="linkish" data-rows="close">
            Collapse all
          </button>
        </span>
      </div>
      <div class="subs">
        {accounts.map((account) => (
          <AccountRow account={account} open={openIds.has(account.id)} />
        ))}
      </div>
    </>
  );
}

const CHOICE_HINTS: Record<Provider, string> = {
  claude: "The Pro, Max, Team or Enterprise login you use with Claude Code",
  codex: "The ChatGPT login you use with Codex CLI",
  gemini: "The Google account you use with Gemini CLI",
};

/**
 * Provider picker. Choosing one loads its sign-in steps into #connect-step (GET /connect/:provider
 * answers htmx with just the steps). Without JS the links open the full connect page instead.
 */
function ConnectDialog() {
  return (
    <dialog id="connect-dialog" class="modal" aria-labelledby="connect-title">
      <div class="modal__head">
        <h2 id="connect-title">Connect an account</h2>
        <button type="button" class="modal__close" aria-label="Close" data-dialog-close>
          ×
        </button>
      </div>
      <div id="connect-pick" class="modal__step">
        <p class="modal__intro">
          Sign in with the account you use for each CLI. This app keeps its own login, so the CLIs stay signed in.
        </p>
        <div class="choices">
          {PROVIDERS.map((p) => (
            <a class="choice" href={`/connect/${p}`} hx-get={`/connect/${p}`} hx-target="#connect-step" hx-swap="innerHTML">
              <span class={`choice__name provider--${p}`} safe>
                {PROVIDER_NAMES[p]}
              </span>
              <span class="choice__desc" safe>
                {CHOICE_HINTS[p]}
              </span>
            </a>
          ))}
        </div>
      </div>
      <div id="connect-step" class="modal__step" hidden></div>
    </dialog>
  );
}

export function DashboardPage({ accounts, openIds }: { accounts: AccountWithWindows[]; openIds: Set<number> }) {
  return (
    <Layout
      actions={
        <div class="site-header__actions">
          <button type="button" class="button--quiet" data-connect-open>
            + Connect<span class="hide-sm"> account</span>
          </button>
          {accounts.length ? (
            <button type="button" hx-post="/accounts/refresh" hx-target="#account-list" hx-swap="innerHTML">
              Refresh all
            </button>
          ) : null}
        </div>
      }
    >
      {/* The header carries the visible title; this keeps a page heading for screen readers. */}
      <h1 class="visually-hidden" safe>
        {env.APP_TITLE}
      </h1>

      <div id="account-list" class="accounts">
        <AccountList accounts={accounts} openIds={openIds} />
      </div>
      <div class="empty-state">
        <p>No accounts connected yet.</p>
        <button type="button" data-connect-open>
          + Connect an account
        </button>
      </div>

      <ConnectDialog />
    </Layout>
  );
}
