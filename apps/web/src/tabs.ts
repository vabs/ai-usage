/**
 * Account tabs: instant switching, arrow-key navigation, and the open tab kept in ?account=.
 * The address bar is the source of truth: reloads read it, and htmx sends it to the server
 * (HX-Current-URL) so polled fragments come back with the right tab open.
 */
const TAB = '[role="tab"][data-account]';

const allTabs = () => [...document.querySelectorAll<HTMLAnchorElement>(TAB)];
const accountInUrl = () => new URL(location.href).searchParams.get("account");

function select(accountId: string | null, focus = false) {
  const tabs = allTabs();
  if (tabs.length === 0) return;
  const target =
    tabs.find((t) => t.dataset.account === accountId) ??
    tabs.find((t) => t.getAttribute("aria-selected") === "true") ??
    tabs[0]!;

  for (const tab of tabs) {
    const on = tab === target;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
    if (panel) panel.hidden = !on;
  }
  if (focus) target.focus();

  const url = new URL(location.href);
  if (url.searchParams.get("account") !== target.dataset.account) {
    url.searchParams.set("account", target.dataset.account!);
    history.replaceState(history.state, "", url);
  }
}

document.addEventListener("click", (event) => {
  const tab = (event.target as Element | null)?.closest<HTMLAnchorElement>(TAB);
  // Let modified clicks open the tab's link in a new browser tab as usual.
  if (!tab || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  select(tab.dataset.account ?? null);
});

document.addEventListener("keydown", (event) => {
  const tab = (event.target as Element | null)?.closest<HTMLAnchorElement>(TAB);
  if (!tab) return;
  const tabs = allTabs();
  const i = tabs.indexOf(tab);
  const next =
    event.key === "ArrowRight"
      ? tabs[(i + 1) % tabs.length]
      : event.key === "ArrowLeft"
        ? tabs[(i - 1 + tabs.length) % tabs.length]
        : event.key === "Home"
          ? tabs[0]
          : event.key === "End"
            ? tabs[tabs.length - 1]
            : undefined;
  if (!next) return;
  event.preventDefault();
  select(next.dataset.account ?? null, true);
});

// Swapped-in fragments may carry an older selection (a poll that raced a tab click).
document.addEventListener("htmx:afterSettle", () => select(accountInUrl()));

// A poll would swap an open overflow menu shut; skip it and catch up on the next one.
document.addEventListener("htmx:beforeRequest", (event) => {
  const elt = (event as CustomEvent<{ elt: Element }>).detail.elt;
  if (elt.matches('[role="tabpanel"]') && elt.querySelector("details[open]")) event.preventDefault();
});

select(accountInUrl());
