import { Bot, type InputFile } from "gianobot";
import {
  applyAccountNameToChannelSection,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  PAIRING_APPROVED_MESSAGE,
  setAccountEnabledInConfigSection,
  type ChannelPlugin,
  type OpenClawConfig,
  type ReplyPayload,
} from "openclaw/plugin-sdk";

import { getGianoRuntime } from "./runtime.js";

// ============================================================
// Types
// ============================================================

interface GianoConfig {
  enabled?: boolean;
  token?: string;
  name?: string;
  apiBaseUrl?: string;
  wsUrl?: string;
  dm?: {
    enabled?: boolean;
    policy?: "pairing" | "allowlist" | "open" | "disabled";
    allowFrom?: string[];
  };
  groupPolicy?: "open" | "allowlist" | "disabled";
  groups?: Record<
    string,
    {
      requireMention?: boolean;
      allowFrom?: string[];
      skills?: string[];
      systemPrompt?: string;
      enabled?: boolean;
    }
  >;
  mediaMaxMb?: number;
  historyLimit?: number;
  replyToMode?: "off" | "first" | "all";
  textChunkLimit?: number;
}

interface ResolvedGianoAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  token: string;
  tokenSource: "config" | "env" | "file" | "none";
  apiBaseUrl: string;
  wsUrl: string;
  config: GianoConfig;
}

// Account storage for active bot instances
const activeBots = new Map<string, Bot>();

// ============================================================
// Config Schema
// ============================================================

const GianoConfigSchema = {
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    token: { type: "string" },
    name: { type: "string" },
    apiBaseUrl: { type: "string" },
    wsUrl: { type: "string" },
    dm: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        policy: {
          type: "string",
          enum: ["pairing", "allowlist", "open", "disabled"],
        },
        allowFrom: { type: "array", items: { type: "string" } },
      },
    },
    groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
    groups: { type: "object", additionalProperties: true },
    mediaMaxMb: { type: "number" },
    historyLimit: { type: "number" },
    replyToMode: { type: "string", enum: ["off", "first", "all"] },
    textChunkLimit: { type: "number" },
  },
} as const;

// ============================================================
// Helper Functions
// ============================================================

function listGianoAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = cfg.channels?.giano?.accounts;
  if (!accounts) return [DEFAULT_ACCOUNT_ID];
  return [DEFAULT_ACCOUNT_ID, ...Object.keys(accounts)];
}

function resolveGianoAccount(params: {
  cfg?: OpenClawConfig | null;
  accountId?: string;
}): ResolvedGianoAccount {
  const cfg = params.cfg ?? ({} as OpenClawConfig);
  const accountId = params.accountId ?? DEFAULT_ACCOUNT_ID;
  const channelCfg = cfg.channels?.giano as GianoConfig | undefined;

  const accountCfg = channelCfg?.accounts?.[accountId] as
    | GianoConfig
    | undefined;

  let token = "";
  let tokenSource: "config" | "env" | "file" | "none" = "none";

  if (accountCfg?.token) {
    token = accountCfg.token;
    tokenSource = "config";
  } else if (accountId === DEFAULT_ACCOUNT_ID) {
    if (channelCfg?.token) {
      token = channelCfg.token;
      tokenSource = "config";
    } else if (process.env.GIANO_TOKEN) {
      token = process.env.GIANO_TOKEN;
      tokenSource = "env";
    }
  }

  const apiBaseUrl =
    accountCfg?.apiBaseUrl ??
    channelCfg?.apiBaseUrl ??
    process.env.GIANO_API_URL ??
    "http://localhost:3000";
  const wsUrl =
    accountCfg?.wsUrl ??
    channelCfg?.wsUrl ??
    process.env.GIANO_WS_URL ??
    "ws://localhost:3000";

  return {
    accountId,
    name: accountCfg?.name ?? channelCfg?.name,
    enabled: accountCfg?.enabled ?? channelCfg?.enabled ?? true,
    token,
    tokenSource,
    apiBaseUrl,
    wsUrl,
    config: {
      ...channelCfg,
      ...accountCfg,
    },
  };
}

function resolveDefaultGianoAccountId(cfg: OpenClawConfig): string | null {
  const channelCfg = cfg.channels?.giano;
  if (!channelCfg) return null;

  if (channelCfg.token || process.env.GIANO_TOKEN) {
    return DEFAULT_ACCOUNT_ID;
  }

  const accounts = channelCfg.accounts;
  if (accounts) {
    for (const id of Object.keys(accounts)) {
      if (accounts[id]?.token) return id;
    }
  }

  return null;
}

