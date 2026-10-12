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

type LayoutProps = PropsWithChildren<{ title?: string }>;

export function Layout({ title, children }: LayoutProps) {
  const pageTitle = title ? `${title} | ${env.APP_NAME}` : env.APP_NAME;
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
              {env.APP_NAME}
            </a>
          </header>
          <main class="page">{children}</main>
          <div id="toasts" class="toasts" aria-live="polite"></div>
        </body>
      </html>
    </>
  );
}
