import { mkdirSync } from "node:fs";
import path from "node:path";
import { findRepoRoot } from "@app/shared/paths";

/**
 * Normalises a SQLite DATABASE_URL to an absolute `file:` URL so the Prisma CLI,
 * the server and the worker all open the same file regardless of their cwd.
 * Relative paths resolve from the repo root. Creates the parent directory if missing.
 */
export function resolveDatabaseUrl(raw = process.env.DATABASE_URL ?? "file:./data/dev.db"): string {
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (filePath === ":memory:") return raw;

  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(findRepoRoot(), filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  return `file:${absolute}`;
}
