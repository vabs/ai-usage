import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";
import { resolveDatabaseUrl } from "./url";

export * from "./generated/prisma/client";
export { resolveDatabaseUrl } from "./url";

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: resolveDatabaseUrl(),
    // Wait up to 5s for a write lock: server and worker share one SQLite file.
    timeout: 5_000,
  });
  return new PrismaClient({ adapter });
}

// Reuse one client per process (and across tsx reloads in dev).
const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof createClient> };
export const db = globalForDb.__db ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

/**
 * Applies connection-level SQLite settings. Call once at process start.
 * WAL lets the server read while the worker writes; NORMAL sync is safe under WAL.
 */
export async function initDb(): Promise<void> {
  await db.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await db.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
  await db.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
}
