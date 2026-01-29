---
title: MCP Bridge
---

# MCP Bridge

MCP (Model Context Protocol) Bridge kết nối GIANO với IDE agents.

## Kiến trúc

```
┌─────────────┐    WebSocket    ┌──────────────┐
│   GIANO     │ ◄─────────────► │  MCP Bridge  │
│   Backend   │                 │   (Server)   │
└─────────────┘                 └──────┬───────┘
                                       │
                                       │ MCP Protocol
                                       ▼
                                ┌──────────────┐
                                │  IDE Agent   │
                                │ (Antigravity)│
                                └──────────────┘
```

## Cài đặt

```bash
cd mcp-giano-bridge
npm install
npm run build
```

## Cấu hình

```json
{
  "mcpServers": {
    "giano-bridge": {
      "command": "node",
      "args": ["path/to/mcp-giano-bridge/dist/index.js"],
      "env": {
        "GIANO_BOT_TOKEN": "<TOKEN>",
        "GIANO_API_BASE_URL": "https://messages-api.bug.edu.vn",
        "GIANO_WS_URL": "wss://messages-api.bug.edu.vn/bot/ws"
      }
    }
  }
}
```

## Tools cung cấp

| Tool               | Mô tả             |
| ------------------ | ----------------- |
| `get_pending_task` | Lấy task từ queue |
| `report_progress`  | Báo cáo tiến độ   |
| `complete_task`    | Hoàn thành task   |
| `fail_task`        | Báo lỗi task      |

## Xem thêm

- [Cài đặt IDE](/guide/ide-setup)
- [MoltBot](/bots/moltbot)
