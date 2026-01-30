import { Bot, Context } from "gianobot";
import type { MoltbotConfig } from "moltbot/plugin-sdk";

import { getGianoRuntime } from "./runtime.js";
import type { ResolvedGianoAccount } from "./types.js";

export type GianoRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
};

export type GianoMonitorOptions = {
  account: ResolvedGianoAccount;
  config: MoltbotConfig;
  runtime: GianoRuntimeEnv;
  abortSignal: AbortSignal;
  statusSink?: (patch: {
    lastInboundAt?: number;
    lastOutboundAt?: number;
    connected?: boolean;
  }) => void;
};

export type GianoMonitorResult = {
  stop: () => void;
};

const GIANO_TEXT_LIMIT = 4000;

type GianoCoreRuntime = ReturnType<typeof getGianoRuntime>;

function now() {
  return Date.now();
}

function logVerbose(
  core: GianoCoreRuntime,
  runtime: GianoRuntimeEnv,
  message: string,
): void {
  if (core?.logging?.shouldLogVerbose?.()) {
    runtime.log?.(`[giano] ${message}`);
  }
}

function isSenderAllowed(senderId: string, allowFrom: string[]): boolean {
  if (allowFrom.includes("*")) return true;
  const normalizedSenderId = senderId.toLowerCase();
  return allowFrom.some((entry) => {
    const normalized = entry
      .toLowerCase()
      .replace(/^(giano-channel|giano):/i, "");
    return normalized === normalizedSenderId;
  });
}

