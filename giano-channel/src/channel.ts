import { Bot, Context } from "gianobot";
import type { ChannelPlugin, MoltbotConfig } from "moltbot/plugin-sdk";
import {
  createReplyDispatcherWithTyping,
  DEFAULT_ACCOUNT_ID,
  dispatchReplyFromConfig,
  finalizeInboundContext,
  getChatChannelMeta,
  resolveAgentRoute,
} from "moltbot/plugin-sdk";

// Types
export type GianoChannelAccount = {
  accountId?: string;
  name?: string;
  enabled?: boolean;
  apiBaseUrl?: string;
  wsUrl?: string;
  token?: string;
  botUserId?: string;
  allowFrom?: Array<string | number>;
};

type GianoChannelConfig = {
  enabled?: boolean;
  accounts?: Record<string, GianoChannelAccount>;
};

// Helpers
function now() {
  return Date.now();
}

function getChannelConfig(cfg: MoltbotConfig): GianoChannelConfig {
  const channels = cfg.channels as Record<string, unknown> | undefined;
  return (channels?.["giano-channel"] ?? {}) as GianoChannelConfig;
}

function resolveGianoAccount(params: {
  cfg: MoltbotConfig;
  accountId?: string;
}): GianoChannelAccount {
  const channelCfg = getChannelConfig(params.cfg);
  const accountId = params.accountId ?? DEFAULT_ACCOUNT_ID;
  const account = channelCfg.accounts?.[accountId] ?? {};
  return {
    ...account,
    accountId,
    enabled: account.enabled !== false,
  };
}

function listGianoAccountIds(cfg: MoltbotConfig): string[] {
  const channelCfg = getChannelConfig(cfg);
  return Object.keys(channelCfg.accounts ?? {});
}

const meta = getChatChannelMeta("giano-channel");

// Exported channel plugin
export const gianoChannelPlugin: ChannelPlugin<GianoChannelAccount> = {
  id: "giano-channel",
  meta: {
    ...meta,
    id: "giano-channel",
    label: "Giano",
    selectionLabel: "Giano",
    docsPath: "/channels/giano-channel",
    blurb: "Giano backend chat channel using gianobot SDK.",
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false,
    reactions: false,
  },
  config: {
    listAccountIds: (cfg) => listGianoAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveGianoAccount({ cfg, accountId }),
    isEnabled: (account) => account.enabled !== false,
    isConfigured: (account) => Boolean(account.token?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account.name,
      enabled: account.enabled !== false,
      configured: Boolean(account.token?.trim()),
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveGianoAccount({ cfg, accountId }).allowFrom ?? []).map((entry) =>
        String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^(giano-channel|giano):/i, ""))
        .map((entry) => entry.toLowerCase()),
  },
  outbound: {
    deliveryMode: "direct",
    chunker: null,
    textChunkLimit: 4000,
    sendText: async ({ to, text, cfg, replyToId, accountId }) => {
      const account = resolveGianoAccount({ cfg, accountId });
      const token = account.token?.trim();
      if (!token) {
        throw new Error(
          "giano-channel missing token (channels.giano-channel.accounts.<id>.token)",
        );
      }

      const bot = new Bot(token, {
        mode: "websocket",
        apiBaseUrl: account.apiBaseUrl ?? "http://127.0.0.1:3000",
        wsUrl: account.wsUrl ?? "ws://127.0.0.1:3000",
      });

      const result = await bot.sendMessage(to, text, {
        replyToId: replyToId ?? undefined,
      });

      return {
        channel: "giano-channel",
        messageId: String(result.messageId),
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
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account.name,
      enabled: account.enabled !== false,
      configured: Boolean(account.token?.trim()),
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const token = account.token?.trim();

      if (!token) {
        ctx.setStatus({
          accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
          lastError: "missing token",
        });
        throw new Error(
          "giano-channel missing token (channels.giano-channel.accounts.<id>.token)",
        );
      }

      ctx.log?.info(
        `[${account.accountId ?? DEFAULT_ACCOUNT_ID}] starting giano provider`,
      );

      ctx.setStatus({
        accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
        running: true,
        connected: false,
        lastStartAt: now(),
        lastError: null,
      });

      const bot = new Bot(token, {
        mode: "websocket",
        apiBaseUrl: account.apiBaseUrl ?? "http://127.0.0.1:3000",
        wsUrl: account.wsUrl ?? "ws://127.0.0.1:3000",
      });

      // Handle incoming messages
      bot.on("text", async (botCtx: Context) => {
        if (ctx.abortSignal.aborted) return;

        const chatId = botCtx.chatId;
        const senderId = botCtx.userId;
        const text = botCtx.text ?? "";
        const messageId = botCtx.messageId;

        if (!chatId || !text.trim()) return;

        // Skip messages from self (bot) to prevent reply loops
        if (account.botUserId && senderId === account.botUserId) {
          return;
        }

        const route = resolveAgentRoute({
          cfg: ctx.cfg,
          channel: "giano-channel",
          accountId: ctx.accountId,
          peer: { kind: "dm", id: chatId },
        });

        ctx.setStatus({
          ...ctx.getStatus(),
          lastInboundAt: now(),
        });

        const inbound = finalizeInboundContext({
          Body: text,
          RawBody: text,
          CommandBody: text,
          From: senderId,
          To: chatId,
          SessionKey: route.sessionKey,
          AccountId: route.accountId,
          MessageSid: messageId,
          ChatType: "direct",
          Provider: "giano-channel",
          Surface: "giano-channel",
          OriginatingChannel: "giano-channel",
          OriginatingTo: chatId,
          SenderId: senderId,
          SenderName: undefined,
        });

        const { dispatcher, replyOptions } = createReplyDispatcherWithTyping({
          deliver: async (
            payload: { text?: string },
            info: { kind: string },
          ) => {
            if (info.kind === "tool") return;
            const outText = payload.text ?? "";
            if (!outText.trim()) return;

            await bot.sendMessage(chatId, outText, {
              replyToId: messageId,
            });
            ctx.setStatus({ ...ctx.getStatus(), lastOutboundAt: now() });
          },
          onError: (err: unknown, info: { kind: string }) => {
            ctx.log?.error?.(
              `giano deliver failed (${info.kind}): ${String(err)}`,
            );
          },
          onReplyStart: () => {
            // no typing indicator in giano yet
          },
        });

        await dispatchReplyFromConfig({
          ctx: inbound,
          cfg: ctx.cfg,
          dispatcher,
          replyOptions,
        });
      });

      // Handle ready event
      bot.on("ready", () => {
        ctx.log?.info(
          `[${account.accountId ?? DEFAULT_ACCOUNT_ID}] giano provider connected`,
        );
        ctx.setStatus({
          ...ctx.getStatus(),
          connected: true,
        });
      });

      // Handle abort signal
      const onAbort = async () => {
        await bot.stop();
      };
      ctx.abortSignal.addEventListener("abort", onAbort);

      // Start the bot
      await bot.start();

      // Wait for bot to be stopped
      await new Promise<void>((resolve) => {
        bot.on("stopped", () => {
          ctx.setStatus({
            ...ctx.getStatus(),
            connected: false,
            running: false,
            lastStopAt: now(),
          });
          resolve();
        });
      });

      ctx.abortSignal.removeEventListener("abort", onAbort);
    },
  },
};
