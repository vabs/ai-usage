/**
 * Account rows (<details class="sub">). Remembers which rows the viewer opened or closed in a
 * cookie the server reads, so rows render that way on the next load without a jump. Rows nobody
 * touched follow the server's default (open only when they need attention).
 */
const COOKIE = "rows"; // ROWS_COOKIE in apps/server/src/lib/accounts.ts
const MAX_CHOICES = 50;
const ROW = "details.sub";

/** "3,-5": account 3 open, account 5 closed. Oldest first. */
function readChoices(): Map<number, boolean> {
  const choices = new Map<number, boolean>();
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  let decoded = "";
  try {
    decoded = decodeURIComponent(raw ?? "");
  } catch {
    return choices; // a mangled cookie: start over
  }
  for (const item of decoded.split(",")) {
    const n = Number(item);
    if (Number.isInteger(n) && n !== 0) choices.set(Math.abs(n), n > 0);
  }
  return choices;
}

function remember(rows: HTMLDetailsElement[], open: boolean) {
  const choices = readChoices();
  for (const row of rows) {
    const id = Number(row.dataset.account);
    choices.delete(id); // re-insert so the newest choices survive the cap
    choices.set(id, open);
  }
  const value = [...choices].slice(-MAX_CHOICES).map(([id, isOpen]) => (isOpen ? id : -id));
  document.cookie = `${COOKIE}=${encodeURIComponent(value.join(","))}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Accounts whose email the viewer chose to show. Kept in memory: a reload masks them again. */
const revealed = new Set<string>();

function setRevealed(button: HTMLElement, show: boolean) {
  button.setAttribute("aria-pressed", String(show));
  button.title = show ? "Hide email" : "Show email";
  button.querySelector<HTMLElement>(".reveal__masked")!.hidden = show;
  button.querySelector<HTMLElement>(".reveal__full")!.hidden = !show;
}

document.addEventListener("click", (event) => {
  const target = event.target as Element | null;

  // A masked email sits inside the row's summary: show or hide it, without folding the row.
  const reveal = target?.closest<HTMLElement>("[data-reveal]");
  if (reveal) {
    event.preventDefault();
    const id = reveal.closest<HTMLElement>("[data-account]")?.dataset.account ?? "";
    const show = reveal.getAttribute("aria-pressed") !== "true";
    if (show) revealed.add(id);
    else revealed.delete(id);
    setRevealed(reveal, show);
    return;
  }

  // Only clicks count as choices: "toggle" also fires for rows the server rendered open.
  // Enter and Space on a summary arrive here as clicks too.
  const head = target?.closest(`${ROW} > summary`);
  if (head) {
    const row = head.parentElement as HTMLDetailsElement;
    remember([row], !row.open); // the click's default action flips it after this
    return;
  }

  const all = target?.closest<HTMLElement>("[data-rows]");
  if (all) {
    const open = all.dataset.rows === "open";
    const rows = [...document.querySelectorAll<HTMLDetailsElement>(ROW)];
    for (const row of rows) row.open = open;
    remember(rows, open);
  }
});

// Polls re-render rows masked; keep shown emails shown until the next page load.
document.addEventListener("htmx:afterSwap", (event) => {
  const target = (event as CustomEvent<{ target: Element }>).detail.target;
  for (const button of target.querySelectorAll<HTMLElement>("[data-reveal]")) {
    const id = button.closest<HTMLElement>("[data-account]")?.dataset.account ?? "";
    if (revealed.has(id)) setRevealed(button, true);
  }
});

// A poll would swap an open overflow menu shut; skip it and catch up on the next one.
document.addEventListener("htmx:beforeRequest", (event) => {
  const elt = (event as CustomEvent<{ elt: Element }>).detail.elt;
  if (elt.matches(".sub__body") && elt.querySelector("details.menu[open]")) event.preventDefault();
});

// After connecting, the dashboard opens with ?account=<id>: bring that row into view, then drop
// the parameter so a reload follows the viewer's own choices again.
const url = new URL(location.href);
const requested = url.searchParams.get("account");
if (requested) {
  document.getElementById(`account-${requested}`)?.scrollIntoView({ block: "nearest" });
  url.searchParams.delete("account");
  history.replaceState(history.state, "", url);
}
