import { createHash, randomBytes } from "node:crypto";
import { ProviderError } from "./http";
import type { PendingAuth } from "./types";

/** PKCE verifier/challenge plus an anti-CSRF state value. */
export function createPkce(): PendingAuth & { challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
    state: randomBytes(16).toString("base64url"),
  };
}

/**
 * Pulls the authorization code out of whatever the user pasted: a bare code,
 * Claude's "code#state", or a full redirect URL copied from the address bar.
 * Rejects a state that doesn't match the login we started.
 */
export function readPastedCode(pasted: string, expectedState: string): string {
  const input = pasted.trim();
  let code: string | null;
  let state: string | null;

  if (/^https?:\/\//i.test(input)) {
    const url = new URL(input);
    code = url.searchParams.get("code");
    state = url.searchParams.get("state");
  } else {
    const [c, s] = input.split("#");
    code = c || null;
    state = s || null;
  }

  if (!code) throw new ProviderError("No authorization code found in what you pasted.", "parse");
  if (state && state !== expectedState) {
    throw new ProviderError("That code belongs to a different sign-in attempt. Use the link on this page and paste its code.", "parse");
  }
  return code;
}

/** Reads a JWT's payload without verifying it (we only use it for expiry and ids we already trust). */
export function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

/** Access-token expiry from `expires_in` seconds, else the JWT `exp`, else one hour. */
export function expiryFrom(accessToken: string, expiresIn?: number, now = Date.now()): number {
  if (typeof expiresIn === "number") return now + expiresIn * 1000;
  const exp = decodeJwt(accessToken).exp;
  return typeof exp === "number" ? exp * 1000 : now + 3600_000;
}