async function processMessage(params: {
  botCtx: Context;
  bot: Bot;
  account: ResolvedGianoAccount;
  config: MoltbotConfig;
  runtime: GianoRuntimeEnv;
  core: GianoCoreRuntime;
  statusSink?: (patch: {
    lastInboundAt?: number;
    lastOutboundAt?: number;
  }) => void;
}): Promise<void> {
  const { botCtx, bot, account, config, runtime, core, statusSink } = params;

  const chatId = botCtx.chatId;
  const senderId = botCtx.userId;
  const text = botCtx.text ?? "";
  const messageId = botCtx.messageId;

  runtime.log?.(`[${account.accountId}] processMessage: chatId=${chatId}, senderId=${senderId}, text="${text.slice(0, 50)}..."`);

  if (!chatId || !text.trim()) {
    runtime.log?.(`[${account.accountId}] processMessage: empty chatId or text, skipping`);
    return;
  }

  // Skip messages from self (bot) to prevent reply loops
  if (account.config.botUserId && senderId === account.config.botUserId) {
    return;
  }

  // Detect if group chat - gianobot Context may have chatType in future versions
  const isGroup =
    (botCtx as unknown as { chatType?: string }).chatType === "group";
  const rawBody = text.trim();

  // Check DM policy
  const dmPolicy = account.config.dmPolicy ?? "open";
  const configAllowFrom = (account.config.allowFrom ?? []).map((v) =>
    String(v),
  );

  if (!isGroup && dmPolicy !== "open") {
    const allowed = isSenderAllowed(senderId, configAllowFrom);

    if (!allowed) {
      if (dmPolicy === "disabled") {
        logVerbose(
          core,
          runtime,
          `Blocked giano DM from ${senderId} (dmPolicy=disabled)`,
        );
        return;
      }
      if (dmPolicy === "allowlist") {
        logVerbose(
          core,
          runtime,
          `Blocked unauthorized giano sender ${senderId} (dmPolicy=allowlist)`,
        );
        return;
      }
      // pairing - for now just log, would need pairing store integration
      logVerbose(
        core,
        runtime,
        `Giano DM from ${senderId} not in allowlist (dmPolicy=pairing)`,
      );
    }
  }

  // Check group policy
  if (isGroup) {
    const groupPolicy = account.config.groupPolicy ?? "open";
    if (groupPolicy === "disabled") {
      logVerbose(
        core,
        runtime,
        `Blocked giano group ${chatId} (groupPolicy=disabled)`,
      );
      return;
    }
    if (groupPolicy === "allowlist") {
      const groups = account.config.groups ?? {};
      const allowed =
        groups[chatId]?.allow !== false && groups[chatId]?.enabled !== false;
      if (!allowed && !groups["*"]) {
        logVerbose(
          core,
          runtime,
          `Blocked giano group ${chatId} (not allowlisted)`,
        );
        return;
      }
    }
  }

  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "giano-channel",
    accountId: account.accountId,
    peer: { kind: isGroup ? "group" : "dm", id: chatId },
  });

  statusSink?.({ lastInboundAt: now() });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: senderId,
    To: chatId,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    MessageSid: messageId,
    ChatType: isGroup ? "group" : "direct",
    Provider: "giano-channel",
    Surface: "giano-channel",
    OriginatingChannel: "giano-channel",
    OriginatingTo: chatId,
    SenderId: senderId,
    SenderName: undefined,
  });

  // Record inbound session if available
  const storePath = core?.storage?.getSessionStorePath?.() ?? undefined;
  if (storePath && core?.channel?.session?.recordInboundSession) {
    await core.channel.session.recordInboundSession({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
      onRecordError: (err: unknown) => {
        runtime.error?.(`giano: failed updating session meta: ${String(err)}`);
      },
    });
  }

  // Get table mode for formatting
  const tableMode =
    core?.channel?.text?.resolveMarkdownTableMode?.({
      cfg: config,
      channel: "giano-channel",
      accountId: account.accountId,
    }) ?? "standard";

  // Use dispatchReplyWithBufferedBlockDispatcher if available, otherwise fallback
  if (core?.channel?.reply?.dispatchReplyWithBufferedBlockDispatcher) {
    runtime.log?.(`[${account.accountId}] Dispatching via dispatchReplyWithBufferedBlockDispatcher`);
    runtime.log?.(`[${account.accountId}] ctx.SessionKey=${ctxPayload.SessionKey}, chatId=${chatId}, senderId=${senderId}`);
    try {
      await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: config,
        dispatcherOptions: {
          deliver: async (payload: { text?: string }) => {
            runtime.log?.(`[${account.accountId}] deliver() called with payload.text length=${payload.text?.length ?? 0}`);
            await deliverGianoReply({
              payload,
              bot,
              chatId,
              messageId,
              runtime,
              core,
              config,
              accountId: account.accountId,
              statusSink,
              tableMode,
            });
          },
          onError: (err: unknown, info: { kind: string }) => {
            runtime.error?.(
              `[${account.accountId}] Giano ${info.kind} reply failed: ${String(err)}`,
            );
          },
        },
      });
      runtime.log?.(`[${account.accountId}] dispatchReplyWithBufferedBlockDispatcher completed`);
    } catch (dispatchErr) {
      runtime.error?.(`[${account.accountId}] dispatchReplyWithBufferedBlockDispatcher threw: ${String(dispatchErr)}`);
    }
  } else {
    // Fallback for simple dispatch
    runtime.log?.(`[${account.accountId}] Using fallback reply dispatch`);
    const response = await core?.agent?.processMessage?.(ctxPayload, config);
    if (response?.text) {
      await deliverGianoReply({
        payload: { text: response.text },
        bot,
        chatId,
        messageId,
        runtime,
        core,
        config,
        accountId: account.accountId,
        statusSink,
        tableMode,
      });
    }
  }
}

