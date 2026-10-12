import { db } from "@app/db";
import { Router } from "express";
import { findAccount, listAccounts } from "../lib/accounts";
import { requestCollect } from "../lib/queue";
import { AccountCard } from "../views/components/account-card";
import { AccountList } from "../views/pages/dashboard";

export const accountsRouter = Router();

// Manual refresh of every account. Registered before /:id so "refresh" isn't read as an id.
accountsRouter.post("/refresh", async (req, res) => {
  const accounts = await db.account.findMany({ select: { id: true } });
  for (const { id } of accounts) await requestCollect(id);
  if (!req.htmx.isHtmx) return res.redirect(303, "/");
  await res.html(<AccountList accounts={await listAccounts()} />);
});

accountsRouter.get("/:id", async (req, res) => {
  const account = await findAccount(req.params.id);
  await res.html(<AccountCard account={account} />);
});

accountsRouter.post("/:id/refresh", async (req, res) => {
  const { id } = await findAccount(req.params.id);
  await requestCollect(id);
  if (!req.htmx.isHtmx) return res.redirect(303, "/");
  await res.html(<AccountCard account={await findAccount(String(id))} />);
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
  // An empty 200 body with hx-swap="outerHTML" removes the card.
  res.status(200).send("");
});