function collectGianoStatusIssues(params: {
  account?: ResolvedGianoAccount | null;
  cfg?: OpenClawConfig | null;
  accountId?: string;
}): string[] {
  const issues: string[] = [];
  const cfg = params.cfg ?? ({} as OpenClawConfig);
  const accountId = params.accountId ?? params.account?.accountId;
  const account = params.account ?? resolveGianoAccount({ cfg, accountId });

  if (!account.token?.trim()) {
    issues.push("Token not configured");
  }

  if (account.wsUrl?.includes("token=")) {
    issues.push(
      "WebSocket URL should not include token query; the SDK appends ?token= automatically",
    );
  }

  if (!account.apiBaseUrl) {
    issues.push("API base URL not configured");
  }

  if (!account.wsUrl) {
    issues.push("WebSocket URL not configured");
  }

  return issues;
}

function resolveGianoGroupRequireMention(params: {
  cfg: OpenClawConfig;
  groupId: string;
  accountId?: string;
}): boolean {
  const { cfg, groupId, accountId } = params;
  const account = resolveGianoAccount({ cfg, accountId });
  const groups = account.config.groups;

  const groupConfig = groups?.[groupId] ?? groups?.["*"];
  return groupConfig?.requireMention ?? true;
}

function resolveGianoGroupToolPolicy(params: {
  cfg: OpenClawConfig;
  groupId: string;
  accountId?: string;
}): { allow?: string[]; deny?: string[] } | null {
  return null;
}

function normalizeGianoMessagingTarget(target: string): string {
  return target.replace(/^(giano|gi):/i, "").trim();
}

function looksLikeGianoTargetId(input: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(input.trim());
}

function listGianoDirectoryPeersFromConfig(params: {
  cfg: OpenClawConfig;
  accountId?: string;
}): Array<{ id: string; name?: string }> {
  const { cfg, accountId } = params;
  const account = resolveGianoAccount({ cfg, accountId });
  const allowFrom = account.config.dm?.allowFrom ?? [];

  return allowFrom.map((entry) => ({
    id: String(entry),
    name: undefined,
  }));
}

function listGianoDirectoryGroupsFromConfig(params: {
  cfg: OpenClawConfig;
  accountId?: string;
}): Array<{ id: string; name?: string }> {
  const { cfg, accountId } = params;
  const account = resolveGianoAccount({ cfg, accountId });
  const groups = account.config.groups ?? {};

  return Object.entries(groups)
    .filter(([id]) => id !== "*")
    .map(([id]) => ({
      id,
      name: undefined,
    }));
}

// ============================================================
// Channel Metadata
// ============================================================

const meta = getChatChannelMeta("giano");

// ============================================================
// Main Channel Plugin Export
// ============================================================

