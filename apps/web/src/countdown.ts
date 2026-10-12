import { formatAge, formatCountdown } from "@app/shared/format";

/**
 * Ticks reset countdowns and "updated Xm ago" labels every second, and flags cards whose
 * data is older than the server's staleness threshold. The server renders the same text
 * first (same formatters), so nothing jumps when this takes over.
 */
function tick() {
  const now = Date.now();

  for (const el of document.querySelectorAll<HTMLTimeElement>("time[data-countdown]")) {
    el.textContent = formatCountdown(Date.parse(el.dateTime) - now);
  }

  for (const el of document.querySelectorAll<HTMLTimeElement>("time[data-age]")) {
    const age = now - Date.parse(el.dateTime);
    el.textContent = formatAge(age);
    const card = el.closest<HTMLElement>("[data-stale-after]");
    if (card) card.classList.toggle("is-stale", age > Number(card.dataset.staleAfter));
  }
}

tick();
window.setInterval(tick, 1_000);
document.addEventListener("htmx:afterSettle", tick);
