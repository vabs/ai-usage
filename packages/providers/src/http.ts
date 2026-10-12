import type { ErrorKind } from "@app/shared";

/** A vendor call failed. `kind: "auth"` means the stored login no longer works. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: Exclude<ErrorKind, "internal">,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

type RequestOptions = Omit<RequestInit, "signal"> & { timeoutMs?: number };

/** fetch + JSON with a timeout. Error messages include the status and a short body excerpt, never request headers. */
export async function requestJson<T = unknown>(url: string, { timeoutMs = 15_000, ...init }: RequestOptions = {}): Promise<T> {
  const where = `${init.method ?? "GET"} ${new URL(url).host}${new URL(url).pathname}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new ProviderError(`${where} failed: ${(err as Error).message}`, "http");
  }

  const text = await res.text();
  if (!res.ok) {
    // 401/403 from an API, or invalid_grant from a token endpoint: the login is gone.
    const auth = res.status === 401 || res.status === 403 || (res.status === 400 && text.includes("invalid_grant"));
    throw new ProviderError(`${where} returned ${res.status}: ${text.slice(0, 300)}`, auth ? "auth" : "http", res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError(`${where} did not return JSON: ${text.slice(0, 120)}`, "parse", res.status);
  }
}

export const formBody = (data: Record<string, string>) => ({
  headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
  body: new URLSearchParams(data).toString(),
});

export const jsonBody = (data: unknown, headers: Record<string, string> = {}) => ({
  headers: { "content-type": "application/json", accept: "application/json", ...headers },
  body: JSON.stringify(data),
});
