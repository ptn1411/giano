import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Bot } from '@messages-api/bot-sdk';
import type { Context } from '@messages-api/bot-sdk';

type TaskItem = {
  taskId: string;
  updateId: string;
  messageId: string;
  chatId: string;
  fromUserId: string;
  text: string;
  receivedAt: string;
  // used for threaded replies
  replyToId: string;
};

const botTokenEnv = process.env.GIANO_BOT_TOKEN ?? process.env.MESSAGES_BOT_TOKEN;
const apiBaseUrl = process.env.GIANO_API_BASE_URL ?? process.env.MESSAGES_API_BASE_URL ?? 'http://localhost:3000';
const wsUrl = process.env.GIANO_WS_URL ?? process.env.MESSAGES_WS_URL ?? 'ws://localhost:3000/bot/ws';

if (!botTokenEnv) {
  // eslint-disable-next-line no-console
  console.error('Missing bot token. Set GIANO_BOT_TOKEN (or MESSAGES_BOT_TOKEN).');
  process.exit(2);
}

const BOT_TOKEN: string = botTokenEnv;

// In-memory task queue (simple). For production: persist to DB/redis.
const queue: TaskItem[] = [];
const inFlight = new Map<string, TaskItem>();

function normalizeTaskText(raw: string) {
  return raw.trim();
}

function parseTaskIdFromText(text: string): string | null {
  // Supported formats:
  // - first line: "taskId: <id>"
  // - JSON containing {"taskId": "..."}
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const m = firstLine.match(/taskId\s*[:=]\s*([A-Za-z0-9._-]+)/i);
  if (m) return m[1];

  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj.taskId === 'string') return obj.taskId;
  } catch {
    // ignore
  }
  return null;
}

function ctxToTask(ctx: any): TaskItem {
  const text = normalizeTaskText(ctx.text ?? '');
  const taskId = parseTaskIdFromText(text) ?? String(ctx.updateId);
  return {
    taskId,
    updateId: String(ctx.updateId),
    messageId: String(ctx.message?.messageId ?? ''),
    chatId: String(ctx.chatId),
    fromUserId: String(ctx.userId),
    text,
    receivedAt: new Date().toISOString(),
    replyToId: String(ctx.message?.messageId ?? ''),
  };
}

async function startBot() {
  const bot = new Bot(BOT_TOKEN, {
    mode: 'websocket',
    apiBaseUrl,
    wsUrl,
    logLevel: 'info',
  });

  bot.on('text', async (ctx: Context) => {
    const task = ctxToTask(ctx as any);

    // Heuristic: treat messages starting with /task or having taskId/json as tasks.
    const isLikelyTask =
      task.text.startsWith('/task') ||
      task.text.startsWith('TASK') ||
      /taskId\s*[:=]/i.test(task.text);

    if (!isLikelyTask) return;

    queue.push(task);

    // Optional immediate ACK back to Giano chat
    const autoAck = (process.env.GIANO_AUTO_ACK ?? 'true') === 'true';
    if (autoAck) {
      await ctx.reply(`✅ Task received (taskId=${task.taskId}).\nAgent will start soon.`);
    }
  });

  bot.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Bot error:', err);
  });

  await bot.start();
  return bot;
}

const server = new McpServer({
  name: 'mcp-giano-bridge',
  version: '0.1.0',
});

server.tool(
  'giano_task_pull',
  'Pull the next pending task sent to the Giano bot. Returns null if none.',
  {
    timeoutMs: z.number().int().positive().default(0),
  },
  async ({ timeoutMs }) => {
    const started = Date.now();

    const tryPop = () => {
      const item = queue.shift();
      if (!item) return null;
      inFlight.set(item.taskId, item);
      return item;
    };

    let item = tryPop();
    while (!item && timeoutMs > 0 && Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 250));
      item = tryPop();
    }

    return {
      content: [
        {
          type: 'text',
          text: item ? JSON.stringify(item, null, 2) : 'null',
        },
      ],
    };
  }
);

server.tool(
  'giano_task_ack',
  'Acknowledge that the IDE agent started working on the task.',
  {
    taskId: z.string(),
    message: z.string().default('🟦 Agent started.'),
  },
  async ({ taskId, message }) => {
    const task = inFlight.get(taskId);
    if (!task) throw new Error(`Unknown taskId: ${taskId}`);

    await botGlobal.sendMessage(task.chatId, message, { replyToId: task.replyToId });

    return { content: [{ type: 'text', text: 'OK' }] };
  }
);

server.tool(
  'giano_task_progress',
  'Send progress update back to Giano chat for a task.',
  {
    taskId: z.string(),
    message: z.string(),
  },
  async ({ taskId, message }) => {
    const task = inFlight.get(taskId);
    if (!task) throw new Error(`Unknown taskId: ${taskId}`);

    await botGlobal.sendMessage(task.chatId, message, { replyToId: task.replyToId });

    return { content: [{ type: 'text', text: 'OK' }] };
  }
);

server.tool(
  'giano_task_complete',
  'Mark task complete and send final summary back to Giano.',
  {
    taskId: z.string(),
    status: z.enum(['success', 'failed', 'blocked']).default('success'),
    summary: z.string(),
  },
  async ({ taskId, status, summary }) => {
    const task = inFlight.get(taskId);
    if (!task) throw new Error(`Unknown taskId: ${taskId}`);

    inFlight.delete(taskId);

    const text =
      status === 'success'
        ? `✅ Done (taskId=${taskId})\n${summary}`
        : status === 'blocked'
          ? `🟨 Blocked (taskId=${taskId})\n${summary}`
          : `❌ Failed (taskId=${taskId})\n${summary}`;

    await botGlobal.sendMessage(task.chatId, text, { replyToId: task.replyToId });

    return { content: [{ type: 'text', text: 'OK' }] };
  }
);

server.tool(
  'giano_queue_stats',
  'Get queue size and in-flight count.',
  {},
  async () => {
    const stats = { queued: queue.length, inFlight: inFlight.size };
    return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
  }
);

let botGlobal: Bot;

async function main() {
  botGlobal = await startBot();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
