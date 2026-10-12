import { formatAge, formatCountdown } from "@app/shared/format";

/**
 * Ticks reset countdowns and "updated Xm ago" labels every second, and flags tabs and panels
 * whose data is older than the server's staleness threshold. The server renders the same text
 * first (same formatters), so nothing jumps when this takes over.
 */
function tick() {
  const now = Date.now();

  for (const el of document.querySelectorAll<HTMLTimeElement>("time[data-countdown]")) {
    el.textContent = formatCountdown(Date.parse(el.dateTime) - now);
  }

  for (const el of document.querySelectorAll<HTMLTimeElement>("time[data-age]")) {
    el.textContent = formatAge(now - Date.parse(el.dateTime));
  }

  // Never-collected accounts have no data-updated-at; the server already marked them stale.
  for (const el of document.querySelectorAll<HTMLElement>("[data-stale-after][data-updated-at]")) {
    el.classList.toggle("is-stale", now - Date.parse(el.dataset.updatedAt!) > Number(el.dataset.staleAfter));
  }
}

tick();
window.setInterval(tick, 1_000);
document.addEventListener("htmx:afterSettle", tick);
