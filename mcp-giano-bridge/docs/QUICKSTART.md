# Giano MCP Bridge — Quickstart

This MCP server lets an IDE agent (Antigravity/Kiro/others) **pull tasks from Giano** (via bot WebSocket) and **report progress/results back to Giano**.

## What you get

MCP tools exposed by this server:
- `giano_task_pull(timeoutMs?)` → get next task (or `null`)
- `giano_task_ack(taskId, message?)` → tell Giano you started
- `giano_task_progress(taskId, message)` → progress updates
- `giano_task_complete(taskId, status, summary)` → final report
- `giano_queue_stats()` → debug queue size

## Prerequisites

- Giano backend running locally (default): `http://127.0.0.1:3000`
- Bot created in Giano with a **bot token**
- Bot is subscribed to the chat where tasks will be posted
- Node.js installed (to run the MCP server)

## Build

```bash
cd /root/clawd/giano/bot-sdk-typescript
npm install
npm run build

cd /root/clawd/giano/mcp-giano-bridge
npm install
npm run build
```

## Required environment variables

Set these in the environment of your IDE (or start the IDE from a shell where they are exported):

```bash
export GIANO_BOT_TOKEN="..."                       # required
export GIANO_API_BASE_URL="http://127.0.0.1:3000"  # optional
export GIANO_WS_URL="ws://127.0.0.1:3000/bot/ws"    # optional
```

## Task message format (v0.2)

See full reference: `docs/TASK_FORMAT.md`.

Quick summary:

- Minimal: `/task ...`
- Better for humans: key/value + lists
- Best for machines: JSON payload

If no `taskId` is found, the bridge uses `updateId` as the task id.

## Next steps

- Antigravity setup: see `docs/ANTIGRAVITY.md`
- Kiro setup (Power): see `docs/KIRO.md`
