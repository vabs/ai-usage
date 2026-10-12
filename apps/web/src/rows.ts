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

document.addEventListener("click", (event) => {
  const target = event.target as Element | null;

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
