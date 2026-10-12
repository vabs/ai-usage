type Tone = "info" | "error";

/** Shows a transient message in the #toasts live region. */
export function showToast(message: string, tone: Tone = "info") {
  const region = document.getElementById("toasts");
  if (!region) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");
  toast.textContent = message;
  region.append(toast);

  window.setTimeout(() => {
    toast.classList.add("toast--leaving");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 400); // reduced-motion fallback
  }, 4_000);
}

// Server-sent toasts: res.hx.trigger("toast", { message, tone }) sets an HX-Trigger header.
document.addEventListener("toast", (event) => {
  const { message, tone } = (event as CustomEvent<{ message?: string; tone?: Tone }>).detail ?? {};
  if (message) showToast(message, tone);
});

// Error responses without a server-provided toast (e.g. a proxy 502).
document.addEventListener("htmx:responseError", (event) => {
  const xhr = (event as CustomEvent<{ xhr: XMLHttpRequest }>).detail.xhr;
  if (xhr.getResponseHeader("HX-Trigger")) return;
  showToast(`The request failed (${xhr.status}). Try again.`, "error");
});

document.addEventListener("htmx:sendError", () => {
  showToast("Can't reach the server. Check your connection and try again.", "error");
});
