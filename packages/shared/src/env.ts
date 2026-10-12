import { z } from "zod";

/** Variables every process needs. Apps extend this with their own. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.string().min(1).default("file:./data/dev.db"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  // Encrypts stored OAuth tokens. 32 bytes, base64: openssl rand -base64 32
  TOKEN_ENCRYPTION_KEY: z.string().min(1, "Generate one with: openssl rand -base64 32"),
});

/** Parses process.env and exits with a readable message when something is wrong. */
export function parseEnv<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv = process.env): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    console.error("Invalid environment variables:\n" + z.prettifyError(result.error));
    process.exit(1);
  }
  return result.data;
}
