import type { UsageReport, UsageWindow } from "@app/shared";
import { formBody, jsonBody, ProviderError, requestJson } from "./http";
import { createPkce, expiryFrom, readPastedCode } from "./oauth";
import type { Credentials, ProviderAdapter } from "./types";

// Undocumented: Gemini CLI's public "installed app" OAuth client and the internal Code Assist
// API it calls. The client id/secret come from the environment so they stay out of git: copy
// OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET from google-gemini/gemini-cli,
// packages/core/src/code_assist/oauth2.ts.
const MISSING_CLIENT =
  "Gemini needs GEMINI_OAUTH_CLIENT_ID and GEMINI_OAUTH_CLIENT_SECRET (from gemini-cli's packages/core/src/code_assist/oauth2.ts) in .env.";

function geminiClient(): { id: string; secret: string } {
  const id = process.env.GEMINI_OAUTH_CLIENT_ID;
  const secret = process.env.GEMINI_OAUTH_CLIENT_SECRET;
  if (!id || !secret) throw new Error(MISSING_CLIENT);
  return { id, secret };
}
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
// Gemini CLI's no-browser flow: Google shows the code on this page for copying.
const REDIRECT_URI = "https://codeassist.google.com/authcode";
const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CODE_ASSIST = "https://cloudcode-pa.googleapis.com/v1internal";

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

const bearer = (c: Pick<Credentials, "accessToken">) => ({ authorization: `Bearer ${c.accessToken}` });

/** Code Assist routes every call through a Google Cloud project; free-tier users get a managed one. */
async function loadProject(accessToken: string): Promise<{ projectId: string; tier: string | null }> {
  const res = await requestJson<{ cloudaicompanionProject?: string | { id?: string }; currentTier?: { id?: string } }>(
    `${CODE_ASSIST}:loadCodeAssist`,
    {
      method: "POST",
      ...jsonBody(
        { metadata: { ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" } },
        bearer({ accessToken }),
      ),
    },
  );
  const project = res.cloudaicompanionProject;
  const projectId = typeof project === "string" ? project : project?.id;
  if (!projectId) {
    throw new ProviderError("Google returned no Code Assist project. Run `gemini` once with this account to finish onboarding.", "auth");
  }
  return { projectId, tier: res.currentTier?.id ?? null };
}

type QuotaBody = {
  buckets?: Array<{ modelId?: string; tokenType?: string; remainingFraction?: number; resetTime?: string }>;
};

export function parseGeminiUsage(body: unknown, plan: string | null = null): UsageReport {
  if (!body || typeof body !== "object") throw new ProviderError("Gemini quota response was not an object", "parse");
  const buckets = (body as QuotaBody).buckets ?? [];
  const multipleTypes = new Set(buckets.map((b) => b.tokenType)).size > 1;

  const windows: UsageWindow[] = [];
  for (const b of buckets) {
    if (!b.modelId || typeof b.remainingFraction !== "number") continue;
    const suffix = multipleTypes && b.tokenType ? `:${b.tokenType.toLowerCase()}` : "";
    windows.push({
      key: `model:${b.modelId}${suffix}`,
      label: `${b.modelId}${suffix ? ` (${b.tokenType!.toLowerCase()})` : ""}`,
      usedPct: Math.min(100, Math.max(0, (1 - b.remainingFraction) * 100)),
      resetsAt: b.resetTime ? new Date(b.resetTime) : null,
    });
  }
  if (windows.length === 0) throw new ProviderError("Gemini quota response had no buckets", "parse");
  return { windows, plan, bankedResets: null, raw: body };
}

export const gemini: ProviderAdapter = {
  id: "gemini",
  pasteHint: "After approving, Google shows an authorization code. Copy it and paste it here.",

  configError: () =>
    process.env.GEMINI_OAUTH_CLIENT_ID && process.env.GEMINI_OAUTH_CLIENT_SECRET ? null : MISSING_CLIENT,

  startAuth() {
    const { verifier, challenge, state } = createPkce();
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: geminiClient().id,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      // Forces a refresh token even if this Google account approved the client before.
      prompt: "consent",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    }).toString();
    return { url: url.toString(), verifier, state };
  },

  async finishAuth(pasted, pending) {
    const code = readPastedCode(pasted, pending.state);
    const client = geminiClient();
    const tokens = await requestJson<TokenResponse>(TOKEN_URL, {
      method: "POST",
      ...formBody({
        grant_type: "authorization_code",
        code,
        client_id: client.id,
        client_secret: client.secret,
        redirect_uri: REDIRECT_URI,
        code_verifier: pending.verifier,
      }),
    });
    if (!tokens.refresh_token) throw new ProviderError("Google returned no refresh token. Start the sign-in again.", "auth");

    const [{ projectId, tier }, user] = await Promise.all([
      loadProject(tokens.access_token),
      requestJson<{ email?: string }>(USERINFO_URL, { headers: bearer({ accessToken: tokens.access_token }) }).catch(() => ({ email: undefined })),
    ]);
    return {
      credentials: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiryFrom(tokens.access_token, tokens.expires_in),
        meta: { projectId, ...(tier ? { tier } : {}) },
      },
      identity: user.email ?? null,
    };
  },

  async refresh(credentials) {
    const client = geminiClient();
    const tokens = await requestJson<TokenResponse>(TOKEN_URL, {
      method: "POST",
      ...formBody({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: client.id,
        client_secret: client.secret,
      }),
    });
    return {
      ...credentials,
      accessToken: tokens.access_token,
      // Google keeps the same refresh token unless it sends a new one.
      refreshToken: tokens.refresh_token ?? credentials.refreshToken,
      expiresAt: expiryFrom(tokens.access_token, tokens.expires_in),
    };
  },

  async fetchUsage(credentials) {
    const projectId = credentials.meta.projectId;
    if (!projectId) throw new ProviderError("No Code Assist project stored for this account. Reconnect it.", "auth");
    const body = await requestJson(`${CODE_ASSIST}:retrieveUserQuota`, {
      method: "POST",
      ...jsonBody({ project: projectId }, bearer(credentials)),
    });
    return parseGeminiUsage(body, credentials.meta.tier ?? null);
  },
};
