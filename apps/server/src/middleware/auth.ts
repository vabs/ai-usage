import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * HTTP Basic auth for a single user. Skipped when no password is set (development only;
 * config.ts refuses to start production without one).
 */
export function basicAuth(user: string, password: string | undefined): RequestHandler {
  if (!password) return (_req, _res, next) => next();
  const expected = digest(`${user}:${password}`);

  return (req, res, next) => {
    const header = req.get("authorization") ?? "";
    const supplied = header.startsWith("Basic ") ? Buffer.from(header.slice(6), "base64").toString("utf8") : "";
    // Compare fixed-length digests so timing reveals nothing about the password.
    if (supplied && timingSafeEqual(digest(supplied), expected)) return next();
    res.set("WWW-Authenticate", 'Basic realm="usage", charset="UTF-8"').status(401).send("Authentication required.");
  };
}

/**
 * Rejects state-changing requests sent from other sites. Browsers replay Basic auth
 * credentials on cross-site form posts, so without this any page could trigger refreshes
 * or disconnect accounts.
 */
export const sameOriginWrites: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    res.status(403).send("Cross-site request blocked.");
    return;
  }
  next();
};
