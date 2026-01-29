import type {
  ChannelAccountSnapshot,
  ChannelGatewayAdapter,
  ChannelGatewayContext,
  ChannelOutboundAdapter,
  ChannelPlugin,
  MoltbotConfig,
} from "moltbot/plugin-sdk";
import {
  createReplyDispatcherWithTyping,
  dispatchReplyFromConfig,
  finalizeInboundContext,
  resolveAgentRoute,
} from "moltbot/plugin-sdk";
import WebSocket from "ws";

type GianoChannelAccount = {
  enabled?: boolean;
  apiBaseUrl?: string;
  wsUrl?: string;
  token?: string; // user JWT access token
  botUserId?: string; // Bot's user ID to filter self messages
  allowFrom?: Array<string | number>;
};

type GianoChannelConfig = {
  accounts?: Record<string, GianoChannelAccount>;
};

function now() {
  return Date.now();
}

function getChannelConfig(cfg: MoltbotConfig): GianoChannelConfig {
  return ((cfg.channels as any)?.giano ?? {}) as GianoChannelConfig;
}

function getAccount(
  cfg: MoltbotConfig,
  accountId: string,
): GianoChannelAccount {
  const channelCfg = getChannelConfig(cfg);
  return channelCfg.accounts?.[accountId] ?? {};
}

async function gianoSendText(params: {
  cfg: MoltbotConfig;
  channelCfg: GianoChannelAccount;
  chatId: string;
  text: string;
  replyToId?: string | null;
}) {
  const c = params.channelCfg;
  const base = (c.apiBaseUrl ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const token = c.token;
  if (!token)
    throw new Error(
      "giano channel missing token (channels.giano.accounts.<id>.token)",
    );

  const url = `${base}/api/v1/chats/${encodeURIComponent(params.chatId)}/messages`;
  const body: any = { text: params.text };
  if (params.replyToId) body.replyTo = { id: params.replyToId };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`giano send failed: ${res.status} ${res.statusText} ${t}`);
  }

  const json: any = await res.json().catch(() => null);
  const messageId = json?.message?.id ?? json?.message?.messageId ?? "unknown";
  return { messageId: String(messageId), chatId: params.chatId };
}

const gianoOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunkerMode: "text",
  textChunkLimit: 4000,
  sendText: async ({ to, text, cfg, replyToId, accountId }) => {
    const channelCfg = getAccount(cfg, accountId ?? "default");
    const result = await gianoSendText({
      cfg,
      channelCfg,
      chatId: to,
      text,
      replyToId,
    });
    return {
      channel: "giano",
      messageId: result.messageId,
      chatId: result.chatId,
    };
  },
};

function buildRuntimeSnapshot(
  cfg: MoltbotConfig,
  channelCfg: GianoChannelAccount,
  accountId: string,
): ChannelAccountSnapshot {
  const c = channelCfg;
  return {
    accountId,
    enabled: c.enabled !== false,
    configured: Boolean(c.token),
    baseUrl: c.apiBaseUrl,
    mode: "ws",
  };
}

type GianoWsServerEvent =
  | { event: "connected"; data: any }
  | { event: "new_message"; data: { message: any } }
  | { event: "message_updated"; data: { message: any } }
  | { event: "error"; data: { code: string; message: string } };

