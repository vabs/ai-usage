# usage

One dashboard for the subscription limits of Claude (Pro/Max), Codex (ChatGPT plans) and Gemini CLI.
It shows a bar per window (5-hour, weekly, per-model), a live countdown to each reset, how stale the
numbers are, and banked resets where the vendor exposes them.

Data comes only from the vendors' APIs. Nothing reads your laptop's CLI files, so the app can run on
any server and keeps working when your machine is off.

Built on [project-template](https://github.com/vabs/project-template): Express 5 + htmx, SQLite (Prisma),
Redis (BullMQ), TypeScript.

## How it works

```
 you ──► Connect page ──► vendor sign-in (PKCE) ──► paste code ──► tokens stored encrypted (SQLite)
                                                                         │
 worker: every N min (and on "Refresh") ─► refresh token if needed ─► GET usage API ─► normalize
                                                                         │
                                         UsageWindow (latest) + UsageSnapshot (history)
                                                                         │
                                  dashboard (htmx cards)  ·  GET /api/usage (JSON)
```

- Each connected account has its own OAuth session, separate from your CLI. Refreshing the app's
  tokens never logs the CLI out. (Vendors rotate refresh tokens, so sharing one would.)
- One collect job per account at a time (BullMQ deduplication). Scheduled runs and manual refreshes
  can't race on a token refresh.
- Collection fails soft. Errors are recorded on the account, and the last good numbers stay visible
  but are marked stale. An `auth` error shows a Reconnect link.

## Quick start (development)

```bash
cp .env.example .env
# set TOKEN_ENCRYPTION_KEY:  openssl rand -base64 32
npm install
npm run services:up      # Redis in Docker on 127.0.0.1:6379
npm run setup            # Prisma client + migrations -> data/dev.db
npm run dev              # web assets, server and worker
```

Open http://127.0.0.1:3000. Basic auth is off in development unless `DASHBOARD_PASSWORD` is set.

## Connecting your accounts

Click **+ Claude**, **+ Codex** or **+ Gemini** on the dashboard. Each one has two steps:

1. **Open sign-in.** The vendor's own login page opens in a new tab. Sign in with the account your
   CLI uses and approve.
2. **Paste the code.** Copy what the vendor gives back and paste it into the form.

What you copy differs per vendor:

| Vendor | What you paste |
| --- | --- |
| Claude | Anthropic shows a code page. Copy the whole code (it contains a `#`). |
| Codex | The browser goes to `http://127.0.0.1:1455/auth/callback?code=…` and fails to load. That's expected. Copy the full URL from the address bar. |
| Gemini | Google shows an authorization code. Copy it. For a new Google account, run `gemini` once first so Code Assist is set up. |

Gemini needs one extra setup step: set `GEMINI_OAUTH_CLIENT_ID` and `GEMINI_OAUTH_CLIENT_SECRET` in
`.env`. They are the Gemini CLI's public OAuth client values, in
[`packages/core/src/code_assist/oauth2.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/code_assist/oauth2.ts).
They come from the environment rather than the code so that GitHub's secret scanning doesn't block pushes.

The account's email becomes the label unless you name it. You can connect several accounts per
vendor. Each card's ⋯ menu has **Reconnect**, **Raw response** and **Disconnect**.

**Refresh** on a card, or **Refresh all**, queues an immediate collection. The card shows
"Refreshing…" and updates itself when the worker finishes. Scripts can call
`POST /api/refresh` and then `GET /api/usage`.

## API

| Route | |
| --- | --- |
| `GET /api/usage` | All accounts with windows, staleness, errors. Never includes tokens. |
| `POST /api/refresh` | Queue a collection for every account (202). |
| `GET /accounts/:id/raw` | The vendor's last usage response verbatim, for finding unmapped fields. |
| `GET /health` | Unauthenticated DB/Redis check. |

## Deploying

The Docker Compose stack (redis, migrate, server, worker) runs it as-is:

```bash
# .env: TOKEN_ENCRYPTION_KEY, DASHBOARD_PASSWORD (required in production), TRUST_PROXY=1 behind a proxy
npm run docker:up
```

The server port is published on `127.0.0.1` only. Expose it through a TLS reverse proxy (Caddy,
Cloudflare Tunnel) or a private network such as Tailscale. Tailscale is the safer choice: then the
dashboard is never on the public internet.

## Security

This app holds OAuth tokens that can read your account usage, so:

- Tokens are encrypted at rest with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`). Keep the key out of the DB
  backups. Losing it means reconnecting every account.
- The Claude login asks only for `user:profile`, so its token cannot run inference.
- The whole UI and API sit behind HTTP Basic auth. Production refuses to start without a password.
- Cross-site POST/DELETE requests are rejected (`Sec-Fetch-Site`), because browsers replay Basic
  auth credentials on cross-site form posts.
- The app never calls the endpoint that spends a banked reset.

## Undocumented endpoints

Every vendor URL, OAuth client id and response shape lives in one file each, so a vendor change is a
one-file patch:

- `packages/providers/src/claude.ts`
- `packages/providers/src/codex.ts`
- `packages/providers/src/gemini.ts`

The apps reuse the CLIs' public OAuth clients. That is the only way to read subscription usage, and
it's also why it can break without notice, or conflict with a vendor's terms. Parser tests in
`packages/providers/test` use sample bodies. Replace them with real captures from `/accounts/:id/raw`.

## Structure

```
apps/
  server/     Express: dashboard, connect flow, /api. Basic auth + same-origin write guard.
  web/        htmx, CSS, live countdown/staleness ticker.
  worker/     BullMQ: collect-all scheduler (fan-out) and collect-account jobs.
packages/
  providers/  One adapter per vendor (OAuth + usage + parser), token refresh, credential sealing.
  db/         Prisma schema: Account, UsageWindow (latest), UsageSnapshot (history), PendingAuth.
  shared/     Normalized usage types, queues, env, AES-GCM sealer, formatters.
```

Other commands: `npm test`, `npm run typecheck`, `npm run xss-scan`,
`npm run db:migrate -- --name <change>`.
