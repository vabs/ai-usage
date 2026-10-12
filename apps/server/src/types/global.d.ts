/// <reference types="@kitajs/html/htmx.d.ts" />
import type { HtmxRequestInfo, HtmxResponseHelpers } from "../middleware/htmx";

declare global {
  namespace Express {
    interface Request {
      htmx: HtmxRequestInfo;
    }
    interface Response {
      /** Render a JSX element (string or Promise<string>) as text/html. */
      html(node: JSX.Element, status?: number): Promise<void>;
      hx: HtmxResponseHelpers;
    }
  }
}

export {};
