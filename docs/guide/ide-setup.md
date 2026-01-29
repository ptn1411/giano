---
title: Cài đặt IDE
---

# Hướng dẫn Cài đặt Full AI Team cho IDE

Để biến IDE thành một "AI Team Member" hoàn chỉnh có thể nhận lệnh từ chat và thực thi code, bạn cần cài đặt **2 MCP Servers**:

1. **`giano-bridge`**: Để nhận tasks từ Giano Chat.
2. **`ide-controller`**: Để AI có quyền đọc/ghi file và chạy lệnh terminal.

## 1. Chuẩn bị

Build cả 2 project:

```bash
# 1. Build Bridge (Người đưa thư)
cd mcp-giano-bridge
npm install && npm run build

# 2. Build Controller (Tay chân)
cd ../mcp-ide-controller
npm install && npm run build
```

## 2. Antigravity IDE Setup

Vào **Settings** hoặc file config MCP của project:

```json
{
  "mcpServers": {
    "giano-bridge": {
      "command": "node",
      "args": ["path/to/mcp-giano-bridge/dist/index.js"],
      "env": {
        "GIANO_BOT_TOKEN": "<TOKEN_CUA_MCPBOT>",
        "GIANO_API_BASE_URL": "https://messages-api.bug.edu.vn",
        "GIANO_WS_URL": "wss://messages-api.bug.edu.vn/bot/ws"
      }
    },
    "ide-controller": {
      "command": "node",
      "args": ["path/to/mcp-ide-controller/dist/index.js"],
      "env": {
        "WORKSPACE_ROOT": "<PROJECT_PATH>",
        "MESSAGES_BOT_TOKEN": "<TOKEN_CUA_MCPBOT>",
        "MESSAGES_CHAT_ID": "<ID_GROUP_CHAT>"
      }
    }
  }
}
```

## 3. Kiro IDE Setup

Sửa file `.kiro/config.json`:

```json
{
  "mcpServers": {
    "giano-bridge": {
      "command": "node",
      "args": ["${projectRoot}/mcp-giano-bridge/dist/index.js"],
      "env": {
        "GIANO_BOT_TOKEN": "<TOKEN_CUA_MCPBOT>",
        "GIANO_API_BASE_URL": "https://messages-api.bug.edu.vn",
        "GIANO_WS_URL": "wss://messages-api.bug.edu.vn/bot/ws"
      },
      "enabled": true
    },
    "ide-controller": {
      "command": "node",
      "args": ["${projectRoot}/mcp-ide-controller/dist/index.js"],
      "env": {
        "WORKSPACE_ROOT": "${projectRoot}",
        "MESSAGES_BOT_TOKEN": "<TOKEN_CUA_MCPBOT>",
        "MESSAGES_CHAT_ID": "<ID_GROUP_CHAT>"
      },
      "enabled": true
    }
  }
}
```

## 🔐 Bảo mật

::: warning
**`ide-controller` rất mạnh**: Nó cho phép AI đọc/ghi bất kỳ file nào trong folder dự án và chạy lệnh terminal.
:::

- Chỉ chạy trong môi trường dev trusted.
- Đảm bảo `WORKSPACE_ROOT` trỏ đúng vào folder dự án.

## ✅ Kịch bản hoạt động

1. **Bạn** chat trong group: "@moltbot refactor file index.ts giúp tôi"
2. **MoltBot** gọi tool `delegate_to_ide` để tạo task.
3. **`giano-bridge`** nhận task và đưa vào hàng đợi.
4. **IDE Agent** thấy task, bắt đầu làm việc.
5. Agent dùng tools của **`ide-controller`** để sửa code.
6. Agent báo cáo hoàn thành qua `giano-bridge`.
