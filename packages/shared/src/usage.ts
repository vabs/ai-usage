/**
 * The normalized usage shape. Collectors translate vendor responses into this;
 * storage, the dashboard and /api/usage depend only on it, never on vendor formats.
 */
export const PROVIDERS = ["claude", "codex", "gemini"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const isProvider = (value: string): value is Provider => (PROVIDERS as readonly string[]).includes(value);

export const PROVIDER_NAMES: Record<Provider, string> = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
};

/** One rate-limit window for one account. */
export type UsageWindow = {
  /** Stable per account: "5h", "weekly", "weekly:opus", "model:gemini-2.5-pro". */
  key: string;
  label: string;
  /** 0 to 100. */
  usedPct: number;
  resetsAt: Date | null;
};

/** Everything one collection run learns about an account. */
export type UsageReport = {
  windows: UsageWindow[];
  /** Subscription tier when the vendor reports it ("max", "plus", "free-tier"...). */
  plan: string | null;
  /** Saved-up resets, when the vendor exposes them. Unknown until probed: null. */
  bankedResets: number | null;
  /** The vendor's response as received, kept for inspecting undocumented fields. Must not contain tokens. */
  raw: unknown;
};

/** Collection state of an account, driving the card's polling. */
export const COLLECT_STATUS = ["idle", "queued", "running"] as const;
export type CollectStatus = (typeof COLLECT_STATUS)[number];

/** Why the last collection failed. "auth" means the login is gone and the account must be reconnected. */
export const ERROR_KINDS = ["auth", "http", "parse", "internal"] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];
