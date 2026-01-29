import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Bot } from '@messages-api/bot-sdk';
import type { Context } from '@messages-api/bot-sdk';

type TaskPayloadV2 = {
  version: 'v2';
  taskId: string;
  title?: string;
  goal: string;
  acceptanceCriteria?: string[];
  steps?: string[];
  repoPath?: string;
  files?: string[];
  commandsAllowed?: string[];
  notes?: string;
};

type TaskItem = {
  taskId: string;
  updateId: string;
  messageId: string;
  chatId: string;
  fromUserId: string;
  rawText: string;
  receivedAt: string;
  // used for threaded replies
  replyToId: string;
  payload: TaskPayloadV2;
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
  return (raw ?? '').trim();
}

function stripTaskPrefix(text: string) {
  // Allow users to start tasks with "/task" and keep the rest as content.
  return text.replace(/^\s*\/task\s*/i, '').trim();
}

function tryParseJson(text: string): any | null {
  try {
    const obj = JSON.parse(text);
    return obj;
  } catch {
    return null;
  }
}

function parseKeyValueLines(text: string): Record<string, any> {
  // Very small YAML-ish parser:
  // key: value
  // steps:
  // - a
  // - b
  const lines = text.split(/\r?\n/);
  const out: Record<string, any> = {};

  let currentListKey: string | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (listItem && currentListKey) {
      out[currentListKey] = out[currentListKey] ?? [];
      if (Array.isArray(out[currentListKey])) {
        out[currentListKey].push(listItem[1]);
      }
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      const value = kv[2];

      if (value === '') {
        // start list mode
        currentListKey = key;
        out[key] = out[key] ?? [];
      } else {
        currentListKey = null;
        out[key] = value;
      }
    } else {
      currentListKey = null;
    }
  }

  return out;
}

function parseTaskPayloadV2(rawText: string, fallbackUpdateId: string): TaskPayloadV2 {
  const normalized = normalizeTaskText(rawText);
  const stripped = stripTaskPrefix(normalized);

  const json = tryParseJson(stripped);
  const kv = json ? null : parseKeyValueLines(stripped);

  const taskId: string =
    (json?.taskId ?? json?.task_id ?? kv?.taskId ?? kv?.task_id ?? kv?.id ?? null) || fallbackUpdateId;

  const goal: string =
    (json?.goal ?? kv?.goal ?? json?.text ?? kv?.text ?? stripped) || stripped || '(empty)';

  const title: string | undefined = json?.title ?? kv?.title;

  const toList = (v: any): string[] | undefined => {
    if (!v) return undefined;
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
    return undefined;
  };

  return {
    version: 'v2',
    taskId: String(taskId),
    title: title ? String(title) : undefined,
    goal: String(goal).trim(),
    acceptanceCriteria: toList(json?.acceptanceCriteria ?? json?.dod ?? kv?.acceptanceCriteria ?? kv?.dod),
    steps: toList(json?.steps ?? kv?.steps),
    repoPath: (json?.repoPath ?? json?.repo_path ?? kv?.repoPath ?? kv?.repo_path) ? String(json?.repoPath ?? json?.repo_path ?? kv?.repoPath ?? kv?.repo_path) : undefined,
    files: toList(json?.files ?? kv?.files),
    commandsAllowed: toList(json?.commandsAllowed ?? json?.commands_allowed ?? kv?.commandsAllowed ?? kv?.commands_allowed),
    notes: (json?.notes ?? kv?.notes) ? String(json?.notes ?? kv?.notes) : undefined,
  };
}

