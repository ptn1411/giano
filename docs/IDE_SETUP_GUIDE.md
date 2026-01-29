# Hướng dẫn Cài đặt MCP Bridge cho IDE (Antigravity & Kiro)

Dưới đây là cách cấu hình MCP Bridge để kết nối AI của IDE với Giano Chat.

## 1. Chuẩn bị

Trước khi cấu hình IDE, hãy đảm bảo bạn đã build MCP Bridge:

```bash
cd mcp-giano-bridge
npm install
npm run build
```

Lấy đường dẫn tuyệt đối tới file chạy (ví dụ):

- Windows: `C:\Users\NAM\Code\web\smooth-messenger\mcp-giano-bridge\dist\index.js`

## 2. Antigravity IDE (Agent-First)

Antigravity thường hỗ trợ config MCP qua file settings hoặc UI "Agent Manager".

### Cách 1: Config qua UI

1. Mở Command Palette (`Ctrl+Shift+P`) hoặc Settings menu.
2. Tìm "MCP: Manage Servers" hoặc "Agent: Add Tool".
3. Chọn "Add Custom Server" (Stdio).
4. Điền thông tin:
   - **Name**: `giano-bridge`
   - **Command**: `node`
   - **Arguments**: `C:\Users\NAM\Code\web\smooth-messenger\mcp-giano-bridge\dist\index.js`
   - **Environment Variables**:
     - `GIANO_BOT_TOKEN`: `<Token của MCPBot>`
     - `GIANO_API_BASE_URL`: `https://messages-api.bug.edu.vn`
     - `GIANO_WS_URL`: `wss://messages-api.bug.edu.vn/bot/ws`

### Cách 2: Config file (nếu có)

Tìm file config của project (ví dụ `.antigravity/mcp.json` hoặc trong `settings.json`):

```json
{
  "mcpServers": {
    "giano-bridge": {
      "command": "node",
      "args": [
        "C:\\Users\\NAM\\Code\\web\\smooth-messenger\\mcp-giano-bridge\\dist\\index.js"
      ],
      "env": {
        "GIANO_BOT_TOKEN": "YOUR_MCP_BOT_TOKEN",
        "GIANO_API_BASE_URL": "https://messages-api.bug.edu.vn",
        "GIANO_WS_URL": "wss://messages-api.bug.edu.vn/bot/ws"
      }
    }
  }
}
```

## 3. Kiro IDE

Kiro IDE hỗ trợ MCP native qua file cấu hình project.

### Bước 1: Mở Config

Tìm file `.kiro/config.json` hoặc thư mục `.kiro/` trong project root.

### Bước 2: Thêm MCP Server

Thêm vào section `mcpServers` trong config:

```json
{
  "mcpServers": {
    "giano-bridge": {
      "command": "node",
      "args": ["${projectRoot}/mcp-giano-bridge/dist/index.js"],
      "env": {
        "GIANO_BOT_TOKEN": "YOUR_MCP_BOT_TOKEN",
        "GIANO_API_BASE_URL": "https://messages-api.bug.edu.vn",
        "GIANO_WS_URL": "wss://messages-api.bug.edu.vn/bot/ws"
      },
      "enabled": true
    }
  }
}
```

### Bước 3: Restart Agent

Restart Kiro IDE hoặc reload window để agent load server mới.

## Kiểm tra hoạt động

1. Mở Giano Chat, vào group có MCPBot.
2. Từ IDE, ra lệnh cho AI Agent: "Check for any pending tasks from Giano".
3. AI sẽ gọi tool `giano_task_pull` và hiển thị task nếu có.
