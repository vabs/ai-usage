import type { UsageReport } from "@app/shared";
import { ProviderError } from "./http";
import type { Credentials, ProviderAdapter } from "./types";

/** Refresh this long before expiry so a slow request never runs on a dying token. */
const REFRESH_MARGIN_MS = 5 * 60_000;

/**
 * Fetches usage with a fresh access token.
 *
 * `saveCredentials` runs right after every refresh, before the usage call: refresh tokens
 * rotate, so the new pair must be stored even if the usage call then fails.
 */
export async function collectUsage(
  adapter: ProviderAdapter,
  credentials: Credentials,
  saveCredentials: (credentials: Credentials) => Promise<void>,
  now = Date.now(),
): Promise<UsageReport> {
  let current = credentials;
  let refreshed = false;

  const refresh = async () => {
    current = await adapter.refresh(current);
    refreshed = true;
    await saveCredentials(current);
  };

  if (current.expiresAt - now < REFRESH_MARGIN_MS) await refresh();

  try {
    return await adapter.fetchUsage(current);
  } catch (err) {
    // Rejected before its expiry (revoked, clock skew): refresh once and retry.
    if (!refreshed && err instanceof ProviderError && err.kind === "auth") {
      await refresh();
      return adapter.fetchUsage(current);
    }
    throw err;
  }
}
