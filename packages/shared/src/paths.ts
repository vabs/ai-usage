import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Walks up from `start` to the directory whose package.json declares workspaces. */
export function findRepoRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  while (true) {
    const pkg = path.join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).workspaces) return dir;
      } catch {
        // unreadable package.json: keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

/** Loads the repo-root .env into process.env if present. Existing variables win. */
export function loadRootEnv(): void {
  const envFile = path.join(findRepoRoot(), ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
