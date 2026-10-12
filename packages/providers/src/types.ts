import type { Provider, UsageReport } from "@app/shared";

/**
 * Tokens for one connected account. They come from this app's own OAuth login,
 * not from a CLI's config, so refreshing them never logs the CLI out.
 * Stored encrypted (see credentials.ts).
 */
export type Credentials = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Vendor extras needed on every call, e.g. the ChatGPT account id or Code Assist project. */
  meta: Record<string, string>;
};

/** Kept server-side between "open sign-in" and "paste code". */
export type PendingAuth = { state: string; verifier: string };

export type ConnectedAccount = {
  credentials: Credentials;
  /** Email or account name when the vendor tells us, used as the default label. */
  identity: string | null;
};

/** An extra input on the connect form, passed to finishAuth (e.g. Gemini's Google Cloud project). */
export type ConnectField = { name: string; label: string; hint: string };

/**
 * One adapter per vendor. Every undocumented URL and response shape lives inside
 * its adapter file, so a vendor change is a one-file patch.
 */
export interface ProviderAdapter {
  id: Provider;
  /** Why this provider can't be connected yet (e.g. missing env), or null when ready. */
  configError?(): string | null;
  /** Shown under the paste box on the connect page. */
  pasteHint: string;
  connectFields?: ConnectField[];
  /** Builds the vendor sign-in URL (PKCE). */
  startAuth(): PendingAuth & { url: string };
  /** Exchanges what the user pasted (a code, "code#state", or a redirect URL) for tokens. */
  finishAuth(pasted: string, pending: PendingAuth, fields?: Record<string, string>): Promise<ConnectedAccount>;
  refresh(credentials: Credentials): Promise<Credentials>;
  fetchUsage(credentials: Credentials): Promise<UsageReport>;
}
