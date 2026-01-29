---
name: "giano-bridge"
displayName: "Giano Task Bridge"
description: "Pull tasks from Giano via bot websocket and report progress/completion back to Giano from inside your IDE agent. Works as a lightweight task broker bridge via MCP."
keywords: ["giano", "messages-api", "task", "agent", "mcp", "bridge"]
author: "Hai Nam + Hằng"
---

# Giano Task Bridge

## Overview

This power connects your IDE agent to **Giano** as a task inbox.

- Giano sends a task message to a bot chat (e.g. `/task ...`)
- Your IDE agent pulls the task via MCP (`giano_task_pull`)
- The agent reports progress and final results back to Giano (`giano_task_progress`, `giano_task_complete`)

This is designed for **agentic IDE workflows** (Kiro / Antigravity / any MCP-capable IDE).

## Onboarding

### Prerequisites
- Giano backend running locally (default: `http://127.0.0.1:3000`)
- A bot created in Giano with a valid token
- The bot is subscribed to the chat where tasks will be posted
- Node.js available (to run the MCP server)

### Installation (Kiro)
1. Open **Powers** panel
2. Add Custom Power → **Local Directory**
3. Select this directory:
   - `/root/clawd/giano/powers/giano-bridge`
4. Ensure environment variables are configured (see below)

### Configuration
This power installs an MCP server via `mcp.json`. You must provide:

- `GIANO_BOT_TOKEN` (required)
- `GIANO_API_BASE_URL` (default `http://127.0.0.1:3000`)
- `GIANO_WS_URL` (default `ws://127.0.0.1:3000/bot/ws`)

## Task format
Recommended:

- Start messages with `/task` OR include a first-line `taskId: <id>`

Examples:

```
/task Implement refresh token rotation in backend. Definition of done: tests pass.
```

```
taskId: auth-rot-001
Goal: Implement refresh token rotation
DoD: tests pass
```

## Tools (MCP)

- `giano_task_pull(timeoutMs?)` → returns next task JSON (or null)
- `giano_task_ack(taskId, message?)` → tell Giano you started
- `giano_task_progress(taskId, message)` → progress updates
- `giano_task_complete(taskId, status, summary)` → final result
- `giano_queue_stats()` → queued/inFlight counts

## Workflow (recommended)
1. Pull task
2. Ack start
3. Execute work in IDE (edit files, run tests, etc.)
4. Send progress every meaningful milestone
5. Complete with a concise summary + what changed + how to verify

See steering file for a copy-pastable checklist.
