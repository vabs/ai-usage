import { type Provider, PROVIDER_NAMES } from "@app/shared";
import { Layout } from "../layout";

type ConnectFormProps = {
  provider: Provider;
  state: string;
  pasteHint: string;
  label?: string;
  reconnecting: boolean;
  error?: string;
  pasted?: string;
};

export function ConnectForm({ provider, state, pasteHint, label = "", reconnecting, error, pasted = "" }: ConnectFormProps) {
  return (
    <form
      id="connect-form"
      class="connect-form"
      action={`/connect/${provider}`}
      method="post"
      hx-post={`/connect/${provider}`}
      hx-disabled-elt="find button"
    >
      <input type="hidden" name="state" value={state} />
      <label for="pasted">2. Paste the code</label>
      <input
        id="pasted"
        name="pasted"
        type="text"
        value={pasted}
        autocomplete="off"
        spellcheck="false"
        required
        aria-invalid={error ? "true" : undefined}
        aria-describedby="pasted-hint"
      />
      <p id="pasted-hint" class="hint" safe>
        {pasteHint}
      </p>
      {reconnecting ? null : (
        <>
          <label for="label">Name (optional)</label>
          <input id="label" name="label" type="text" value={label} maxlength="60" autocomplete="off" />
          <p class="hint">Defaults to the account's email.</p>
        </>
      )}
      {error ? (
        <p class="field-error" role="alert" safe>
          {error}
        </p>
      ) : null}
      <button type="submit">{reconnecting ? "Reconnect" : "Connect"}</button>
    </form>
  );
}

type ConnectPageProps = Omit<ConnectFormProps, "error" | "pasted"> & { authUrl: string };

export function ConnectPage({ authUrl, ...form }: ConnectPageProps) {
  const name = PROVIDER_NAMES[form.provider];
  return (
    <Layout title={`Connect ${name}`}>
      <section class="intro">
        <h1 safe>{`${form.reconnecting ? "Reconnect" : "Connect"} ${name}`}</h1>
        <p safe>
          {`You sign in on ${name}'s own page. This app never sees your password; it receives tokens that can read your usage, stores them encrypted, and refreshes them on its own.`}
        </p>
      </section>
      <ol class="steps">
        <li>
          <p class="step-title">1. Sign in</p>
          <a class="button" href={authUrl} target="_blank" rel="noopener noreferrer" safe>
            {`Open ${name} sign-in`}
          </a>
        </li>
        <li>
          <ConnectForm {...form} />
        </li>
      </ol>
      <p>
        <a href="/">Cancel</a>
      </p>
    </Layout>
  );
}
