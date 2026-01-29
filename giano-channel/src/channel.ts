import type {
  ChannelAccountSnapshot,
  ChannelGatewayAdapter,
  ChannelGatewayContext,
  ChannelOutboundAdapter,
  ChannelPlugin,
  MoltbotConfig,
} from "clawdbot/plugin-sdk";
import {
  createReplyDispatcherWithTyping,
  dispatchReplyFromConfig,
  finalizeInboundContext,
  resolveAgentRoute,
} from "clawdbot/plugin-sdk";
import { Bot, Context } from "gianobot";

// Types
export type GianoChannelAccount = {
  enabled?: boolean;
  apiBaseUrl?: string;
  wsUrl?: string;
  token?: string;
  botUserId?: string;
  allowFrom?: Array<string | number>;
};

type GianoChannelConfig = {
  accounts?: Record<string, GianoChannelAccount>;
};

// Send text params type
type SendTextParams = {
  to: string;
  text: string;
  cfg: MoltbotConfig;
  replyToId?: string;
  accountId?: string;
};

// Helpers
function now() {
  return Date.now();
}

function getChannelConfig(cfg: MoltbotConfig): GianoChannelConfig {
  const channels = cfg.channels as Record<string, unknown> | undefined;
  return (channels?.["giano-channel"] ?? {}) as GianoChannelConfig;
}

function getAccount(
  cfg: MoltbotConfig,
  accountId: string,
): GianoChannelAccount {
  const channelCfg = getChannelConfig(cfg);
  return channelCfg.accounts?.[accountId] ?? {};
}

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

// Task status detection helpers
type TaskStatusType =
  | "received"
  | "progress"
  | "done"
  | "failed"
  | "blocked"
  | "released"
  | null;

interface ParsedTaskStatus {
  type: TaskStatusType;
  taskId: string | null;
  message: string;
  percent?: number;
  phase?: string;
}

function parseTaskStatusMessage(text: string): ParsedTaskStatus | null {
  // Detect mcp-giano-bridge status messages
  // Patterns:
  // ✅ Task received (taskId=xxx)
  // ✅ Done (taskId=xxx)
  // ❌ Failed (taskId=xxx)
  // 🟨 Blocked (taskId=xxx)
  // 🟪 Progress (phase=xxx, 50%): message
  // 🟧 Task released (taskId=xxx)

  const taskIdMatch = text.match(/taskId=([a-zA-Z0-9_-]+)/);
  const taskId = taskIdMatch?.[1] ?? null;

  if (text.startsWith("✅ Task received")) {
    return { type: "received", taskId, message: text };
  }
  if (text.startsWith("✅ Done")) {
    return { type: "done", taskId, message: text };
  }
  if (text.startsWith("❌ Failed")) {
    return { type: "failed", taskId, message: text };
  }
  if (text.startsWith("🟨 Blocked")) {
    return { type: "blocked", taskId, message: text };
  }
  if (text.startsWith("🟧 Task released")) {
    return { type: "released", taskId, message: text };
  }
  if (text.startsWith("🟪 Progress")) {
    const percentMatch = text.match(/(\d+)%/);
    const phaseMatch = text.match(/phase=([^,)]+)/);
    return {
      type: "progress",
      taskId,
      message: text,
      percent: percentMatch ? parseInt(percentMatch[1], 10) : undefined,
      phase: phaseMatch?.[1],
    };
  }

  return null;
}

function isFromIdeBridgeBot(
  senderId: string,
  targetBotUserId?: string,
): boolean {
  // If targetBotUserId is configured, check if message is from that bot
  return targetBotUserId ? senderId === targetBotUserId : false;
}

