# Using Giano MCP Bridge in Google Antigravity IDE

Antigravity supports MCP and can run a local MCP server via a command.

## 1) Build the MCP server

```bash
cd /root/clawd/giano/mcp-giano-bridge
npm install
npm run build
```

## 2) Ensure the bot websocket endpoint exists

Your Giano backend must expose bot websocket at:

- `GET /bot/ws?token=...`

Quick check (should be 400 without token):

```bash
curl -i http://127.0.0.1:3000/bot/ws
```

If you still get 404, your backend is not running the updated code.

## 3) Set environment variables

Antigravity launches MCP servers with env from its MCP config.

You need:

- `GIANO_BOT_TOKEN` (required)
- `GIANO_API_BASE_URL` (optional, default `http://127.0.0.1:3000`)
- `GIANO_WS_URL` (optional, default `ws://127.0.0.1:3000/bot/ws`)

## 4) Add MCP server in Antigravity

In Antigravity:

1. Open **MCP Store**
2. **Manage MCP Servers**
3. **View raw config**
4. Add a server entry that runs the bridge.

Example (exact JSON shape can differ in Antigravity; the key bits are command/args/env):

```json
{
  "name": "giano",
  "command": "node",
  "args": ["/root/clawd/giano/mcp-giano-bridge/dist/index.js"],
  "env": {
    "GIANO_BOT_TOKEN": "YOUR_TOKEN",
    "GIANO_API_BASE_URL": "http://127.0.0.1:3000",
    "GIANO_WS_URL": "ws://127.0.0.1:3000/bot/ws",
    "GIANO_AUTO_ACK": "true"
  }
}
```

Restart Antigravity if needed.

## 5) Recommended agent workflow

1) Call `giano_task_pull` (use `timeoutMs` if you want it to wait)
2) Call `giano_task_ack`
3) Do the work in the IDE (edit files, run tests)
4) Call `giano_task_progress` at milestones
5) Call `giano_task_complete` with summary + how to verify

## Troubleshooting

### Bot doesn’t receive tasks
- Verify `GIANO_BOT_TOKEN` is correct
- Verify bot is active and subscribed to the chat
- Check `GIANO_WS_URL` points to `/bot/ws` (not `/ws`)

### `/bot/ws` returns 404
Backend is running an older build. Rebuild/restart backend.

### Tasks are ignored
The bridge only queues messages that look like tasks:
- starts with `/task`
- starts with `TASK`
- contains `taskId:` or `taskId=`

Adjust your task posting format accordingly.
