import { PROVIDER_NAMES, PROVIDERS } from "@app/shared";
import type { AccountWithWindows } from "../../lib/accounts";
import { AccountPanel } from "../components/account-panel";
import { AccountTab } from "../components/account-tab";
import { Layout } from "../layout";

/** Tab strip plus one panel per account. Renders nothing when there are no accounts (see .empty-state). */
export function AccountList({ accounts, selectedId }: { accounts: AccountWithWindows[]; selectedId: number | null }) {
  if (accounts.length === 0) return <></>;
  return (
    <>
      <div class="tabs" role="tablist" aria-label="Connected accounts">
        {accounts.map((account) => (
          <AccountTab account={account} selected={account.id === selectedId} />
        ))}
      </div>
      {accounts.map((account) => (
        <AccountPanel account={account} selected={account.id === selectedId} />
      ))}
    </>
  );
}

export function DashboardPage({ accounts, selectedId }: { accounts: AccountWithWindows[]; selectedId: number | null }) {
  return (
    <Layout>
      <section class="toolbar">
        <h1>Usage</h1>
        {accounts.length ? (
          <button type="button" hx-post="/accounts/refresh" hx-target="#account-list" hx-swap="innerHTML">
            Refresh all
          </button>
        ) : null}
      </section>

      <div id="account-list" class="accounts">
        <AccountList accounts={accounts} selectedId={selectedId} />
      </div>
      <p class="empty-state">No accounts connected yet. Connect one below.</p>

      <section class="connect">
        <h2>Connect an account</h2>
        <p class="connect__intro">
          Sign in with the account you use for each CLI. This app keeps its own login, so the CLIs stay signed in.
        </p>
        <div class="connect__buttons">
          {PROVIDERS.map((p) => (
            <a class="button button--quiet" href={`/connect/${p}`} safe>
              {`+ ${PROVIDER_NAMES[p]}`}
            </a>
          ))}
        </div>
      </section>
    </Layout>
  );
}
