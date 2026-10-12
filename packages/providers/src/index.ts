import type { Provider } from "@app/shared";
import { claude } from "./claude";
import { codex } from "./codex";
import { gemini } from "./gemini";
import type { ProviderAdapter } from "./types";

export const ADAPTERS: Record<Provider, ProviderAdapter> = { claude, codex, gemini };

export { collectUsage } from "./collect";
export { openCredentials, sealCredentials } from "./credentials";
export { ProviderError } from "./http";
export type { ConnectedAccount, Credentials, PendingAuth, ProviderAdapter } from "./types";