async function deliverGianoReply(params: {
  payload: { text?: string };
  bot: Bot;
  chatId: string;
  messageId: string;
  runtime: GianoRuntimeEnv;
  core: GianoCoreRuntime;
  config: MoltbotConfig;
  accountId?: string;
  statusSink?: (patch: { lastOutboundAt?: number }) => void;
  tableMode?: string;
}): Promise<void> {
  const { payload, bot, chatId, messageId, runtime, statusSink, accountId } = params;

  runtime.log?.(`[${accountId}] deliverGianoReply called, payload.text="${payload.text?.slice(0, 100)}..."`);

  const outText = payload.text ?? "";
  if (!outText.trim()) {
    runtime.log?.(`[${accountId}] deliverGianoReply: empty text, skipping`);
    return;
  }

  // Chunk long messages
  const chunks = chunkText(outText, GIANO_TEXT_LIMIT);
  runtime.log?.(`[${accountId}] deliverGianoReply: sending ${chunks.length} chunk(s) to chatId=${chatId}`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      runtime.log?.(`[${accountId}] Sending chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      await bot.sendMessage(chatId, chunk, {
        replyToId: messageId,
      });
      runtime.log?.(`[${accountId}] Chunk ${i + 1} sent successfully`);
    } catch (err) {
      runtime.error?.(`[${accountId}] giano send failed: ${String(err)}`);
    }
  }
  statusSink?.({ lastOutboundAt: now() });
  runtime.log?.(`[${accountId}] deliverGianoReply completed`);
}

function chunkText(text: string, limit: number): string[] {
  if (!text || text.length <= limit) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const lastNewline = window.lastIndexOf("\n");
    const lastSpace = window.lastIndexOf(" ");
    let breakIdx = lastNewline > 0 ? lastNewline : lastSpace;
    if (breakIdx <= 0) breakIdx = limit;

    const chunk = remaining.slice(0, breakIdx).trimEnd();
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
}

export async function monitorGianoProvider(
  options: GianoMonitorOptions,
): Promise<GianoMonitorResult> {
  const { account, config, runtime, abortSignal, statusSink } = options;
  const core = getGianoRuntime();

  const token = account.token.trim();
  if (!token) {
    throw new Error("giano-channel missing token");
  }

  runtime.log?.(`[${account.accountId}] starting giano provider`);

  const bot = new Bot(token, {
    mode: "websocket",
    apiBaseUrl: account.apiBaseUrl,
    wsUrl: account.wsUrl,
    logLevel: "info",
  });

  let stopped = false;

  // Handle incoming messages - with simple echo for testing
  bot.on("text", async (botCtx: Context) => {
    if (abortSignal.aborted || stopped) return;

    const text = botCtx.text || "";
    const sender = botCtx.userId || "unknown";
    const chatId = botCtx.chatId;
    
    runtime.log?.(`[${account.accountId}] 📩 Received message from ${sender} in chat ${chatId}: "${text.slice(0, 100)}"`);

    // Simple ping/pong test
    if (text.toLowerCase() === "/ping") {
      try {
        await botCtx.reply("🏓 Pong! Giano channel is working!");
        runtime.log?.(`[${account.accountId}] ↪️ Replied pong success`);
      } catch (err) {
        runtime.error?.(`[${account.accountId}] ❌ Ping reply failed: ${String(err)}`);
      }
      return;
    }

    // Echo test command
    if (text.toLowerCase().startsWith("/echo ")) {
      const echoText = text.slice(6);
      try {
        await botCtx.reply(`Echo: ${echoText}`);
        runtime.log?.(`[${account.accountId}] ↪️ Echo replied success`);
      } catch (err) {
        runtime.error?.(`[${account.accountId}] ❌ Echo reply failed: ${String(err)}`);
      }
      return;
    }

    // Process normally through Moltbot
    await processMessage({
      botCtx,
      bot,
      account,
      config,
      runtime,
      core,
      statusSink,
    });
  });

  // Handle ready event
  bot.on("ready", () => {
    runtime.log?.(`[${account.accountId}] ✅ giano provider connected and ready!`);
    statusSink?.({ connected: true });
  });

  // Handle error event
  bot.on("error" as never, (err: unknown) => {
    runtime.error?.(`[${account.accountId}] 🔥 Bot error: ${String(err)}`);
  });

  // Handle abort signal
  const onAbort = async () => {
    stopped = true;
    await bot.stop();
  };
  abortSignal.addEventListener("abort", onAbort);

  // Start the bot
  await bot.start();

  // Wait for bot to be stopped
  await new Promise<void>((resolve) => {
    bot.on("stopped", () => {
      statusSink?.({ connected: false });
      resolve();
    });
  });

  abortSignal.removeEventListener("abort", onAbort);

  return {
    stop: () => {
      stopped = true;
      bot.stop();
    },
  };
}
