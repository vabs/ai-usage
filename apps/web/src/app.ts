import htmx from "htmx.org";
import "./countdown";
import "./dialog";
import "./rows";
import "./toasts";

declare global {
  interface Window {
    htmx: typeof htmx;
  }
}

// Expose htmx globally for extensions and the browser console.
window.htmx = htmx;

// Add small client-side behaviour here. Prefer server-rendered HTML and htmx
// attributes first; reach for JS only for things HTML can't express.
