/**
 * The connect dialog on the dashboard. Any [data-connect-open] control opens it on the provider
 * list; Reconnect links also load their form straight into #connect-step (hx-get). Closing it
 * puts the provider list back.
 */
const DEFAULT_TITLE = "Connect an account";

const parts = () => {
  const dialog = document.getElementById("connect-dialog") as HTMLDialogElement | null;
  const pick = document.getElementById("connect-pick");
  const step = document.getElementById("connect-step");
  return dialog && pick && step ? { dialog, pick, step } : null;
};

function showPicker() {
  const p = parts();
  if (!p) return;
  const title = document.getElementById("connect-title");
  if (title) title.textContent = DEFAULT_TITLE;
  p.step.hidden = true;
  p.step.replaceChildren();
  p.pick.hidden = false;
}

document.addEventListener("click", (event) => {
  const target = event.target as Element | null;
  const p = parts();
  if (!target || !p) return;

  const opener = target.closest("[data-connect-open]");
  if (opener) {
    // A Reconnect link fetches its form via htmx; don't also follow the href.
    if (opener instanceof HTMLAnchorElement) event.preventDefault();
    opener.closest("details.menu")?.removeAttribute("open");
    if (!p.dialog.open) {
      showPicker();
      // Its form is on the way: skip straight past the provider list.
      if (opener.hasAttribute("hx-get")) p.pick.hidden = true;
      p.dialog.showModal();
    }
    return;
  }

  const back = target.closest<HTMLElement>("[data-connect-back]");
  if (back) {
    if (back.dataset.connectBack === "close") p.dialog.close();
    else showPicker();
    return;
  }

  // The close button, or a click on the backdrop (which lands on the dialog element itself).
  if (target.closest("[data-dialog-close]") || target === p.dialog) p.dialog.close();
});

// "close" doesn't bubble; listen while capturing. Covers Escape, the close button and the backdrop.
document.addEventListener(
  "close",
  (event) => {
    if ((event.target as Element).id === "connect-dialog") showPicker();
  },
  true,
);

// The steps didn't load (the error shows as a toast). A Reconnect opened the dialog with nothing
// else in it, so close it; from the provider list, stay on the list.
document.addEventListener("htmx:afterRequest", (event) => {
  const p = parts();
  const { target, successful } = (event as CustomEvent<{ target: Element; successful: boolean }>).detail;
  if (p && target === p.step && !successful && p.pick.hidden && p.step.hidden) p.dialog.close();
});

// A provider's sign-in steps arrived: swap the list for them and put the cursor in the paste box.
document.addEventListener("htmx:afterSwap", (event) => {
  const p = parts();
  const target = (event as CustomEvent<{ target: Element }>).detail.target;
  if (!p || target !== p.step) return;
  p.pick.hidden = true;
  p.step.hidden = false;
  p.step.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus();
});