// Outbound adapter using Bot SDK
const gianoOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunkerMode: "text",
  textChunkLimit: 4000,
  sendText: async ({ to, text, cfg, replyToId, accountId }: SendTextParams) => {
    const channelCfg = getAccount(cfg, accountId ?? "default");
    const token = channelCfg.token;
    if (!token) {
      throw new Error(
        "giano-channel missing token (channels.giano-channel.accounts.<id>.token)",
      );
    }

    // Create temporary Bot instance for sending
    const bot = new Bot(token, {
      mode: "websocket",
      apiBaseUrl: channelCfg.apiBaseUrl ?? "http://127.0.0.1:3000",
      wsUrl: channelCfg.wsUrl ?? "ws://127.0.0.1:3000",
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
};

// Gateway adapter using Bot SDK WebSocket
const gianoGateway: ChannelGatewayAdapter<GianoChannelAccount> = {
  startAccount: async (ctx: ChannelGatewayContext<GianoChannelAccount>) => {
    const c = ctx.account as GianoChannelAccount;
    const token = c.token;

    if (!token) {
      ctx.setStatus({
        ...buildRuntimeSnapshot(ctx.cfg, c, ctx.accountId),
        lastError: "missing token",
      });
      throw new Error(
        "giano-channel missing token (channels.giano-channel.accounts.<id>.token)",
      );
    }

    ctx.setStatus({
      ...buildRuntimeSnapshot(ctx.cfg, c, ctx.accountId),
      running: true,
      connected: false,
      lastStartAt: now(),
      lastError: null,
    });

    // Create Bot instance using SDK
    const bot = new Bot(token, {
      mode: "websocket",
      apiBaseUrl: c.apiBaseUrl ?? "http://127.0.0.1:3000",
      wsUrl: c.wsUrl ?? "ws://127.0.0.1:3000",
    });

    // Handle incoming messages using SDK's on() method
    bot.on("message", async (botCtx: Context) => {
      if (ctx.abortSignal.aborted) return;

      const chatId = botCtx.chatId;
      const senderId = botCtx.userId;
      const text = botCtx.text ?? "";
      const messageId = botCtx.messageId;

      if (!chatId || !text.trim()) return;

      // Skip messages from self (bot) to prevent reply loops
      if (c.botUserId && senderId === c.botUserId) {
        return;
      }

      // Get targetBotUserId from channel config
      const channels = ctx.cfg.channels as Record<string, unknown> | undefined;
      const channelCfg = (channels?.["giano-channel"] ?? {}) as {
        targetBotUserId?: string;
      };

      // Check if message is from mcp-giano-bridge bot
      const taskStatus = parseTaskStatusMessage(text);
      const isFromIdeBridge = isFromIdeBridgeBot(
        senderId,
        channelCfg.targetBotUserId,
      );

      // If message is a task status from IDE bridge, enhance the context
      let enhancedText = text;
      if (taskStatus && isFromIdeBridge) {
        // Add metadata for AI to understand this is a task status update
        enhancedText = `[IDE_TASK_STATUS: ${taskStatus.type}] ${text}`;

        // Log task status for debugging
        ctx.log?.info?.(
          `Task status from IDE bridge: type=${taskStatus.type}, taskId=${taskStatus.taskId}`,
        );
      }

      const route = resolveAgentRoute({
        cfg: ctx.cfg,
        channel: "giano-channel",
        accountId: ctx.accountId,
        peer: { kind: "dm", id: chatId },
      });

      // Track activity
      ctx.setStatus({
        ...ctx.getStatus(),
        lastInboundAt: now(),
        lastMessageAt: now(),
      });

      // Inbound context
      const inbound = finalizeInboundContext({
        Body: enhancedText,
        RawBody: text,
        CommandBody: enhancedText,
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
        // Pass task status metadata if available
        ...(taskStatus ? { TaskStatus: taskStatus } : {}),
      });

      const { dispatcher, replyOptions } = createReplyDispatcherWithTyping({
        deliver: async (payload: { text?: string }, info: { kind: string }) => {
          if (info.kind === "tool") return;
          const outText = payload.text ?? "";
          if (!outText.trim()) return;

          // Use Bot SDK to send reply
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

    // Handle bot ready event
    bot.on("ready", () => {
      ctx.setStatus({
        ...ctx.getStatus(),
        connected: true,
        lastConnectedAt: now(),
      });
    });

    // Handle abort signal
    const onAbort = async () => {
      await bot.stop();
    };
    ctx.abortSignal.addEventListener("abort", onAbort);

    // Start the bot (establishes WebSocket connection)
    await bot.start();

    // Wait for bot to be stopped (blocks until stop is called)
    await new Promise<void>((resolve) => {
      bot.on("stopped", () => resolve());
    });

    ctx.abortSignal.removeEventListener("abort", onAbort);

    // Emit stopped event if bot hasn't already
    bot.on("stopped", () => {
      ctx.setStatus({
        ...ctx.getStatus(),
        connected: false,
        running: false,
        lastStopAt: now(),
        lastDisconnect: { at: now() },
      });
    });
  },

  stopAccount: async (ctx: ChannelGatewayContext<GianoChannelAccount>) => {
    ctx.setStatus({
      ...ctx.getStatus(),
      running: false,
      connected: false,
      lastStopAt: now(),
    });
  },
};

// Helper to send task to mcp-giano-bridge bot
export async function sendTaskToIdeBridge(params: {
  bot: Bot;
  chatId: string;
  task: {
    taskId?: string;
    goal: string;
    title?: string;
    steps?: string[];
    files?: string[];
    notes?: string;
  };
  replyToId?: string;
}) {
  const taskId =
    params.task.taskId ??
    `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const taskPayload = {
    version: "v2",
    taskId,
    goal: params.task.goal,
    title: params.task.title,
    steps: params.task.steps,
    files: params.task.files,
    notes: params.task.notes,
  };

  // Send as /task JSON message - mcp-giano-bridge will pick this up
  const taskMessage = `/task ${JSON.stringify(taskPayload)}`;
  await params.bot.sendMessage(params.chatId, taskMessage, {
    replyToId: params.replyToId,
  });

  return { taskId, message: taskMessage };
}

// Exported channel plugin
export const gianoChannelPlugin: ChannelPlugin<GianoChannelAccount> = {
  id: "giano-channel",
  meta: {
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
    listAccountIds: (cfg: MoltbotConfig) => {
      const channelCfg = getChannelConfig(cfg);
      return Object.keys(channelCfg.accounts ?? {});
    },
    resolveAccount: (cfg: MoltbotConfig, accountId?: string) =>
      getAccount(cfg, accountId ?? "default"),
    isEnabled: (account: GianoChannelAccount) => account.enabled !== false,
    isConfigured: async (account: GianoChannelAccount) =>
      Boolean(account.token),
    unconfiguredReason: () =>
      "missing token (channels.giano-channel.accounts.<id>.token)",
    describeAccount: (
      account: GianoChannelAccount,
      cfg: MoltbotConfig,
      accountId?: string,
    ) => buildRuntimeSnapshot(cfg, account, accountId ?? "default"),
    resolveAllowFrom: ({ account }: { account: GianoChannelAccount }) =>
      account.allowFrom?.map((x: string | number) => String(x)),
    formatAllowFrom: ({ allowFrom }: { allowFrom?: string[] }) =>
      allowFrom?.map((x: string) => String(x).trim()).filter(Boolean) ?? [],
  },
  outbound: gianoOutbound,
  gateway: gianoGateway,
  agentPrompt: {
    messageToolHints: () => [
      "Giano channel target is a chat UUID. Use message tool with channel='giano-channel' and target=<chatId>.",
      "Use delegate_to_ide tool to send coding tasks to the IDE agent (mcp-giano-bridge).",
    ],
  },
};

// Agent tool for delegating tasks to IDE
export const delegateToIdeTool = {
  name: "delegate_to_ide",
  description:
    "Delegate a coding task to the IDE agent (mcp-giano-bridge). Use when user needs code changes, file modifications, or complex technical tasks.",
  parameters: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description: "What the IDE agent should accomplish",
      },
      title: {
        type: "string",
        description: "Short task title (optional)",
      },
      steps: {
        type: "array",
        items: { type: "string" },
        description: "Suggested steps (optional)",
      },
      files: {
        type: "array",
        items: { type: "string" },
        description: "Files to modify (optional)",
      },
      notes: {
        type: "string",
        description: "Additional context (optional)",
      },
    },
    required: ["goal"],
  },
};
