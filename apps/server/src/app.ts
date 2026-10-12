import compression from "compression";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./config";
import { webDistDir } from "./lib/assets";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { basicAuth, sameOriginWrites } from "./middleware/auth";
import { htmx } from "./middleware/htmx";
import { accountsRouter } from "./routes/accounts";
import { apiRouter } from "./routes/api";
import { connectRouter } from "./routes/connect";
import { healthRouter } from "./routes/health";
import { pagesRouter } from "./routes/pages";

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

  // Default CSP allows scripts/styles from 'self' only, which suits htmx served from /static.
  // Note: hx-on:* attributes and trigger filters (e.g. keyup[key=='Enter']) need 'unsafe-eval'.
  app.use(helmet());
  app.use(compression());

  // Static assets first so they stay out of the request log.
  app.use(
    "/static",
    express.static(webDistDir, {
      index: false,
      // Built files are content-hashed in production, so they can be cached forever.
      maxAge: isProd ? "1y" : 0,
      immutable: isProd,
    }),
  );

  app.use(
    morgan(env.HTTP_LOG_FORMAT ?? (isProd ? "combined" : "dev"), {
      skip: (req) => req.url === "/health",
    }),
  );

  // Health stays public for Docker/uptime checks; everything after it needs the password.
  app.use(healthRouter);
  app.use(basicAuth(env.DASHBOARD_USER, env.DASHBOARD_PASSWORD));
  app.use(sameOriginWrites);

  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(express.json({ limit: "100kb" }));
  app.use(htmx());

  app.use(pagesRouter);
  app.use("/accounts", accountsRouter);
  app.use("/connect", connectRouter);
  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
