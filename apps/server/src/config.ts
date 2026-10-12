import { baseEnvSchema, createSealer, parseEnv } from "@app/shared";
import { z } from "zod";

export const env = parseEnv(
  baseEnvSchema.extend({
    APP_NAME: z.string().default("Usage"),
    // Loopback by default: this app holds OAuth tokens. Docker sets 0.0.0.0 inside the container.
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().positive().default(3000),
    // HTTP Basic auth for the whole app. Required in production.
    DASHBOARD_USER: z.string().min(1).default("admin"),
    DASHBOARD_PASSWORD: z.string().optional(),
    // Must match the worker's value: drives the "stale" marker on cards.
    COLLECT_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(5),
    // morgan format: "dev" locally, "combined" in production unless overridden.
    HTTP_LOG_FORMAT: z.string().optional(),
    // Set to the number of proxies in front of the app (e.g. 1 behind nginx/Caddy).
    TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
    // Where the built web assets live. Defaults to <repo>/apps/web/dist.
    WEB_DIST_DIR: z.string().optional(),
  }),
);

export const isProd = env.NODE_ENV === "production";

if (isProd && !env.DASHBOARD_PASSWORD) {
  console.error("DASHBOARD_PASSWORD must be set in production: this app holds your OAuth tokens.");
  process.exit(1);
}

export const sealer = createSealer(env.TOKEN_ENCRYPTION_KEY);
