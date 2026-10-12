import type { PropsWithChildren } from "@kitajs/html";
import { env } from "../config";
import { asset } from "../lib/assets";

// htmx runtime config. 422 responses are swapped so forms can re-render with errors;
// other 4xx/5xx are not swapped and surface as toasts (see apps/web/src/toasts.ts).
const htmxConfig = JSON.stringify({
  includeIndicatorStyles: false,
  responseHandling: [
    { code: "204", swap: false },
    { code: "[23]..", swap: true },
    { code: "422", swap: true },
    { code: "[45]..", swap: false, error: true },
  ],
});

type LayoutProps = PropsWithChildren<{ title?: string; /** Page-level controls shown at the right of the header. */ actions?: JSX.Element }>;

// `safe` prefix: tells the XSS scanner this is server-built markup, not text to escape.
export function Layout({ title, actions: safeActions, children }: LayoutProps) {
  const pageTitle = title ? `${title} | ${env.APP_TITLE}` : env.APP_TITLE;
  return (
    <>
      {"<!doctype html>"}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="htmx-config" content={htmxConfig} />
          <title safe>{pageTitle}</title>
          <link rel="stylesheet" href={asset("app.css")} />
          <script src={asset("app.js")} defer></script>
        </head>
        <body hx-boost="true">
          <header class="site-header">
            <a href="/" class="brand" safe>
              {env.APP_TITLE}
            </a>
            {safeActions}
          </header>
          <main class="page">{children}</main>
          <div id="toasts" class="toasts" aria-live="polite"></div>
        </body>
      </html>
    </>
  );
}
