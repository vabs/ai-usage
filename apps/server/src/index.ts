import { db, initDb } from "@app/db";
import { createApp } from "./app";
import { env } from "./config";
import { logger } from "./lib/logger";
import { redis, usageQueue } from "./lib/queue";

await initDb();

const app = createApp();
const server = app.listen(env.PORT, env.HOST, (err) => {
  if (err) {
    logger.error("Failed to start", { err: String(err) });
    process.exit(1);
  }
  logger.info(`Listening on http://${env.HOST}:${env.PORT}`, { env: env.NODE_ENV });
  // Lets pm2 (wait_ready: true) know this instance can take traffic.
  process.send?.("ready");
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);

  // Force exit if something hangs (pm2 kill_timeout should be a bit longer than this).
  setTimeout(() => process.exit(1), 8_000).unref();

  server.close();
  server.closeIdleConnections();
  await Promise.allSettled([usageQueue.close(), db.$disconnect()]);
  redis.disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
