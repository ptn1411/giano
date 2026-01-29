# mcp-giano-bridge

Bridge between **Giano Messages API bot** and an **MCP-capable IDE** (Google Antigravity, Cline, Cursor, etc.).

Goal: Giano sends tasks to the bot → IDE Agent pulls tasks via MCP tools → IDE Agent reports progress/completion back to Giano.

## What it does

- Connects to Giano bot WebSocket (using `@messages-api/bot-sdk`)
- Treats incoming messages as tasks if they look like tasks (`/task`, `TASK...`, or contain `taskId:`)
- Exposes MCP tools:
  - `giano_task_pull`
  - `giano_task_ack`
  - `giano_task_progress`
  - `giano_task_complete`
  - `giano_queue_stats`

## Install

```bash
cd giano/mcp-giano-bridge
npm install
npm run build
```

## Run

```bash
export GIANO_BOT_TOKEN=...              # required
export GIANO_API_BASE_URL=http://localhost:3000
export GIANO_WS_URL=ws://localhost:3000/bot/ws

node dist/index.js
```

Optional:

- `GIANO_AUTO_ACK=true|false` (default true)

## Antigravity adapter

See: `adapters/antigravity/README.md`

## Kiro Power adapter

A ready-to-install Kiro Power is included at:

- `giano/powers/giano-bridge`

It contains:
- `POWER.md`
- `mcp.json`
- `steering/`

Install it in Kiro via Powers UI → Add Custom Power → Local Directory.
