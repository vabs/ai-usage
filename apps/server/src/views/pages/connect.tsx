import type { ConnectField } from "@app/providers";
import { type Provider, PROVIDER_NAMES } from "@app/shared";
import { Layout } from "../layout";

type ConnectFormProps = {
  provider: Provider;
  state: string;
  pasteHint: string;
  fields?: ConnectField[];
  values?: Record<string, string>;
  label?: string;
  reconnecting: boolean;
  error?: string;
  pasted?: string;
};

export function ConnectForm({
  provider,
  state,
  pasteHint,
  fields = [],
  values = {},
  label = "",
  reconnecting,
  error,
  pasted = "",
}: ConnectFormProps) {
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
      {fields.map((f) => (
        <>
          <label for={`field-${f.name}`} safe>
            {f.label}
          </label>
          <input
            id={`field-${f.name}`}
            name={f.name}
            type="text"
            value={values[f.name] ?? ""}
            autocomplete="off"
            spellcheck="false"
            aria-describedby={`field-${f.name}-hint`}
          />
          <p id={`field-${f.name}-hint`} class="hint" safe>
            {f.hint}
          </p>
        </>
      ))}
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
      <div class="form-foot">
        {/* Only shown in the connect dialog: back to the provider list, or closes it when reconnecting. */}
        <button type="button" class="button--quiet" data-connect-back={reconnecting ? "close" : "pick"}>
          {reconnecting ? "Cancel" : "Back"}
        </button>
        <button type="submit">{reconnecting ? "Reconnect" : "Connect"}</button>
      </div>
    </form>
  );
}

type ConnectPageProps = Omit<ConnectFormProps, "error" | "pasted"> & { authUrl: string };

const headingOf = ({ provider, reconnecting }: ConnectPageProps) =>
  `${reconnecting ? "Reconnect" : "Connect"} ${PROVIDER_NAMES[provider]}`;

const introOf = ({ provider }: ConnectPageProps) => {
  const name = PROVIDER_NAMES[provider];
  return `You sign in on ${name}'s own page. This app never sees your password; it receives tokens that can read your usage, stores them encrypted, and refreshes them on its own.`;
};

function ConnectSteps({ authUrl, ...form }: ConnectPageProps) {
  return (
    <ol class="steps">
      <li>
        <p class="step-title">1. Sign in</p>
        <a class="button" href={authUrl} target="_blank" rel="noopener noreferrer" safe>
          {`Open ${PROVIDER_NAMES[form.provider]} sign-in`}
        </a>
      </li>
      <li>
        <ConnectForm {...form} />
      </li>
    </ol>
  );
}

/** The same steps for the dashboard's connect dialog. Swaps the dialog title out-of-band. */
export function ConnectStep(props: ConnectPageProps) {
  return (
    <>
      <h2 id="connect-title" hx-swap-oob="true" safe>
        {headingOf(props)}
      </h2>
      <p class="modal__intro" safe>
        {introOf(props)}
      </p>
      <ConnectSteps {...props} />
    </>
  );
}

export function ConnectPage(props: ConnectPageProps) {
  const heading = headingOf(props);
  return (
    <Layout title={heading}>
      <section class="intro">
        <h1 safe>{heading}</h1>
        <p safe>{introOf(props)}</p>
      </section>
      <ConnectSteps {...props} />
      <p>
        <a href="/">Cancel</a>
      </p>
    </Layout>
  );
}