function ctxToTask(ctx: any): TaskItem {
  const rawText = normalizeTaskText(ctx.text ?? '');
  const updateId = String(ctx.updateId);
  const payload = parseTaskPayloadV2(rawText, updateId);

  return {
    taskId: payload.taskId,
    updateId,
    messageId: String(ctx.message?.messageId ?? ''),
    chatId: String(ctx.chatId),
    fromUserId: String(ctx.userId),
    rawText,
    receivedAt: new Date().toISOString(),
    replyToId: String(ctx.message?.messageId ?? ''),
    payload,
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

    // Heuristic: treat messages starting with /task or containing taskId/json-ish payload as tasks.
    const isLikelyTask =
      task.rawText.startsWith('/task') ||
      task.rawText.startsWith('TASK') ||
      /taskId\s*[:=]/i.test(task.rawText) ||
      task.rawText.trim().startsWith('{');

    if (!isLikelyTask) return;

    queue.push(task);

    // Optional immediate ACK back to Giano chat
    const autoAck = (process.env.GIANO_AUTO_ACK ?? 'true') === 'true';
    if (autoAck) {
      await ctx.reply(`✅ Task received (taskId=${task.taskId}).\nGoal: ${task.payload.goal.slice(0, 200)}${task.payload.goal.length > 200 ? '…' : ''}`);
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
  version: '0.2.0',
});

server.tool(
  'giano_task_pull',
  'Pull the next pending task sent to the Giano bot. Returns {task:null} if none.',
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

    const response = {
      version: 'v2',
      task: item
        ? {
            taskId: item.taskId,
            chatId: item.chatId,
            messageId: item.messageId,
            replyToId: item.replyToId,
            fromUserId: item.fromUserId,
            receivedAt: item.receivedAt,
            payload: item.payload,
            rawText: item.rawText,
          }
        : null,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
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
    percent: z.number().int().min(0).max(100).optional(),
    phase: z.string().optional(),
  },
  async ({ taskId, message, percent, phase }) => {
    const task = inFlight.get(taskId);
    if (!task) throw new Error(`Unknown taskId: ${taskId}`);

    const prefixParts: string[] = [];
    if (phase) prefixParts.push(`phase=${phase}`);
    if (percent !== undefined) prefixParts.push(`${percent}%`);

    const prefix = prefixParts.length ? `🟪 Progress (${prefixParts.join(', ')}): ` : '🟪 Progress: ';

    await botGlobal.sendMessage(task.chatId, prefix + message, { replyToId: task.replyToId });

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
    filesTouched: z.array(z.string()).optional(),
    verify: z.array(z.string()).optional(),
  },
  async ({ taskId, status, summary, filesTouched, verify }) => {
    const task = inFlight.get(taskId);
    if (!task) throw new Error(`Unknown taskId: ${taskId}`);

    inFlight.delete(taskId);

    const lines: string[] = [summary.trim()];
    if (filesTouched?.length) {
      lines.push('', 'Files:', ...filesTouched.map((f) => `- ${f}`));
    }
    if (verify?.length) {
      lines.push('', 'Verify:', ...verify.map((c) => `- ${c}`));
    }

    const body = lines.join('\n').trim();

    const text =
      status === 'success'
        ? `✅ Done (taskId=${taskId})\n${body}`
        : status === 'blocked'
          ? `🟨 Blocked (taskId=${taskId})\n${body}`
          : `❌ Failed (taskId=${taskId})\n${body}`;

    await botGlobal.sendMessage(task.chatId, text, { replyToId: task.replyToId });

    return { content: [{ type: 'text', text: 'OK' }] };
  }
);

server.tool(
  'giano_task_release',
  'Release an in-flight task back into the queue (e.g. if agent aborted).',
  {
    taskId: z.string(),
    reason: z.string().default('released'),
  },
  async ({ taskId, reason }) => {
    const task = inFlight.get(taskId);
    if (!task) throw new Error(`Unknown taskId: ${taskId}`);

    inFlight.delete(taskId);
    queue.unshift(task);

    await botGlobal.sendMessage(task.chatId, `🟧 Task released (taskId=${taskId}). Reason: ${reason}`, {
      replyToId: task.replyToId,
    });

    return { content: [{ type: 'text', text: 'OK' }] };
  }
);

server.tool(
  'giano_queue_stats',
  'Get queue size and in-flight count.',
  {},
  async () => {
    const stats = { queued: queue.length, inFlight: inFlight.size, version: '0.2.0' };
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
