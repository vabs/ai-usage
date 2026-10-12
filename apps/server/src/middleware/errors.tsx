import type { ErrorRequestHandler, RequestHandler } from "express";
import { isProd } from "../config";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { ErrorPage } from "../views/pages/error";

export const notFoundHandler: RequestHandler = (req) => {
  throw new HttpError(404, `Nothing lives at ${req.path}.`);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err instanceof HttpError ? err.status : typeof err?.status === "number" ? err.status : 500;
  if (status >= 500) {
    logger.error("Unhandled error", { method: req.method, url: req.originalUrl, err: err?.stack ?? String(err) });
  }

  const message =
    status >= 500 && isProd ? "Something went wrong on our side. Try again in a moment." : String(err?.message ?? err);

  // htmx fragment requests: don't swap an error page into the UI, show a toast instead.
  if (req.htmx?.partial) {
    res.hx.trigger("toast", { message, tone: "error" });
    res.status(status).end();
    return;
  }

  void res.html(<ErrorPage status={status} message={message} />, status);
};
