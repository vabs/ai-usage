import type { UsageReport, UsageWindow } from "@app/shared";
import { formBody, jsonBody, ProviderError, requestJson } from "./http";
import { createPkce, decodeJwt, expiryFrom, readPastedCode } from "./oauth";
import type { Credentials, ProviderAdapter } from "./types";

// Undocumented: Codex CLI's public OAuth client (openai/codex, codex-rs/login) and the
// ChatGPT backend usage endpoint it calls. Patch here if OpenAI moves them.
const ISSUER = "https://auth.openai.com";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
// A loopback redirect registered for this client. Nothing listens there when we use it:
// the browser shows a "can't connect" page and the user copies the URL from the address bar.
// (Codex also has a device-code flow: auth.openai.com/api/accounts/deviceauth/*.)
const REDIRECT_URI = "http://127.0.0.1:1455/auth/callback";
// The CLI also asks for api.connectors.*; reading usage doesn't need them.
const SCOPES = "openid profile email offline_access";
const ORIGINATOR = "codex_cli_rs";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

type TokenResponse = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

type AuthClaims = { chatgpt_account_id?: string; chatgpt_plan_type?: string };

function claimsFrom(idToken: string | undefined): { email: string | null; accountId: string | null } {
  if (!idToken) return { email: null, accountId: null };
  const payload = decodeJwt(idToken);
  const auth = (payload["https://api.openai.com/auth"] ?? {}) as AuthClaims;
  return {
    email: typeof payload.email === "string" ? payload.email : null,
    accountId: auth.chatgpt_account_id ?? null,
  };
}

function toCredentials(t: TokenResponse, previous?: Credentials): Credentials {
  if (!t.access_token) throw new ProviderError("OpenAI token response had no access_token", "parse");
  const { accountId } = claimsFrom(t.id_token);
  return {
    accessToken: t.access_token,
    // OpenAI rotates refresh tokens: always keep the newest one.
    refreshToken: t.refresh_token ?? previous?.refreshToken ?? "",
    expiresAt: expiryFrom(t.access_token, t.expires_in),
    meta: { ...previous?.meta, ...(accountId ? { accountId } : {}) },
  };
}

type RateWindow = {
  used_percent?: number;
  limit_window_seconds?: number;
  reset_after_seconds?: number;
  /** Epoch seconds. */
  reset_at?: number;
};

type RateLimit = { primary_window?: RateWindow | null; secondary_window?: RateWindow | null } | null;

type UsageBody = {
  plan_type?: string;
  rate_limit?: RateLimit;
  /** Separate limits for metered features (e.g. code review). */
  additional_rate_limits?: Array<{ limit_name?: string; metered_feature?: string; rate_limit?: RateLimit }> | null;
  /** Banked rate-limit resets. Spending one is a separate POST this app never makes. */
  rate_limit_reset_credits?: { available_count?: number } | null;
};

function windowName(seconds: number | undefined, fallback: string): { key: string; label: string } {
  if (seconds === 5 * 3600) return { key: "5h", label: "5-hour" };
  if (seconds === 7 * 86_400) return { key: "weekly", label: "Weekly" };
  if (seconds && seconds % 86_400 === 0) return { key: `${seconds / 86_400}d`, label: `${seconds / 86_400}-day` };
  if (seconds && seconds % 3600 === 0) return { key: `${seconds / 3600}h`, label: `${seconds / 3600}-hour` };
  return { key: fallback, label: fallback };
}

function windowsOf(limit: RateLimit | undefined, now: number, scope?: { key: string; label: string }): UsageWindow[] {
  const windows: UsageWindow[] = [];
  for (const [slot, w] of [
    ["primary", limit?.primary_window],
    ["secondary", limit?.secondary_window],
  ] as const) {
    if (!w || typeof w.used_percent !== "number") continue;
    const resetsAt =
      typeof w.reset_at === "number"
        ? new Date(w.reset_at * 1000)
        : typeof w.reset_after_seconds === "number"
          ? new Date(now + w.reset_after_seconds * 1000)
          : null;
    const name = windowName(w.limit_window_seconds, slot);
    windows.push({
      key: scope ? `${scope.key}:${name.key}` : name.key,
      label: scope ? `${scope.label} · ${name.label}` : name.label,
      usedPct: Math.min(100, Math.max(0, w.used_percent)),
      resetsAt,
    });
  }
  return windows;
}

export function parseCodexUsage(body: unknown, now = Date.now()): UsageReport {
  if (!body || typeof body !== "object") throw new ProviderError("Codex usage response was not an object", "parse");
  const { plan_type, rate_limit, additional_rate_limits, rate_limit_reset_credits } = body as UsageBody;

  const windows = windowsOf(rate_limit, now);
  if (windows.length === 0) throw new ProviderError("Codex usage response had no rate-limit windows", "parse");
  for (const extra of additional_rate_limits ?? []) {
    const name = extra.limit_name ?? extra.metered_feature;
    if (name) windows.push(...windowsOf(extra.rate_limit, now, { key: extra.metered_feature ?? name, label: name }));
  }

  const banked = rate_limit_reset_credits?.available_count;
  return { windows, plan: plan_type ?? null, bankedResets: typeof banked === "number" ? banked : null, raw: body };
}

export const codex: ProviderAdapter = {
  id: "codex",
  pasteHint:
    "After signing in, your browser lands on a 127.0.0.1:1455 page that fails to load. That's expected: copy the full URL from the address bar and paste it here.",

  startAuth() {
    const { verifier, challenge, state } = createPkce();
    const url = new URL(`${ISSUER}/oauth/authorize`);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: "S256",
      id_token_add_organizations: "true",
      codex_cli_simplified_flow: "true",
      originator: ORIGINATOR,
      state,
    }).toString();
    return { url: url.toString(), verifier, state };
  },

  async finishAuth(pasted, pending) {
    const code = readPastedCode(pasted, pending.state);
    const tokens = await requestJson<TokenResponse>(`${ISSUER}/oauth/token`, {
      method: "POST",
      ...formBody({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: pending.verifier,
      }),
    });
    const credentials = toCredentials(tokens);
    if (!credentials.meta.accountId) {
      throw new ProviderError("Signed in, but OpenAI returned no ChatGPT account id. Is this account on a ChatGPT plan?", "auth");
    }
    return { credentials, identity: claimsFrom(tokens.id_token).email };
  },

  async refresh(credentials) {
    const tokens = await requestJson<TokenResponse>(`${ISSUER}/oauth/token`, {
      method: "POST",
      ...jsonBody({ client_id: CLIENT_ID, grant_type: "refresh_token", refresh_token: credentials.refreshToken }),
    });
    return toCredentials(tokens, credentials);
  },

  async fetchUsage(credentials) {
    const body = await requestJson(USAGE_URL, {
      headers: {
        authorization: `Bearer ${credentials.accessToken}`,
        "chatgpt-account-id": credentials.meta.accountId ?? "",
        originator: ORIGINATOR,
        accept: "application/json",
      },
    });
    return parseCodexUsage(body);
  },
};