export const gianoPlugin: ChannelPlugin<ResolvedGianoAccount> = {
  id: "giano",

  meta: {
    ...meta,
    displayName: "Giano",
    icon: "💬",
    themeColor: "#6366f1",
    quickstartAllowFrom: true,
  },

  pairing: {
    idLabel: "gianoUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(giano|gi):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveGianoAccount({ cfg });
      if (!account.token) throw new Error("Giano token not configured");

      const bot = new Bot(account.token, {
        mode: "websocket",
        apiBaseUrl: account.apiBaseUrl,
        wsUrl: account.wsUrl,
      });

      await bot.sendMessage(id, PAIRING_APPROVED_MESSAGE, {
        parseMode: "markdown",
      });
    },
  },

  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: true,
    threads: false,
    media: true,
    nativeCommands: true,
  },

  reload: { configPrefixes: ["channels.giano"] },

  configSchema: GianoConfigSchema,

  config: {
    listAccountIds: (cfg) => listGianoAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveGianoAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultGianoAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "giano",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "giano",
        accountId,
        clearBaseFields: ["token", "name", "apiBaseUrl", "wsUrl"],
      }),
    isConfigured: (account) => Boolean(account.token?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token?.trim()),
      tokenSource: account.tokenSource,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveGianoAccount({ cfg, accountId }).config.dm?.allowFrom ?? []).map(
        (entry) => String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },

  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId =
        accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        cfg.channels?.giano?.accounts?.[resolvedAccountId],
      );
      const basePath = useAccountPath
        ? `channels.giano.accounts.${resolvedAccountId}.`
        : "channels.giano.";

      return {
        policy: account.config.dm?.policy ?? "pairing",
        allowFrom: account.config.dm?.allowFrom ?? [],
        policyPath: `${basePath}dm.policy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("giano"),
        normalizeEntry: (raw) => raw.replace(/^(giano|gi):/i, ""),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const warnings: string[] = [];
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy =
        account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";

      if (groupPolicy === "open") {
        warnings.push(
          `- Giano groups: groupPolicy="open" allows any member to trigger. ` +
            `Set channels.giano.groupPolicy="allowlist" to restrict.`,
        );
      }

      return warnings;
    },
  },

  groups: {
    resolveRequireMention: resolveGianoGroupRequireMention,
    resolveToolPolicy: resolveGianoGroupToolPolicy,
  },

  threading: {
    resolveReplyToMode: ({ cfg }) =>
      cfg.channels?.giano?.replyToMode ?? "first",
  },

  messaging: {
    normalizeTarget: normalizeGianoMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeGianoTargetId,
      hint: "<chatId>",
    },
  },

  directory: {
    self: async () => null,
    listPeers: async (params) => listGianoDirectoryPeersFromConfig(params),
    listGroups: async (params) => listGianoDirectoryGroupsFromConfig(params),
  },

  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "giano",
        accountId,
        name,
      }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "GIANO_TOKEN can only be used for the default account.";
      }
      if (!input.useEnv && !input.token) {
        return "Giano requires token (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "giano",
        accountId,
        name: input.name,
      });

      const next =
        accountId !== DEFAULT_ACCOUNT_ID
          ? migrateBaseNameToDefaultAccount({
              cfg: namedConfig,
              channelKey: "giano",
            })
          : namedConfig;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: {
            ...next.channels,
            giano: {
              ...next.channels?.giano,
              enabled: true,
              ...(input.useEnv
                ? {}
                : input.token
                  ? { token: input.token }
                  : {}),
            },
          },
        };
      }

      return {
        ...next,
        channels: {
          ...next.channels,
          giano: {
            ...next.channels?.giano,
            enabled: true,
            accounts: {
              ...next.channels?.giano?.accounts,
              [accountId]: {
                ...next.channels?.giano?.accounts?.[accountId],
                enabled: true,
                ...(input.token ? { token: input.token } : {}),
              },
            },
          },
        },
      };
    },
  },

  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) =>
      getGianoRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4000,

    sendText: async ({ to, text, accountId, replyToId }) => {
      const runtime = getGianoRuntime();
      const cfg = await runtime.config.loadConfig();
      const account = resolveGianoAccount({ cfg, accountId });

      const bot = activeBots.get(account.accountId);
      if (!bot) {
        throw new Error(
          `Giano bot not running for account: ${account.accountId}`,
        );
      }

      const result = await bot.sendMessage(to, text, {
        replyToId: replyToId ?? undefined,
        parseMode: "markdown",
      });

      return {
        channel: "giano",
        messageId: result?.messageId ?? String(Date.now()),
        chatId: to,
      };
    },

    sendMedia: async ({ to, text, mediaUrl, accountId, replyToId }) => {
      const runtime = getGianoRuntime();
      const cfg = await runtime.config.loadConfig();
      const account = resolveGianoAccount({ cfg, accountId });

      const bot = activeBots.get(account.accountId);
      if (!bot) {
        throw new Error(
          `Giano bot not running for account: ${account.accountId}`,
        );
      }

      let result;
      if (mediaUrl) {
        let inputFile: InputFile = mediaUrl;
        let fileName: string | undefined;

        // Fetch remote media if it's a URL
        if (mediaUrl.startsWith("http")) {
          const res = await fetch(mediaUrl);
          const blob = await res.blob();
          inputFile = Buffer.from(await blob.arrayBuffer());
          fileName = mediaUrl.split("/").pop() || "file";
        } else {
          // Local file path
          fileName = mediaUrl.split(/[/\\]/).pop();
        }

        const isImage =
          /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName ?? "") ||
          (fileName && !fileName.includes(".")); // Assume image if no extension? Safer to check extension

        if (isImage) {
          await bot.sendChatAction(to, "upload_photo");
          result = await bot.sendPhoto(to, inputFile, {
            caption: text,
            replyToId: replyToId ?? undefined,
            parseMode: "markdown",
          });
        } else {
          await bot.sendChatAction(to, "upload_document");
          result = await bot.sendFile(to, inputFile, fileName, {
            caption: text,
            replyToId: replyToId ?? undefined,
            parseMode: "markdown",
          });
        }
      } else {
        await bot.sendChatAction(to, "typing");
        result = await bot.sendMessage(to, text, {
          replyToId: replyToId ?? undefined,
          parseMode: "markdown",
        });
      }

      return {
        channel: "giano",
        messageId: result?.messageId ?? String(Date.now()),
        chatId: to,
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
    collectStatusIssues: collectGianoStatusIssues,
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      mode: snapshot.mode ?? null,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      try {
        const bot = new Bot(account.token, {
          mode: "websocket",
          apiBaseUrl: account.apiBaseUrl,
          wsUrl: account.wsUrl,
        });

        // Try to get bot info
        const me = await bot.api.getMe();

        return {
          ok: true,
          bot: {
            id: me?.id,
            username: me?.username,
            displayName: me?.displayName ?? me?.username,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: String(error),
        };
      }
    },
    auditAccount: async () => undefined,
    buildAccountSnapshot: ({ account, runtime, probe, audit }) => {
      const configured = Boolean(account.token?.trim());
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        tokenSource: account.tokenSource,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        mode: "websocket",
        probe,
        audit,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
      };
    },
  },

  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const token = account.token.trim();

      ctx.log?.info(`[${account.accountId}] starting Giano provider`);

      // Create bot instance
      const bot = new Bot(token, {
        mode: "websocket",
        apiBaseUrl: account.apiBaseUrl,
        wsUrl: account.wsUrl,
        logLevel: ctx.log.level === "debug" ? "debug" : "info",
      });

      // Store bot instance for outbound messaging
      activeBots.set(account.accountId, bot);

      // Handle incoming messages
      bot.on("message", async (msgCtx) => {
        try {
          // Send typing action
          await msgCtx.sendChatAction("typing");

          const chatId = msgCtx.chatId;
          const userId = msgCtx.userId;
          const text = msgCtx.text ?? "";
          const messageId = msgCtx.messageId;
          const isGroup = msgCtx.message?.chat?.type === "group";
          const senderName = msgCtx.message?.from?.username ?? userId;

          const runtime = getGianoRuntime();
          const cfg = await runtime.config.loadConfig();

          // Resolve agent route
          const route = runtime.channel.routing.resolveAgentRoute({
            cfg,
            channel: "giano",
            accountId: account.accountId,
            peer: {
              kind: isGroup ? "group" : "direct",
              id: chatId,
            },
          });

          // Format message envelope
          let rawBody = text;

          // Append attachments to body if present
          if (msgCtx.message.attachments?.length) {
            const attachmentLinks = msgCtx.message.attachments
              .map((att) => `\n[Attachment: ${att.name} (${att.url})]`)
              .join("");
            rawBody += attachmentLinks;
          }
          const body = runtime.channel.reply.formatAgentEnvelope({
            channel: "Giano",
            from: senderName,
            timestamp: Date.now(),
            envelope: runtime.channel.reply.resolveEnvelopeFormatOptions(cfg),
            body: rawBody,
          });

          // Build inbound context
          const ctxPayload = runtime.channel.reply.finalizeInboundContext({
            Body: body,
            RawBody: rawBody,
            CommandBody: rawBody,
            From: `giano:user:${userId}`,
            To: `giano:chat:${chatId}`,
            SessionKey: route.sessionKey,
            AccountId: route.accountId,
            ChatType: isGroup ? "group" : "direct",
            ConversationLabel: chatId,
            SenderName: senderName,
            SenderId: userId,
            SenderUsername: senderName,
            Provider: "giano",
            Surface: "giano",
            MessageSid: messageId,
            OriginatingChannel: "giano",
            OriginatingTo: `giano:chat:${chatId}`,
          });

          // Record session
          const storePath = runtime.channel.session.resolveStorePath(
            cfg.session?.store,
            { agentId: route.agentId },
          );
          await runtime.channel.session.recordInboundSession({
            storePath,
            sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
            ctx: ctxPayload,
            onRecordError: (err: unknown) => {
              ctx.log?.error?.(
                `[${account.accountId}] Failed updating session meta: ${String(err)}`,
              );
            },
          });

          // Dispatch reply
          await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: ctxPayload,
            cfg,
            dispatcherOptions: {
              deliver: async (payload: ReplyPayload) => {
                const botInstance = activeBots.get(account.accountId);
                if (botInstance && payload.text) {
                  await botInstance.sendMessage(chatId, payload.text, {
                    replyToId: messageId,
                    parseMode: "markdown",
                  });
                }
              },
            },
          });
        } catch (error) {
          ctx.log?.error?.(
            `[${account.accountId}] message handler error: ${String(error)}`,
          );
        }
      });

      // Handle errors
      bot.on("error", (error) => {
        ctx.log?.error?.(`[${account.accountId}] bot error: ${String(error)}`);
      });

      // Start the bot
      await bot.start();

      ctx.log?.info(`[${account.accountId}] Giano bot connected`);

      // Wait for abort signal
      return new Promise<void>((resolve) => {
        ctx.abortSignal?.addEventListener("abort", async () => {
          ctx.log?.info(`[${account.accountId}] stopping Giano provider`);
          await bot.stop();
          activeBots.delete(account.accountId);
          resolve();
        });
      });
    },

    logoutAccount: async ({ accountId }: { accountId: string }) => {
      const bot = activeBots.get(accountId);
      if (bot) {
        await bot.stop();
        activeBots.delete(accountId);
      }

      return {
        cleared: true,
        envToken: Boolean(process.env.GIANO_TOKEN),
        loggedOut: true,
      };
    },
  },
};
