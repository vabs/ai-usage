import { readFileSync } from "node:fs";
import path from "node:path";
import { findRepoRoot } from "@app/shared";
import { env, isProd } from "../config";

export const webDistDir = env.WEB_DIST_DIR ?? path.join(findRepoRoot(), "apps/web/dist");

let manifest: Record<string, string> | undefined;

function readManifest(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(path.join(webDistDir, "manifest.json"), "utf8"));
  } catch {
    return {};
  }
}

/**
 * Maps a logical asset name ("app.js") to its built, content-hashed URL.
 * The manifest is re-read on every call in development so rebuilds show up without a restart.
 */
export function asset(name: string): string {
  if (!manifest || !isProd) manifest = readManifest();
  return `/static/${manifest[name] ?? name}`;
}
