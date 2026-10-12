const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;

/**
 * Minimal structured logger for non-HTTP code (worker, startup, shutdown).
 * HTTP request logs go through morgan in the server.
 */
export function createLogger(name: string, level: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info") {
  const min = LEVELS[level] ?? LEVELS.info;
  const json = process.env.NODE_ENV === "production";

  const log = (lvl: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    if (LEVELS[lvl] < min) return;
    const out = lvl === "error" || lvl === "warn" ? console.error : console.log;
    if (json) {
      out(JSON.stringify({ time: new Date().toISOString(), level: lvl, name, msg, ...meta }));
    } else {
      out(`${new Date().toISOString()} ${lvl.toUpperCase().padEnd(5)} [${name}] ${msg}`, meta ?? "");
    }
  };

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
