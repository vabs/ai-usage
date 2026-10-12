import type { RequestHandler } from "express";

export interface HtmxRequestInfo {
  /** The request was made by htmx. */
  isHtmx: boolean;
  /** The request came from an hx-boost link or form (expects a full page). */
  boosted: boolean;
  /** htmx-driven request that wants a fragment, not a full page. */
  partial: boolean;
  target?: string;
  trigger?: string;
  currentUrl?: string;
}

export interface HtmxResponseHelpers {
  /** Fire client-side events via HX-Trigger, e.g. trigger("toast", { message: "Saved." }). */
  trigger(event: string, detail?: unknown): HtmxResponseHelpers;
  /** Swap the response into a different element than the one that made the request. */
  retarget(selector: string): HtmxResponseHelpers;
  /** Override hx-swap for this response, e.g. "outerHTML". */
  reswap(swap: string): HtmxResponseHelpers;
  pushUrl(url: string | false): HtmxResponseHelpers;
  /** Client-side redirect (full page load). */
  redirect(url: string): HtmxResponseHelpers;
  /** Full page refresh. */
  refresh(): HtmxResponseHelpers;
}

/** Parses htmx request headers into req.htmx and adds res.html / res.hx helpers. */
export function htmx(): RequestHandler {
  return (req, res, next) => {
    const isHtmx = req.get("HX-Request") === "true";
    const boosted = req.get("HX-Boosted") === "true";
    const historyRestore = req.get("HX-History-Restore-Request") === "true";

    req.htmx = {
      isHtmx,
      boosted,
      partial: isHtmx && !boosted && !historyRestore,
      target: req.get("HX-Target"),
      trigger: req.get("HX-Trigger"),
      currentUrl: req.get("HX-Current-URL"),
    };

    // The same URL can return a page or a fragment, so caches must key on this header.
    res.vary("HX-Request");

    const triggers: Record<string, unknown> = {};
    const hx: HtmxResponseHelpers = {
      trigger(event, detail = null) {
        triggers[event] = detail;
        res.set("HX-Trigger", JSON.stringify(triggers));
        return hx;
      },
      retarget(selector) {
        res.set("HX-Retarget", selector);
        return hx;
      },
      reswap(swap) {
        res.set("HX-Reswap", swap);
        return hx;
      },
      pushUrl(url) {
        res.set("HX-Push-Url", url === false ? "false" : url);
        return hx;
      },
      redirect(url) {
        res.set("HX-Redirect", url);
        return hx;
      },
      refresh() {
        res.set("HX-Refresh", "true");
        return hx;
      },
    };
    res.hx = hx;

    res.html = async (node, status = 200) => {
      const body = await node;
      res.status(status).type("html").send(body);
    };

    next();
  };
}
