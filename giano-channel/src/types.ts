// TypeScript types for giano-channel

export type GianoAccountConfig = {
  /** Optional display name for this account (used in CLI/UI lists). */
  name?: string;
  /** If false, do not start this Giano account. Default: true. */
  enabled?: boolean;
  /** Base URL for Giano API. */
  apiBaseUrl?: string;
  /** WebSocket URL for Giano. */
  wsUrl?: string;
  /** Bot token from Giano backend. */
  token?: string;
  /** Bot user ID to skip self-messages. */
  botUserId?: string;
  /** Direct message access policy (default: open). */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  /** Allowlist for DM senders (Giano user IDs). */
  allowFrom?: Array<string | number>;
  /** Group access policy. */
  groupPolicy?: "open" | "allowlist" | "disabled";
  /** Per-group settings. */
  groups?: Record<string, { allow?: boolean; enabled?: boolean }>;
};

export type GianoConfig = {
  /** If false, disable all Giano accounts. */
  enabled?: boolean;
  /** Default account ID when multiple accounts are configured. */
  defaultAccount?: string;
  /** Per-account Giano configuration (multi-account). */
  accounts?: Record<string, GianoAccountConfig>;
} & GianoAccountConfig;

export type ResolvedGianoAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  token: string;
  apiBaseUrl: string;
  wsUrl: string;
  config: GianoAccountConfig;
};
