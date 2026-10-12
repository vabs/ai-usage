import { Router } from "express";
import { listAccounts, requestedAccountId, selectedAccountId } from "../lib/accounts";
import { DashboardPage } from "../views/pages/dashboard";

export const pagesRouter = Router();

pagesRouter.get("/", async (req, res) => {
  const accounts = await listAccounts();
  await res.html(<DashboardPage accounts={accounts} selectedId={selectedAccountId(accounts, requestedAccountId(req))} />);
});
