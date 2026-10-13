import { db } from "@app/db";
import { Router } from "express";
import type { Request } from "express";
import { findAccount, listAccounts, openAccountIds } from "../lib/accounts";
import { maskEmails } from "../lib/mask";
import { requestCollect } from "../lib/queue";
import { AccountRowContent } from "../views/components/account-row";
import { AccountList } from "../views/pages/dashboard";

export const accountsRouter = Router();

/** Every row, each open or closed as the viewer left it. */
async function renderList(req: Request) {
  const accounts = await listAccounts();
  return <AccountList accounts={accounts} openIds={openAccountIds(accounts, req)} />;
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
  await res.html(<AccountRowContent account={account} />);
});

accountsRouter.post("/:id/refresh", async (req, res) => {
  const { id } = await findAccount(req.params.id);
  await requestCollect(id);
  if (!req.htmx.isHtmx) return res.redirect(303, `/?account=${id}`);
  await res.html(<AccountRowContent account={await findAccount(String(id))} />);
});

/** The vendor's last usage response, verbatim. How you find fields the adapters don't map yet. */
accountsRouter.get("/:id/raw", async (req, res) => {
  const account = await findAccount(req.params.id);
  res.type("json").send(account.lastRaw ? JSON.stringify(JSON.parse(account.lastRaw), null, 2) : "null");
});

accountsRouter.delete("/:id", async (req, res) => {
  const account = await findAccount(req.params.id);
  await db.account.delete({ where: { id: account.id } });
  res.hx.trigger("toast", { message: `Disconnected ${maskEmails(account.label)}.` });
  // The whole list re-renders so the account count stays right.
  await res.html(await renderList(req));
});
