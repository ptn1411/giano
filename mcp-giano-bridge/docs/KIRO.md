# Using Giano MCP Bridge in Kiro IDE (via Power)

Kiro uses **Powers** to package documentation + (optional) MCP configuration.

This repo includes a ready-to-install Power:

- `/root/clawd/giano/powers/giano-bridge`

## 1) Build the MCP server

```bash
cd /root/clawd/giano/mcp-giano-bridge
npm install
npm run build
```

## 2) Set required environment variables

Kiro Power `mcp.json` references these variables:

- `GIANO_BOT_TOKEN` (required)
- `GIANO_API_BASE_URL` (optional)
- `GIANO_WS_URL` (optional)

Example:

```bash
export GIANO_BOT_TOKEN="..."
export GIANO_API_BASE_URL="http://127.0.0.1:3000"
export GIANO_WS_URL="ws://127.0.0.1:3000/bot/ws"
```

## 3) Install the Power locally

In Kiro:

1. Open **Powers** panel
2. Click **Add Custom Power**
3. Choose **Local Directory**
4. Paste this absolute path:

```text
/root/clawd/giano/powers/giano-bridge
```

5. Install/activate it

After installation, Kiro will merge MCP server configs from powers into:

- `~/.kiro/powers.mcp.json` (auto-generated)

## 4) Use it in agent chat

Ask the agent to:

- pull tasks using `giano_task_pull`
- report progress via `giano_task_progress`
- complete via `giano_task_complete`

The Power also includes:

- `steering/workflow.md` — a simple checklist for the agent.

## Where Kiro stores MCP config

Workspace-level:
- `.kiro/settings/mcp.json`

User-level:
- `~/.kiro/settings/mcp.json`

Powers merged config:
- `~/.kiro/powers.mcp.json`

## Troubleshooting

### Power installs but MCP tools not available
- Ensure the Power is **Installed** and **Active**
- Ensure env vars exist in the environment where Kiro runs
- Open `~/.kiro/powers.mcp.json` and confirm the `giano` server exists

### Bridge runs but no tasks appear
- Use `/task ...` format when sending tasks to the bot chat
- Confirm bot is subscribed to that chat
