import type { UsageReport, UsageWindow } from "@app/shared";
import { jsonBody, ProviderError, requestJson } from "./http";
import { createPkce, expiryFrom, readPastedCode } from "./oauth";
import type { Credentials, ProviderAdapter } from "./types";

// Undocumented: Claude Code's public OAuth client and the usage endpoint it calls.
// Patch here if Anthropic moves them.
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
// Anthropic's "copy this code" page, so no local callback server is needed.
const REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
// user:profile is what the usage endpoint checks. We never ask for inference or API-key scopes,
// so a leaked token can read usage and nothing else. (Claude Code itself asks for six scopes.)
const SCOPES = "user:profile";
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const OAUTH_BETA = "oauth-2025-04-20";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  account?: { email_address?: string };
};

const toCredentials = (t: TokenResponse, previous?: Credentials): Credentials => ({
  accessToken: t.access_token,
  refreshToken: t.refresh_token ?? previous?.refreshToken ?? "",
  expiresAt: expiryFrom(t.access_token, t.expires_in),
  meta: previous?.meta ?? {},
});

/** "five_hour" -> "5h", "seven_day" -> "weekly", "seven_day_opus" -> "weekly:opus". */
function windowKey(name: string): { key: string; label: string } {
  if (name === "five_hour") return { key: "5h", label: "5-hour" };
  if (name === "seven_day") return { key: "weekly", label: "Weekly" };
  const scoped = /^seven_day_(.+)$/.exec(name);
  if (scoped?.[1]) {
    const scope = scoped[1].replace(/_/g, " ");
    return { key: `weekly:${scoped[1]}`, label: `Weekly · ${scope[0]!.toUpperCase()}${scope.slice(1)}` };
  }
  return { key: name, label: name.replace(/_/g, " ") };
}

type CedarEmber = { eligible?: boolean; grants?: Array<{ resets_left?: number; paused?: boolean }> };

/** Banked "reset for free" credits, only present when requested with ?cedar_ember=1. */
function bankedResets(cedar: CedarEmber | null | undefined): number | null {
  if (!cedar?.eligible || !Array.isArray(cedar.grants)) return null;
  return cedar.grants.reduce((sum, g) => sum + (!g.paused && typeof g.resets_left === "number" ? g.resets_left : 0), 0);
}

/**
 * Every top-level `{ utilization, resets_at }` object is a window, so windows Anthropic
 * adds later show up without a code change. Null entries are windows that don't apply.
 */
export function parseClaudeUsage(body: unknown): UsageReport {
  if (!body || typeof body !== "object") throw new ProviderError("Claude usage response was not an object", "parse");
  const fields = body as Record<string, unknown>;
  const windows: UsageWindow[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const { utilization, resets_at, is_enabled } = value as { utilization?: unknown; resets_at?: unknown; is_enabled?: unknown };
    if (typeof utilization !== "number") continue;
    // Pay-as-you-go overage: only a limit when switched on.
    if (name === "extra_usage" && is_enabled !== true) continue;
    windows.push({
      ...(name === "extra_usage" ? { key: "extra", label: "Extra usage" } : windowKey(name)),
      usedPct: Math.min(100, Math.max(0, utilization)),
      resetsAt: typeof resets_at === "string" ? new Date(resets_at) : null,
    });
  }
  if (windows.length === 0) throw new ProviderError("Claude usage response had no windows", "parse");
  return { windows, plan: null, bankedResets: bankedResets(fields.cedar_ember as CedarEmber), raw: body };
}

export const claude: ProviderAdapter = {
  id: "claude",
  pasteHint: "After approving, Anthropic shows a code. Copy all of it (it contains a #) and paste it here.",

  startAuth() {
    const { verifier, challenge, state } = createPkce();
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      code: "true",
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    }).toString();
    return { url: url.toString(), verifier, state };
  },

  async finishAuth(pasted, pending) {
    const code = readPastedCode(pasted, pending.state);
    const tokens = await requestJson<TokenResponse>(TOKEN_URL, {
      method: "POST",
      ...jsonBody({
        grant_type: "authorization_code",
        code,
        state: pending.state,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: pending.verifier,
      }),
    });
    return { credentials: toCredentials(tokens), identity: tokens.account?.email_address ?? null };
  },

  async refresh(credentials) {
    const tokens = await requestJson<TokenResponse>(TOKEN_URL, {
      method: "POST",
      ...jsonBody({ grant_type: "refresh_token", refresh_token: credentials.refreshToken, client_id: CLIENT_ID }),
    });
    return toCredentials(tokens, credentials);
  },

  async fetchUsage(credentials) {
    const init = {
      headers: {
        authorization: `Bearer ${credentials.accessToken}`,
        "anthropic-beta": OAUTH_BETA,
        accept: "application/json",
      },
    };
    try {
      // ?cedar_ember=1 adds the banked-resets inventory. Not every account accepts it.
      return parseClaudeUsage(await requestJson(`${USAGE_URL}?cedar_ember=1`, init));
    } catch (err) {
      if (!(err instanceof ProviderError) || (err.status !== 400 && err.status !== 403)) throw err;
      return parseClaudeUsage(await requestJson(USAGE_URL, init));
    }
  },
};
