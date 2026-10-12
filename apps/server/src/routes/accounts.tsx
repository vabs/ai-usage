import { db } from "@app/db";
import { Router } from "express";
import type { Request } from "express";
import { findAccount, isSelected, listAccounts, requestedAccountId, selectedAccountId } from "../lib/accounts";
import { requestCollect } from "../lib/queue";
import { AccountFragment } from "../views/components/account-panel";
import { AccountList } from "../views/pages/dashboard";

export const accountsRouter = Router();

/** Tab strip and panels, keeping the viewer's open tab (falls back to the first account). */
async function renderList(req: Request) {
  const accounts = await listAccounts();
  return <AccountList accounts={accounts} selectedId={selectedAccountId(accounts, requestedAccountId(req))} />;
}

// Manual refresh of every account. Registered before /:id so "refresh" isn't read as an id.
accountsRouter.post("/refresh", async (req, res) => {
  const accounts = await db.account.findMany({ select: { id: true } });
  for (const { id } of accounts) await requestCollect(id);
  if (!req.htmx.isHtmx) return res.redirect(303, "/");
  await res.html(await renderList(req));
});

accountsRouter.get("/:id", async (req, res) => {
  const account = await findAccount(req.params.id);
  await res.html(<AccountFragment account={account} selected={await isSelected(req, account.id)} />);
});

accountsRouter.post("/:id/refresh", async (req, res) => {
  const { id } = await findAccount(req.params.id);
  await requestCollect(id);
  if (!req.htmx.isHtmx) return res.redirect(303, `/?account=${id}`);
  await res.html(<AccountFragment account={await findAccount(String(id))} selected={await isSelected(req, id)} />);
});

/** The vendor's last usage response, verbatim. How you find fields the adapters don't map yet. */
accountsRouter.get("/:id/raw", async (req, res) => {
  const account = await findAccount(req.params.id);
  res.type("json").send(account.lastRaw ? JSON.stringify(JSON.parse(account.lastRaw), null, 2) : "null");
});

accountsRouter.delete("/:id", async (req, res) => {
  const account = await findAccount(req.params.id);
  await db.account.delete({ where: { id: account.id } });
  res.hx.trigger("toast", { message: `Disconnected ${account.label}.` });
  // The whole strip re-renders: the removed tab may have been the open one.
  await res.html(await renderList(req));
});
