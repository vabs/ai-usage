import { createHash } from "node:crypto";
import { createSealer, type UsageReport } from "@app/shared";
import { describe, expect, it, vi } from "vitest";
import { collectUsage } from "../src/collect";
import { openCredentials, sealCredentials } from "../src/credentials";
import { ProviderError } from "../src/http";
import { createPkce, readPastedCode } from "../src/oauth";
import type { Credentials, ProviderAdapter } from "../src/types";

describe("createPkce", () => {
  it("derives an S256 challenge from the verifier", () => {
    const { verifier, challenge, state } = createPkce();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(state).not.toBe(verifier);
  });
});

describe("readPastedCode", () => {
  it("accepts a bare code, code#state, and a redirect URL", () => {
    expect(readPastedCode("  abc123 ", "s1")).toBe("abc123");
    expect(readPastedCode("abc123#s1", "s1")).toBe("abc123");
    expect(readPastedCode("http://127.0.0.1:1455/auth/callback?code=xyz&state=s1", "s1")).toBe("xyz");
  });

  it("rejects a code from another sign-in attempt", () => {
    expect(() => readPastedCode("abc#other", "s1")).toThrow(/different sign-in/);
    expect(() => readPastedCode("http://127.0.0.1:1455/auth/callback?code=x&state=other", "s1")).toThrow(ProviderError);
  });

  it("rejects input without a code", () => {
    expect(() => readPastedCode("http://127.0.0.1:1455/auth/callback?error=access_denied", "s1")).toThrow(/No authorization code/);
  });
});

describe("credentials sealing", () => {
  it("round-trips and detects tampering", () => {
    const sealer = createSealer(Buffer.alloc(32, 7).toString("base64"));
    const creds: Credentials = { accessToken: "a", refreshToken: "r", expiresAt: 1, meta: { accountId: "x" } };
    const sealed = sealCredentials(sealer, creds);
    expect(sealed).not.toContain("refreshToken");
    expect(openCredentials(sealer, sealed)).toEqual(creds);
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("AA") ? "BB" : "AA");
    expect(() => openCredentials(sealer, tampered)).toThrow();
  });

  it("refuses a key of the wrong length", () => {
    expect(() => createSealer(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("collectUsage", () => {
  const now = 1_000_000_000_000;
  const report: UsageReport = { windows: [], plan: null, bankedResets: null, raw: {} };
  const creds = (expiresAt: number): Credentials => ({ accessToken: "old", refreshToken: "r1", expiresAt, meta: {} });

  function fakeAdapter(fetchUsage: ProviderAdapter["fetchUsage"]) {
    return {
      refresh: vi.fn(async (c: Credentials) => ({ ...c, accessToken: "new", refreshToken: "r2", expiresAt: now + 3600_000 })),
      fetchUsage: vi.fn(fetchUsage),
    } as unknown as ProviderAdapter & { refresh: ReturnType<typeof vi.fn>; fetchUsage: ReturnType<typeof vi.fn> };
  }

  it("uses a valid token without refreshing", async () => {
    const adapter = fakeAdapter(async () => report);
    const save = vi.fn(async () => {});
    await collectUsage(adapter, creds(now + 3600_000), save, now);
    expect(adapter.refresh).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("refreshes a nearly expired token and saves it before fetching", async () => {
    const order: string[] = [];
    const adapter = fakeAdapter(async (c) => {
      order.push(`fetch:${c.accessToken}`);
      return report;
    });
    const save = vi.fn(async (c: Credentials) => {
      order.push(`save:${c.refreshToken}`);
    });
    await collectUsage(adapter, creds(now + 60_000), save, now);
    expect(order).toEqual(["save:r2", "fetch:new"]);
  });

  it("keeps the rotated token even when the usage call then fails", async () => {
    const adapter = fakeAdapter(async () => {
      throw new ProviderError("down", "http", 503);
    });
    const save = vi.fn(async () => {});
    await expect(collectUsage(adapter, creds(now), save, now)).rejects.toThrow("down");
    expect(save).toHaveBeenCalledOnce();
  });

  it("refreshes once and retries when a valid-looking token is rejected", async () => {
    let calls = 0;
    const adapter = fakeAdapter(async () => {
      if (calls++ === 0) throw new ProviderError("revoked", "auth", 401);
      return report;
    });
    await expect(collectUsage(adapter, creds(now + 3600_000), async () => {}, now)).resolves.toBe(report);
    expect(adapter.refresh).toHaveBeenCalledOnce();
  });
});
