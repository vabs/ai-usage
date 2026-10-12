import { baseEnvSchema, createLogger, createSealer, parseEnv } from "@app/shared";
import { z } from "zod";

export const env = parseEnv(
  baseEnvSchema.extend({
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
    // How often every connected account is collected.
    COLLECT_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(5),
  }),
);

export const logger = createLogger("worker", env.LOG_LEVEL);
export const sealer = createSealer(env.TOKEN_ENCRYPTION_KEY);
