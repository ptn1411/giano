# Moltbot + MCP Bridge Integration

Hệ thống cho phép 2 AI agents làm việc cùng nhau qua Giano chat:

1. **Moltbot AI** - Xử lý hội thoại, trả lời câu hỏi, điều phối
2. **IDE Agent** (Cursor/Claude) - Thực hiện code, sửa file, chạy lệnh

## Kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                     GIANO GROUP CHAT                             │
│            (User + MoltBot + MCPBot cùng nhóm)                   │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
        nhận tin│                             │nhận /task
                ▼                             ▼
    ┌───────────────────┐         ┌─────────────────────┐
    │  giano-moltbot    │         │  mcp-giano-bridge   │
    │  (MoltBot)        │────────▶│  (MCPBot)           │
    │                   │ /task   │                     │
    │  delegate_to_ide  │         │  Queue → IDE        │
    └───────────────────┘         └─────────────────────┘
            │                              │
            ▼                              ▼
    ┌───────────────┐              ┌───────────────┐
    │  Moltbot AI   │              │  IDE Agent    │
    │  (Claude...)  │              │  (Cursor...)  │
    └───────────────┘              └───────────────┘
```

## Setup

### 1. Tạo 2 bots trong Giano

```
/newbot MoltBot
/newbot MCPBot
```

Lấy tokens của cả 2.

### 2. Tạo group và thêm cả 2 bots

```
/newgroup "AI Workspace"
/addbot @moltbot
/addbot @mcpbot
```

### 3. Cấu hình Moltbot

```yaml
# moltbot.config.yaml
channels:
  giano:
    accounts:
      default:
        enabled: true
        apiBaseUrl: "https://messages-api.bug.edu.vn"
        wsUrl: "wss://messages-api.bug.edu.vn/ws"
        token: "<MOLTBOT_TOKEN>"
        botUserId: "<MOLTBOT_USER_ID>"

plugins:
  load:
    paths:
      - "./giano-moltbot-channel"
```

### 4. Cấu hình MCP Bridge

```bash
# Environment variables
GIANO_BOT_TOKEN=<MCPBOT_TOKEN>
GIANO_API_BASE_URL=https://messages-api.bug.edu.vn
GIANO_WS_URL=wss://messages-api.bug.edu.vn/bot/ws
```

### 5. Cấu hình IDE Agent (Claude Desktop / Cursor)

```json
{
  "mcpServers": {
    "giano-bridge": {
      "command": "node",
      "args": ["path/to/mcp-giano-bridge/dist/index.js"],
      "env": {
        "GIANO_BOT_TOKEN": "<MCPBOT_TOKEN>",
        "GIANO_API_BASE_URL": "https://messages-api.bug.edu.vn",
        "GIANO_WS_URL": "wss://messages-api.bug.edu.vn/bot/ws"
      }
    }
  }
}
```

## Cách hoạt động

### User gửi yêu cầu code:

```
User: Tạo một API endpoint mới cho user profile
```

### Moltbot AI quyết định cần IDE:

Moltbot sẽ tự động gọi tool `delegate_to_ide`:

```json
{
  "goal": "Tạo API endpoint GET /api/users/:id/profile",
  "steps": [
    "Tạo route trong users.rs",
    "Thêm handler function",
    "Test với curl"
  ],
  "files": ["backend/src/routes/users.rs"]
}
```

### MCP Bridge nhận task:

```
MCPBot: ✅ Task received (taskId=task_123). Goal: Tạo API endpoint...
```

### IDE Agent xử lý:

IDE agent pull task qua MCP, thực hiện code changes, và report:

```
MCPBot: ✅ Done (taskId=task_123)
Created GET /api/users/:id/profile endpoint
Files: backend/src/routes/users.rs
```

## Tools cho Moltbot

### `delegate_to_ide`

Gửi task đến IDE agent:

| Parameter            | Type     | Required | Description          |
| -------------------- | -------- | -------- | -------------------- |
| `goal`               | string   | ✅       | Mục tiêu của task    |
| `title`              | string   |          | Tiêu đề ngắn         |
| `steps`              | string[] |          | Các bước gợi ý       |
| `files`              | string[] |          | Files cần sửa        |
| `repoPath`           | string   |          | Đường dẫn repo       |
| `acceptanceCriteria` | string[] |          | Điều kiện hoàn thành |
| `notes`              | string   |          | Ghi chú thêm         |

## Lưu ý

- Cả 2 bots phải cùng trong 1 group Giano
- MoltBot gửi tin nhắn `/task {...}` → MCPBot nhận và queue
- IDE agent phải đang chạy và kết nối MCP để xử lý tasks
- Tất cả messages đều hiển thị trong group chat để user theo dõi
