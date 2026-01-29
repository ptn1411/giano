import type {
  ChannelAccountSnapshot,
  ChannelDock,
  ChannelPlugin,
  MoltbotConfig,
} from "moltbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, getChatChannelMeta } from "moltbot/plugin-sdk";

import {
  getChannelConfig,
  listGianoAccountIds,
  resolveDefaultGianoAccountId,
  resolveGianoAccount,
} from "./accounts.js";
import { probeGiano } from "./probe.js";
import { sendMessageGiano } from "./send.js";
import { collectGianoStatusIssues } from "./status-issues.js";
import type { ResolvedGianoAccount } from "./types.js";

// Helpers
function now() {
  return Date.now();
}

function normalizeAccountId(accountId?: string | null): string {
  const trimmed = accountId?.trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

function normalizeGianoMessagingTarget(raw: string): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^(giano-channel|giano):/i, "");
}

const meta = getChatChannelMeta("giano-channel");

// ChannelDock - shared capabilities
export const gianoDock: ChannelDock = {
  id: "giano-channel",
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false,
    blockStreaming: false,
  },
  outbound: { textChunkLimit: 4000 },
  config: {
    resolveAllowFrom: ({ cfg, accountId }) =>
      (
        resolveGianoAccount({ cfg: cfg as MoltbotConfig, accountId }).config
          .allowFrom ?? []
      ).map((entry) => String(entry)),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^(giano-channel|giano):/i, ""))
        .map((entry) => entry.toLowerCase()),
  },
  groups: {
    resolveRequireMention: () => false,
  },
  threading: {
    resolveReplyToMode: () => "enabled",
  },
};

