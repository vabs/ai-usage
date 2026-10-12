import { db } from "@app/db";
import { ADAPTERS, ProviderError, sealCredentials } from "@app/providers";
import { isProvider, PROVIDER_NAMES, type Provider } from "@app/shared";
import { Router } from "express";
import { z } from "zod";
import { sealer } from "../config";
import { HttpError, notFound } from "../lib/http-error";
import { logger } from "../lib/logger";
import { requestCollect } from "../lib/queue";
import { ConnectForm, ConnectPage } from "../views/pages/connect";

export const connectRouter = Router();

function providerParam(raw: string): Provider {
  if (!isProvider(raw)) throw notFound("Provider");
  return raw;
}

const finishBody = z.object({
  state: z.string().min(1),
  pasted: z.string().trim().min(1, "Paste the code or URL from the sign-in page."),
  label: z.string().trim().max(60).optional(),
});

/** Step 1: start a PKCE login and show the vendor link plus a paste box. */
connectRouter.get("/:provider", async (req, res) => {
  const provider = providerParam(req.params.provider);
  const reconnectId = req.query.account ? Number(req.query.account) : null;
  if (reconnectId !== null) {
    const exists = Number.isInteger(reconnectId) && (await db.account.count({ where: { id: reconnectId, provider } }));
    if (!exists) throw notFound("Account");
  }

  const problem = ADAPTERS[provider].configError?.();
  if (problem) throw new HttpError(503, problem);

  const { url, state, verifier } = ADAPTERS[provider].startAuth();
  await db.pendingAuth.create({ data: { state, verifier, provider, accountId: reconnectId } });

  res.set("Cache-Control", "no-store");
  await res.html(
    <ConnectPage
      provider={provider}
      authUrl={url}
      state={state}
      pasteHint={ADAPTERS[provider].pasteHint}
      fields={ADAPTERS[provider].connectFields}
      reconnecting={reconnectId !== null}
    />,
  );
});

/** Step 2: exchange the pasted code for tokens and store the account. */
connectRouter.post("/:provider", async (req, res) => {
  const provider = providerParam(req.params.provider);
  const adapter = ADAPTERS[provider];
  const parsed = finishBody.safeParse(req.body ?? {});
  const state = typeof req.body?.state === "string" ? req.body.state : "";
  const pending = state ? await db.pendingAuth.findUnique({ where: { state } }) : null;
  if (!pending || pending.provider !== provider) {
    throw new HttpError(400, "This sign-in attempt expired. Start again from the dashboard.");
  }

  const fields = Object.fromEntries(
    (adapter.connectFields ?? []).map((f) => [f.name, String(req.body?.[f.name] ?? "").trim()]),
  );

  const showError = (error: string) => {
    res.hx.retarget("#connect-form").reswap("outerHTML");
    return res.html(
      <ConnectForm
        provider={provider}
        state={pending.state}
        pasteHint={adapter.pasteHint}
        fields={adapter.connectFields}
        values={fields}
        reconnecting={pending.accountId !== null}
        label={String(req.body?.label ?? "")}
        pasted={String(req.body?.pasted ?? "")}
        error={error}
      />,
      422,
    );
  };

  if (!parsed.success) return showError(parsed.error.issues[0]?.message ?? "Check the form and try again.");

  let connected;
  try {
    connected = await adapter.finishAuth(parsed.data.pasted, pending, fields);
  } catch (err) {
    if (!(err instanceof ProviderError)) throw err;
    logger.warn(`Connect ${provider} failed`, { kind: err.kind, status: err.status, err: err.message });
    // Codes are single-use: after a failed sign-in the user needs a new one. "parse" errors are
    // usually a typo in the paste or a form field, caught before the code is used.
    return showError(
      err.kind === "parse"
        ? err.message
        : `${PROVIDER_NAMES[provider]} sign-in failed: ${err.message.replace(/\.$/, "")}. Open the sign-in link again and paste the new code.`,
    );
  }

  const credentials = sealCredentials(sealer, connected.credentials);
  const resetState = { status: "idle", lastError: null, lastErrorKind: null };
  const account = pending.accountId
    ? await db.account.update({ where: { id: pending.accountId }, data: { credentials, ...resetState } })
    : await db.account.create({
        data: {
          provider,
          label: parsed.data.label || connected.identity || `${PROVIDER_NAMES[provider]} account`,
          credentials,
        },
      });
  await db.pendingAuth.delete({ where: { state: pending.state } });

  await requestCollect(account.id);
  if (!req.htmx.isHtmx) return res.redirect(303, "/");
  res.hx.redirect("/");
  res.status(204).end();
});
