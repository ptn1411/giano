# Antigravity adapter (manual MCP config)

Antigravity supports MCP via its MCP Store (Manage MCP Servers → View raw config).

Add a server that runs the bridge:

- command: `node`
- args: `/root/clawd/giano/mcp-giano-bridge/dist/index.js`
- env:
  - `GIANO_BOT_TOKEN`
  - `GIANO_API_BASE_URL` (default `http://127.0.0.1:3000`)
  - `GIANO_WS_URL` (default `ws://127.0.0.1:3000/bot/ws`)

Example snippet (shape may differ depending on Antigravity's JSON schema):

```json
{
  "name": "giano",
  "command": "node",
  "args": ["/root/clawd/giano/mcp-giano-bridge/dist/index.js"],
  "env": {
    "GIANO_BOT_TOKEN": "...",
    "GIANO_API_BASE_URL": "http://127.0.0.1:3000",
    "GIANO_WS_URL": "ws://127.0.0.1:3000/bot/ws",
    "GIANO_AUTO_ACK": "true"
  }
}
```