// Exported channel plugin
export const gianoChannelPlugin: ChannelPlugin<ResolvedGianoAccount> = {
  id: "giano-channel",
  meta: {
    ...meta,
    id: "giano-channel",
    label: "Giano",
    selectionLabel: "Giano",
    docsPath: "/channels/giano-channel",
    blurb: "Giano backend chat channel using gianobot SDK.",
    aliases: ["giano"],
    order: 100,
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false,
    reactions: false,
    threads: true,
    polls: false,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.giano-channel", "channels.giano"] },
  config: {
    listAccountIds: (cfg) => listGianoAccountIds(cfg as MoltbotConfig),
    resolveAccount: (cfg, accountId) =>
      resolveGianoAccount({ cfg: cfg as MoltbotConfig, accountId }),
    defaultAccountId: (cfg) =>
      resolveDefaultGianoAccountId(cfg as MoltbotConfig),
    isConfigured: async (account) => Boolean(account.token?.trim()),
    unconfiguredReason: () =>
      "missing token (channels.giano-channel.token or GIANO_BOT_TOKEN)",
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token?.trim()),
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (
        resolveGianoAccount({ cfg: cfg as MoltbotConfig, accountId }).config
          .allowFrom ?? []
      ).map((entry) => String(entry)),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^(giano-channel|giano):/i, ""))
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId =
        accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const gianoConfig = getChannelConfig(cfg as MoltbotConfig);
      const useAccountPath = Boolean(gianoConfig.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.giano-channel.accounts.${resolvedAccountId}.`
        : "channels.giano-channel.";
      return {
        policy: account.config.dmPolicy ?? "open",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: `Add user ID to channels.giano-channel.allowFrom`,
        normalizeEntry: (raw) => raw.replace(/^(giano-channel|giano):/i, ""),
      };
    },
  },
  groups: {
    resolveRequireMention: () => false,
  },
  threading: {
    resolveReplyToMode: () => "enabled",
  },
  messaging: {
    normalizeTarget: normalizeGianoMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) return false;
        // Giano uses UUIDs or numeric IDs
        return /^[a-f0-9-]{36}$/.test(trimmed) || /^\d+$/.test(trimmed);
      },
      hint: "<chatId>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, accountId, query, limit }) => {
      const account = resolveGianoAccount({
        cfg: cfg as MoltbotConfig,
        accountId,
      });
      const q = query?.trim().toLowerCase() || "";
      const peers = Array.from(
        new Set(
          (account.config.allowFrom ?? [])
            .map((entry) => String(entry).trim())
            .filter((entry) => Boolean(entry) && entry !== "*")
            .map((entry) => entry.replace(/^(giano-channel|giano):/i, "")),
        ),
      )
        .filter((id) => (q ? id.toLowerCase().includes(q) : true))
        .slice(0, limit && limit > 0 ? limit : undefined)
        .map((id) => ({ kind: "user", id }) as const);
      return peers;
    },
    listGroups: async () => [],
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) => {
      const current = (cfg as MoltbotConfig).channels?.["giano-channel"] ?? {};
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...(cfg as MoltbotConfig).channels,
            "giano-channel": { ...current, name },
          },
        } as MoltbotConfig;
      }
      return {
        ...cfg,
        channels: {
          ...(cfg as MoltbotConfig).channels,
          "giano-channel": {
            ...current,
            accounts: {
              ...current.accounts,
              [accountId]: { ...current.accounts?.[accountId], name },
            },
          },
        },
      } as MoltbotConfig;
    },
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "GIANO_BOT_TOKEN can only be used for the default account.";
      }
      if (!input.useEnv && !input.token) {
        return "Giano requires token (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const current = (cfg as MoltbotConfig).channels?.["giano-channel"] ?? {};
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...(cfg as MoltbotConfig).channels,
            "giano-channel": {
              ...current,
              enabled: true,
              ...(input.name ? { name: input.name } : {}),
              ...(input.useEnv
                ? {}
                : input.token
                  ? { token: input.token }
                  : {}),
              ...(input.apiBaseUrl ? { apiBaseUrl: input.apiBaseUrl } : {}),
              ...(input.wsUrl ? { wsUrl: input.wsUrl } : {}),
            },
          },
        } as MoltbotConfig;
      }
      return {
        ...cfg,
        channels: {
          ...(cfg as MoltbotConfig).channels,
          "giano-channel": {
            ...current,
            enabled: true,
            accounts: {
              ...current.accounts,
              [accountId]: {
                ...current.accounts?.[accountId],
                enabled: true,
                ...(input.name ? { name: input.name } : {}),
                ...(input.token ? { token: input.token } : {}),
                ...(input.apiBaseUrl ? { apiBaseUrl: input.apiBaseUrl } : {}),
                ...(input.wsUrl ? { wsUrl: input.wsUrl } : {}),
              },
            },
          },
        },
      } as MoltbotConfig;
    },
  },
  pairing: {
    idLabel: "gianoUserId",
    normalizeAllowEntry: (entry) =>
      entry.replace(/^(giano-channel|giano):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveGianoAccount({ cfg: cfg as MoltbotConfig });
      if (!account.token) throw new Error("Giano token not configured");
      await sendMessageGiano(id, "Your pairing request has been approved.", {
        token: account.token,
        cfg: cfg as MoltbotConfig,
      });
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => {
      if (!text) return [];
      if (limit <= 0 || text.length <= limit) return [text];
      const chunks: string[] = [];
      let remaining = text;
      while (remaining.length > limit) {
        const window = remaining.slice(0, limit);
        const lastNewline = window.lastIndexOf("\n");
        const lastSpace = window.lastIndexOf(" ");
        let breakIdx = lastNewline > 0 ? lastNewline : lastSpace;
        if (breakIdx <= 0) breakIdx = limit;
        const rawChunk = remaining.slice(0, breakIdx);
        const chunk = rawChunk.trimEnd();
        if (chunk.length > 0) chunks.push(chunk);
        const brokeOnSeparator =
          breakIdx < remaining.length && /\s/.test(remaining[breakIdx]);
        const nextStart = Math.min(
          remaining.length,
          breakIdx + (brokeOnSeparator ? 1 : 0),
        );
        remaining = remaining.slice(nextStart).trimStart();
      }
      if (remaining.length) chunks.push(remaining);
      return chunks;
    },
    chunkerMode: "text",
    textChunkLimit: 4000,
    sendText: async ({ to, text, accountId, cfg, replyToId }) => {
      const result = await sendMessageGiano(to, text, {
        accountId: accountId ?? undefined,
        cfg: cfg as MoltbotConfig,
        replyToId: replyToId ?? undefined,
      });
      return {
        channel: "giano-channel",
        ok: result.ok,
        messageId: result.messageId ?? "",
        error: result.error ? new Error(result.error) : undefined,
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (params) =>
      collectGianoStatusIssues({
        account: params.account as ResolvedGianoAccount,
        cfg: params.cfg as MoltbotConfig,
      }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) =>
      probeGiano(account as ResolvedGianoAccount, timeoutMs),
    buildAccountSnapshot: ({ account, runtime }) => {
      const configured = Boolean(account.token?.trim());
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
        dmPolicy: account.config.dmPolicy ?? "open",
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const token = account.token?.trim();

      if (!token) {
        ctx.setStatus({
          accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
          lastError: "missing token",
          enabled: true,
          configured: false,
        });
        throw new Error(
          "giano-channel missing token (channels.giano-channel.token or GIANO_BOT_TOKEN)",
        );
      }

      // Probe to get bot info
      let botLabel = "";
      try {
        const probe = await probeGiano(account, 2500);
        const name = probe.ok ? probe.bot?.name?.trim() : null;
        if (name) botLabel = ` (${name})`;
        ctx.setStatus({
          accountId: account.accountId,
          bot: probe.bot,
        });
      } catch {
        // ignore probe errors
      }

      ctx.log?.info?.(
        `[${account.accountId}] starting giano provider${botLabel}`,
      );

      ctx.setStatus({
        accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
        running: true,
        connected: false,
        lastStartAt: now(),
        lastError: null,
        enabled: true,
        configured: true,
      });

      // Import and use monitor
      const { monitorGianoProvider } = await import("./monitor.js");
      return monitorGianoProvider({
        account,
        config: ctx.cfg as MoltbotConfig,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) =>
          ctx.setStatus({ accountId: ctx.accountId, ...patch }),
      });
    },
    stopAccount: async (ctx) => {
      ctx.setStatus({
        accountId: ctx.accountId ?? DEFAULT_ACCOUNT_ID,
        running: false,
        connected: false,
        lastStopAt: now(),
        enabled: true,
        configured: true,
      });
    },
  },
};

export type { ResolvedGianoAccount };
