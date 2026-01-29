# Hướng dẫn Cài đặt Full AI Team cho IDE (Antigravity & Kiro)

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

Lấy đường dẫn tuyệt đối (Ví dụ trên Windows):

- Bridge: `C:\Users\NAM\Code\web\smooth-messenger\mcp-giano-bridge\dist\index.js`
- Controller: `C:\Users\NAM\Code\web\smooth-messenger\mcp-ide-controller\dist\index.js`

## 2. Antigravity IDE Setup

Vào **Settings** hoặc file config MCP của project:

```json
{
  "mcpServers": {
    "giano-bridge": {
      "command": "node",
      "args": [
        "C:\\Users\\NAM\\Code\\web\\smooth-messenger\\mcp-giano-bridge\\dist\\index.js"
      ],
      "env": {
        "GIANO_BOT_TOKEN": "<TOKEN_CUA_MCPBOT>",
        "GIANO_API_BASE_URL": "https://messages-api.bug.edu.vn",
        "GIANO_WS_URL": "wss://messages-api.bug.edu.vn/bot/ws"
      }
    },
    "ide-controller": {
      "command": "node",
      "args": [
        "C:\\Users\\NAM\\Code\\web\\smooth-messenger\\mcp-ide-controller\\dist\\index.js"
      ],
      "env": {
        "WORKSPACE_ROOT": "C:\\Users\\NAM\\Code\\web\\smooth-messenger",
        "MESSAGES_BOT_TOKEN": "<TOKEN_CUA_MCPBOT>",
        "MESSAGES_CHAT_ID": "<ID_GROUP_CHAT>"
      }
    }
  }
}
```

_Note: `ide-controller` cần `MESSAGES_CHAT_ID` để báo cáo tiến độ chạy lệnh (ví dụ: "Đang chạy npm install...") vào group chat cho bạn thấy._

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

- **`ide-controller` rất mạnh**: Nó cho phép AI đọc/ghi bất kỳ file nào trong folder dự án và chạy lệnh terminal.
- Chỉ chạy trong môi trường dev trusted.
- Đảm bảo `WORKSPACE_ROOT` trỏ đúng vào folder dự án, tránh trỏ vào `C:\` hoặc `/`.

## ✅ Kịch bản hoạt động

1. **Bạn** chat trong group: "@moltbot refactor file index.ts giúp tôi"
2. **MoltBot** gọi tool `delegate_to_ide` để tạo task.
3. **`giano-bridge`** nhận task và đưa vào hàng đợi.
4. **IDE Agent** (Antigravity/Kiro) thấy task, bắt đầu làm việc.
5. Agent dùng tools của **`ide-controller`** (`read_file`, `write_file`) để sửa code.
6. Agent dùng tool `run_command` để chạy test.
   - Controller tự động gửi tin nhắn: "Running: npm test..." vào group chat.
7. Agent báo cáo hoàn thành qua `giano-bridge`.
