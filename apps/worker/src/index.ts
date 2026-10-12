import { db, initDb } from "@app/db";
import {
  createRedis,
  DEFAULT_JOB_OPTIONS,
  QUEUES,
  type UsageJobData,
  type UsageJobMap,
  type UsageJobName,
} from "@app/shared";
import { type Job, Queue, Worker } from "bullmq";
import { env, logger } from "./config";
import { collectAccount } from "./jobs/collect-account";
import { createCollectAll } from "./jobs/collect-all";

type Processors = { [K in UsageJobName]: (job: Job<UsageJobMap[K], unknown, K>) => Promise<unknown> };

await initDb();

const connection = createRedis(env.REDIS_URL);
// The worker also produces jobs: the scheduler and the collect-all fan-out.
const queue = new Queue<UsageJobData, unknown, UsageJobName>(QUEUES.usage, {
  connection: createRedis(env.REDIS_URL),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/** Register one processor per job name. Adding a job: extend UsageJobMap in @app/shared, then add it here. */
const processors: Processors = {
  "collect-all": createCollectAll(queue),
  "collect-account": collectAccount,
};

// Idempotent: re-running on every start just updates the interval. The first run starts right away.
await queue.upsertJobScheduler(
  "collect-all",
  { every: env.COLLECT_INTERVAL_MINUTES * 60_000 },
  { name: "collect-all", data: {} },
);

const worker = new Worker<UsageJobData, unknown, UsageJobName>(
  QUEUES.usage,
  async (job) => {
    const run = processors[job.name] as (job: Job) => Promise<unknown>;
    if (!run) throw new Error(`No processor for job "${job.name}"`);
    return run(job);
  },
  { connection, concurrency: env.WORKER_CONCURRENCY },
);

worker.on("ready", () =>
  logger.info(`Worker ready on queue "${QUEUES.usage}"`, {
    concurrency: env.WORKER_CONCURRENCY,
    intervalMinutes: env.COLLECT_INTERVAL_MINUTES,
  }),
);
worker.on("completed", (job) => logger.debug(`Job ${job.name}#${job.id} completed`, { result: job.returnvalue }));
worker.on("failed", async (job, err) => {
  logger.error(`Job ${job?.name}#${job?.id} failed`, { attempt: job?.attemptsMade, err: err.message });
  // collect-account records its own errors; this only catches crashes (e.g. the DB was locked).
  if (job?.name === "collect-account") {
    const { accountId } = job.data as UsageJobMap["collect-account"];
    await db.account.updateMany({
      where: { id: accountId },
      data: { status: "idle", lastError: err.message, lastErrorKind: "internal" },
    });
  }
});
worker.on("error", (err) => logger.error("Worker error", { err: err.message }));

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, finishing active jobs`);
  // Force exit if a job hangs (pm2 kill_timeout should be a bit longer than this).
  setTimeout(() => process.exit(1), 25_000).unref();
  await worker.close();
  await queue.close();
  await db.$disconnect();
  connection.disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
