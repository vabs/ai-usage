import { Router } from "express";
import { listAccounts, toApi } from "../lib/accounts";
import { requestCollect } from "../lib/queue";

/** JSON for scripts, a menu-bar app, or anything that isn't the htmx UI. */
export const apiRouter = Router();

apiRouter.get("/usage", async (_req, res) => {
  const now = Date.now();
  const accounts = await listAccounts();
  res.set("Cache-Control", "no-store").json({ generatedAt: new Date(now), accounts: accounts.map((a) => toApi(a, now)) });
});

/** Queues a collection for every account. Poll GET /api/usage for the results. */
apiRouter.post("/refresh", async (_req, res) => {
  const accounts = await listAccounts();
  for (const { id } of accounts) await requestCollect(id);
  res.status(202).json({ queued: accounts.length });
});
