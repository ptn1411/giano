---
title: Bot SDK
---

# Bot SDK Overview

GIANO cung cấp SDK để xây dựng bot tương tác trong chat.

## Cài đặt

```bash
npm install @giano/bot-sdk
```

## Quick Start

```typescript
import { GianoBot } from "@giano/bot-sdk";

const bot = new GianoBot({
  token: "YOUR_BOT_TOKEN",
  apiBaseUrl: "https://messages-api.bug.edu.vn",
  wsUrl: "wss://messages-api.bug.edu.vn/bot/ws",
});

// Xử lý tin nhắn
bot.on("message", async (message) => {
  if (message.text === "/hello") {
    await bot.sendMessage(message.chatId, "Hello! 👋");
  }
});

// Kết nối
bot.connect();
```

## Tính năng

- **Real-time**: Nhận tin nhắn qua WebSocket
- **Commands**: Xử lý lệnh `/command`
- **Rich messages**: Gửi text, file, media
- **Events**: Message, typing, user join/leave

## Các trang liên quan

- [MoltBot Integration](/bots/moltbot) - Bot AI hỗ trợ
- [MCP Bridge](/bots/mcp-bridge) - Tích hợp IDE
