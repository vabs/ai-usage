import { db } from "@app/db";
import { Router } from "express";
import { redis } from "../lib/queue";

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const [dbCheck, redisCheck] = await Promise.allSettled([
    withTimeout(db.$queryRaw`SELECT 1`, 1_000),
    withTimeout(redis.ping(), 1_000),
  ]);
  const checks = {
    db: dbCheck.status === "fulfilled" ? "ok" : "down",
    redis: redisCheck.status === "fulfilled" ? "ok" : "down",
  };
  const ok = Object.values(checks).every((v) => v === "ok");
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", ...checks, uptime: Math.round(process.uptime()) });
});
