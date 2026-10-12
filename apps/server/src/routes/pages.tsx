import { Router } from "express";
import { listAccounts } from "../lib/accounts";
import { DashboardPage } from "../views/pages/dashboard";

export const pagesRouter = Router();

pagesRouter.get("/", async (_req, res) => {
  await res.html(<DashboardPage accounts={await listAccounts()} />);
});
