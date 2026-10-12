import { describe, expect, it } from "vitest";
import { parseClaudeUsage } from "../src/claude";
import { parseCodexUsage } from "../src/codex";
import { parseGeminiUsage } from "../src/gemini";
import { ProviderError } from "../src/http";

// Sample bodies follow the shapes the vendors' own clients decode. Replace with real
// captures from /accounts/:id/raw once accounts are connected.

describe("parseClaudeUsage", () => {
  it("maps every utilization object to a window and skips nulls and disabled extra usage", () => {
    const report = parseClaudeUsage({
      five_hour: { utilization: 42.5, resets_at: "2026-10-11T23:00:00Z" },
      seven_day: { utilization: 12, resets_at: "2026-10-15T00:00:00Z" },
      seven_day_opus: { utilization: 3, resets_at: null },
      seven_day_sonnet: null,
      seven_day_oauth_apps: { utilization: null, resets_at: null },
      extra_usage: { is_enabled: false, utilization: 0, monthly_limit: null },
      limits: [{ kind: "weekly_scoped", percent: 5 }],
    });
    expect(report.windows).toEqual([
      { key: "5h", label: "5-hour", usedPct: 42.5, resetsAt: new Date("2026-10-11T23:00:00Z") },
      { key: "weekly", label: "Weekly", usedPct: 12, resetsAt: new Date("2026-10-15T00:00:00Z") },
      { key: "weekly:opus", label: "Weekly · Opus", usedPct: 3, resetsAt: null },
    ]);
    expect(report.bankedResets).toBeNull();
  });

  it("includes extra usage when enabled and sums unpaused banked resets", () => {
    const report = parseClaudeUsage({
      five_hour: { utilization: 1, resets_at: null },
      extra_usage: { is_enabled: true, utilization: 25 },
      cedar_ember: { eligible: true, grants: [{ resets_left: 2, paused: false }, { resets_left: 5, paused: true }] },
    });
    expect(report.windows.map((w) => w.key)).toEqual(["5h", "extra"]);
    expect(report.bankedResets).toBe(2);
  });

  it("rejects a body with no windows", () => {
    expect(() => parseClaudeUsage({ error: "nope" })).toThrow(ProviderError);
  });
});

describe("parseCodexUsage", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");

  it("names windows by length and reads banked reset credits", () => {
    const report = parseCodexUsage(
      {
        plan_type: "plus",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 61, limit_window_seconds: 18_000, reset_after_seconds: 600, reset_at: 1_760_184_600 },
          secondary_window: { used_percent: 20, limit_window_seconds: 604_800, reset_after_seconds: 3600 },
        },
        additional_rate_limits: [
          {
            limit_name: "Code review",
            metered_feature: "code_review",
            rate_limit: { primary_window: { used_percent: 5, limit_window_seconds: 604_800, reset_at: 1_760_500_000 } },
          },
        ],
        rate_limit_reset_credits: { available_count: 2 },
      },
      now,
    );
    expect(report.plan).toBe("plus");
    expect(report.bankedResets).toBe(2);
    expect(report.windows).toEqual([
      { key: "5h", label: "5-hour", usedPct: 61, resetsAt: new Date(1_760_184_600_000) },
      { key: "weekly", label: "Weekly", usedPct: 20, resetsAt: new Date(now + 3_600_000) },
      { key: "code_review:weekly", label: "Code review · Weekly", usedPct: 5, resetsAt: new Date(1_760_500_000_000) },
    ]);
  });

  it("rejects a body without rate limits", () => {
    expect(() => parseCodexUsage({ plan_type: "free", rate_limit: null })).toThrow(ProviderError);
  });
});

describe("parseGeminiUsage", () => {
  it("turns remaining fractions into used percentages per model", () => {
    const report = parseGeminiUsage(
      {
        buckets: [
          { modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.75, resetTime: "2026-10-12T07:00:00Z" },
          { modelId: "gemini-2.5-flash", tokenType: "REQUESTS", remainingFraction: 1 },
          { tokenType: "REQUESTS", remainingFraction: 0.5 },
        ],
      },
      "free-tier",
    );
    expect(report.plan).toBe("free-tier");
    expect(report.windows).toEqual([
      { key: "model:gemini-2.5-pro", label: "gemini-2.5-pro", usedPct: 25, resetsAt: new Date("2026-10-12T07:00:00Z") },
      { key: "model:gemini-2.5-flash", label: "gemini-2.5-flash", usedPct: 0, resetsAt: null },
    ]);
  });
});
