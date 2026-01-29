import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Optional: send progress to Messages API via the bot SDK
// We load it dynamically so this server can still run without the SDK being built/available.
type BotCtor = new (token: string, options?: any) => {
  sendMessage: (chatId: string, text: string, options?: any) => Promise<any>;
};
async function loadBotCtor(): Promise<BotCtor | null> {
  try {
    const mod: any = await import('@messages-api/bot-sdk');
    return mod.Bot as BotCtor;
  } catch {
    return null;
  }
}

const WORKSPACE_ROOT = path.resolve(process.env.WORKSPACE_ROOT ?? process.cwd());

function resolveInWorkspace(p: string) {
  const full = path.resolve(WORKSPACE_ROOT, p);
  // prevent path traversal
  if (!full.startsWith(WORKSPACE_ROOT + path.sep) && full !== WORKSPACE_ROOT) {
    throw new Error(`Path escapes WORKSPACE_ROOT: ${p}`);
  }
  return full;
}

function redact(s: string) {
  // basic redaction for logs
  return s.replaceAll(/(token|password|secret)\s*[:=]\s*[^\s]+/gi, '$1=***');
}

async function createNotifier() {
  const token = process.env.MESSAGES_BOT_TOKEN;
  const chatId = process.env.MESSAGES_CHAT_ID;
  const apiBaseUrl = process.env.MESSAGES_API_BASE_URL;

  if (!token || !chatId) return null;

  const Bot = await loadBotCtor();
  if (!Bot) return null;

  const bot = new Bot(token, {
    mode: 'webhook',
    apiBaseUrl: apiBaseUrl ?? 'http://localhost:3000',
    logLevel: 'error',
  });

  return {
    async send(text: string) {
      try {
        await bot.sendMessage(chatId, text);
      } catch {
        // ignore notifier errors
      }
    },
  };
}

const server = new McpServer({
  name: 'mcp-ide-controller',
  version: '0.1.0',
});

server.tool(
  'workspace_info',
  'Get WORKSPACE_ROOT used for file operations.',
  {},
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ workspaceRoot: WORKSPACE_ROOT }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'list_dir',
  'List files/folders in a directory under WORKSPACE_ROOT.',
  {
    dir: z.string().default('.'),
  },
  async ({ dir }) => {
    const full = resolveInWorkspace(dir);
    const entries = await fs.readdir(full, { withFileTypes: true });
    const out = entries
      .map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other',
      }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

    return {
      content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
    };
  }
);

server.tool(
  'read_file',
  'Read a UTF-8 text file under WORKSPACE_ROOT.',
  {
    file: z.string(),
    maxChars: z.number().int().positive().default(40000),
  },
  async ({ file, maxChars }) => {
    const full = resolveInWorkspace(file);
    const buf = await fs.readFile(full);
    const text = buf.toString('utf8');
    const truncated = text.length > maxChars;
    const out = truncated ? text.slice(0, maxChars) : text;

    return {
      content: [
        {
          type: 'text',
          text: out + (truncated ? `\n\n[TRUNCATED to ${maxChars} chars]` : ''),
        },
      ],
    };
  }
);

server.tool(
  'write_file',
  'Write a UTF-8 text file under WORKSPACE_ROOT. Creates parent dirs if needed.',
  {
    file: z.string(),
    content: z.string(),
  },
  async ({ file, content }) => {
    const full = resolveInWorkspace(file);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    return { content: [{ type: 'text', text: 'OK' }] };
  }
);

server.tool(
  'edit_file_by_lines',
  'Apply line-based edits to a text file. Lines are 1-indexed and inclusive.',
  {
    file: z.string(),
    edits: z.array(
      z.object({
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive(),
        newText: z.string(),
      })
    ),
  },
  async ({ file, edits }) => {
    const full = resolveInWorkspace(file);
    const original = (await fs.readFile(full, 'utf8')).split(/\r?\n/);

    // apply from bottom to top to keep indices stable
    const sorted = [...edits].sort((a, b) => b.startLine - a.startLine);

    for (const e of sorted) {
      if (e.endLine < e.startLine) throw new Error('endLine must be >= startLine');
      const startIdx = e.startLine - 1;
      const endIdx = e.endLine - 1;
      if (startIdx < 0 || endIdx >= original.length) {
        throw new Error(`Edit range out of bounds: ${e.startLine}-${e.endLine} (file has ${original.length} lines)`);
      }
      const replacementLines = e.newText.split(/\r?\n/);
      original.splice(startIdx, endIdx - startIdx + 1, ...replacementLines);
    }

    await fs.writeFile(full, original.join('\n'), 'utf8');
    return { content: [{ type: 'text', text: 'OK' }] };
  }
);

server.tool(
  'run_command',
  'Run a shell command (via /bin/bash -lc) with optional cwd under WORKSPACE_ROOT.',
  {
    command: z.string(),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().default(120000),
  },
  async ({ command, cwd, timeoutMs }) => {
    const notifier = await createNotifier();
    const resolvedCwd = resolveInWorkspace(cwd ?? '.');

    await notifier?.send(`Running: ${redact(command)}\nCWD: ${resolvedCwd}`);

    const child = spawn('/bin/bash', ['-lc', command], {
      cwd: resolvedCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });

    const exitCode: number = await new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(t);
        resolve(code ?? -1);
      });
    });

    const result = { exitCode, stdout, stderr };
    await notifier?.send(`Done (exit=${exitCode}).`);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
