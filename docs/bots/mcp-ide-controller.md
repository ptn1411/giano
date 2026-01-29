# mcp-ide-controller

MCP server exposing basic IDE-like tools for VS Code clients:

- list_dir
- read_file
- write_file
- edit_file_by_lines
- run_command

It also *optionally* uses `@messages-api/bot-sdk` to send run_command progress messages back to a chat.

## Install

```bash
cd giano/mcp-ide-controller
npm install
npm run build
```

## Run (stdio)

```bash
# Point workspace root at your repo
WORKSPACE_ROOT=/root/clawd/giano node dist/index.js
```

## Optional notifier via Messages API

```bash
export MESSAGES_BOT_TOKEN=...   # bot token
export MESSAGES_CHAT_ID=...     # chat/user id to send progress
export MESSAGES_API_BASE_URL=http://localhost:3000
```

## VS Code / Cursor MCP config

Add to `~/.vscode/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ide": {
      "command": "node",
      "args": ["/ABS/PATH/giano/mcp-ide-controller/dist/index.js"],
      "env": {
        "WORKSPACE_ROOT": "/ABS/PATH/giano"
      }
    }
  }
}
```
