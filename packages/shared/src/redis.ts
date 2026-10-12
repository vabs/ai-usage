import { Redis, type RedisOptions } from "ioredis";

/**
 * Creates an ioredis connection. `maxRetriesPerRequest: null` is required by
 * BullMQ for blocking connections and harmless elsewhere.
 */
export function createRedis(url: string, options: RedisOptions = {}): Redis {
  return new Redis(url, { maxRetriesPerRequest: null, ...options });
}

export type { Redis };
