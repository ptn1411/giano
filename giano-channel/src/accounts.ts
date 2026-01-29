import type { MoltbotConfig } from "moltbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "moltbot/plugin-sdk";

import type {
  GianoAccountConfig,
  GianoConfig,
  ResolvedGianoAccount,
} from "./types.js";

function normalizeAccountId(accountId?: string | null): string {
  const trimmed = accountId?.trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_WS_URL = "ws://127.0.0.1:3000";

function getChannelConfig(cfg: MoltbotConfig): GianoConfig {
  const channels = cfg.channels as Record<string, unknown> | undefined;
  return (channels?.["giano-channel"] ??
    channels?.["giano"] ??
    {}) as GianoConfig;
}

function listConfiguredAccountIds(cfg: MoltbotConfig): string[] {
  const gianoConfig = getChannelConfig(cfg);
  const accounts = gianoConfig.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listGianoAccountIds(cfg: MoltbotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultGianoAccountId(cfg: MoltbotConfig): string {
  const gianoConfig = getChannelConfig(cfg);
  if (gianoConfig.defaultAccount?.trim())
    return gianoConfig.defaultAccount.trim();
  const ids = listGianoAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: MoltbotConfig,
  accountId: string,
): GianoAccountConfig | undefined {
  const gianoConfig = getChannelConfig(cfg);
  const accounts = gianoConfig.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as GianoAccountConfig | undefined;
}

function mergeGianoAccountConfig(
  cfg: MoltbotConfig,
  accountId: string,
): GianoAccountConfig {
  const raw = getChannelConfig(cfg);
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

function resolveToken(config: GianoAccountConfig, accountId: string): string {
  // Check account-specific token
  if (config.token?.trim()) return config.token.trim();
  // Check environment variable
  const envKey =
    accountId === DEFAULT_ACCOUNT_ID
      ? "GIANO_BOT_TOKEN"
      : `GIANO_BOT_TOKEN_${accountId.toUpperCase()}`;
  const envToken =
    process.env[envKey]?.trim() || process.env.GIANO_BOT_TOKEN?.trim();
  return envToken || "";
}

export function resolveGianoAccount(params: {
  cfg: MoltbotConfig;
  accountId?: string | null;
}): ResolvedGianoAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = getChannelConfig(params.cfg).enabled !== false;
  const merged = mergeGianoAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const token = resolveToken(merged, accountId);

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    token,
    apiBaseUrl: merged.apiBaseUrl?.trim() || DEFAULT_API_BASE_URL,
    wsUrl: merged.wsUrl?.trim() || DEFAULT_WS_URL,
    config: merged,
  };
}

export function listEnabledGianoAccounts(
  cfg: MoltbotConfig,
): ResolvedGianoAccount[] {
  return listGianoAccountIds(cfg)
    .map((accountId) => resolveGianoAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}

export { getChannelConfig };