const gianoGateway: ChannelGatewayAdapter<GianoChannelAccount> = {
  startAccount: async (ctx: ChannelGatewayContext<GianoChannelAccount>) => {
    const c = ctx.account as GianoChannelAccount;
    const wsUrl = (c.wsUrl ?? "ws://127.0.0.1:3000/ws").replace(/\/$/, "");
    const token = c.token;
    if (!token) {
      ctx.setStatus({
        ...buildRuntimeSnapshot(ctx.cfg, c, ctx.accountId),
        lastError: "missing token",
      });
      throw new Error(
        "giano channel missing token (channels.giano.accounts.<id>.token)",
      );
    }

    ctx.setStatus({
      ...buildRuntimeSnapshot(ctx.cfg, c, ctx.accountId),
      running: true,
      connected: false,
      lastStartAt: now(),
      lastError: null,
    });

    const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

    const closeWithStatus = (patch: Partial<ChannelAccountSnapshot>) => {
      ctx.setStatus({
        ...ctx.getStatus(),
        ...patch,
        connected: false,
        running: false,
        lastStopAt: now(),
      });
    };

    const onAbort = () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
    ctx.abortSignal.addEventListener("abort", onAbort);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ctx.setStatus({
          ...ctx.getStatus(),
          connected: true,
          lastConnectedAt: now(),
        });
        resolve();
      });
      ws.on("error", (err) => {
        reject(err);
      });
    });

    ws.on("message", async (buf) => {
      if (ctx.abortSignal.aborted) return;

      const raw = buf.toString();
      let event: GianoWsServerEvent | null = null;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }

      if (!event || typeof event !== "object") return;
      if (event.event !== "new_message") return;

      const message = (event as any).data?.message;
      if (!message) return;

      // Build route per chatId (treat each chat as a DM peer)
      const chatId = String(message.chatId ?? message.chat_id ?? "");
      const senderId = String(
        message.senderId ?? message.sender_id ?? "unknown",
      );
      const text = (message.text ?? "").toString();
      if (!chatId || !text.trim()) return;

      // Skip messages from self (bot) to prevent reply loops
      if (c.botUserId && senderId === c.botUserId) {
        return;
      }

      const route = resolveAgentRoute({
        cfg: ctx.cfg,
        channel: "giano",
        accountId: ctx.accountId,
        peer: { kind: "dm", id: chatId },
      });

      // Track activity
      ctx.setStatus({
        ...ctx.getStatus(),
        lastInboundAt: now(),
        lastMessageAt: now(),
      });

      // Minimal inbound context
      const inbound = finalizeInboundContext({
        Body: text,
        RawBody: text,
        CommandBody: text,
        From: senderId,
        To: chatId,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        MessageSid: String(message.id ?? ""),
        ChatType: "direct",
        Provider: "giano",
        Surface: "giano",
        OriginatingChannel: "giano",
        OriginatingTo: chatId,
        SenderId: senderId,
        SenderName: message.senderName ?? undefined,
      });

      const { dispatcher, replyOptions } = createReplyDispatcherWithTyping({
        deliver: async (payload, info) => {
          // Only send final + block. Skip tool noise by default.
          if (info.kind === "tool") return;
          const outText = payload.text ?? "";
          if (!outText.trim()) return;
          await gianoSendText({
            cfg: ctx.cfg,
            channelCfg: c,
            chatId,
            text: outText,
            replyToId: String(message.id ?? "") || undefined,
          });
          ctx.setStatus({ ...ctx.getStatus(), lastOutboundAt: now() });
        },
        onError: (err, info) => {
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

    await new Promise<void>((resolve) => {
      ws.on("close", () => resolve());
    });

    ctx.abortSignal.removeEventListener("abort", onAbort);
    closeWithStatus({ lastDisconnect: { at: now() } });
  },
  stopAccount: async (ctx) => {
    ctx.setStatus({
      ...ctx.getStatus(),
      running: false,
      connected: false,
      lastStopAt: now(),
    });
  },
};

export default {
  id: "giano-channel",
  register(api: any) {
    const plugin: ChannelPlugin<GianoChannelAccount> = {
      id: "giano",
      meta: {
        id: "giano",
        label: "Giano",
        selectionLabel: "Giano",
        docsPath: "/channels/giano",
        blurb: "Giano backend chat channel (HTTP send + WebSocket receive).",
      },
      capabilities: {
        chatTypes: ["direct", "group"],
        media: false,
        reactions: false,
      },
      config: {
        listAccountIds: (cfg) => {
          const channelCfg = getChannelConfig(cfg);
          return Object.keys(channelCfg.accounts ?? {});
        },
        resolveAccount: (cfg, accountId) =>
          getAccount(cfg, accountId ?? "default"),
        isEnabled: (account) => account.enabled !== false,
        isConfigured: async (account) => Boolean(account.token),
        unconfiguredReason: () =>
          "missing token (channels.giano.accounts.<id>.token)",
        describeAccount: (account, cfg, accountId) =>
          buildRuntimeSnapshot(cfg, account, accountId ?? "default"),
        resolveAllowFrom: ({ account }) =>
          account.allowFrom?.map((x) => String(x)),
        formatAllowFrom: ({ allowFrom }) =>
          allowFrom.map((x) => String(x).trim()).filter(Boolean),
      },
      outbound: gianoOutbound,
      gateway: gianoGateway,
      agentPrompt: {
        messageToolHints: () => [
          "Giano channel target is a chat UUID. Use message tool with channel='giano' and target=<chatId>.",
        ],
      },
    };

    api.registerChannel({ plugin });
  },
} as const;
