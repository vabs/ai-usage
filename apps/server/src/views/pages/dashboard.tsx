import { PROVIDER_NAMES, PROVIDERS } from "@app/shared";
import type { AccountWithWindows } from "../../lib/accounts";
import { AccountCard } from "../components/account-card";
import { Layout } from "../layout";

export function AccountList({ accounts }: { accounts: AccountWithWindows[] }) {
  return (
    <>
      {accounts.map((account) => (
        <AccountCard account={account} />
      ))}
    </>
  );
}

export function DashboardPage({ accounts }: { accounts: AccountWithWindows[] }) {
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

      <ul id="account-list" class="cards">
        <AccountList accounts={accounts} />
      </ul>
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
