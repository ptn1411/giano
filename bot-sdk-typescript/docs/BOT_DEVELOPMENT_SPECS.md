# GianoBot SDK - Hướng Dẫn Phát Triển Bot Chi Tiết

## Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Cấu Hình Bot](#2-cấu-hình-bot)
3. [Vòng Đời Bot](#3-vòng-đời-bot)
4. [Luồng Xử Lý Tin Nhắn](#4-luồng-xử-lý-tin-nhắn)
5. [Patterns & Best Practices](#5-patterns--best-practices)
6. [Ví Dụ Hoàn Chỉnh](#6-ví-dụ-hoàn-chỉnh)

---

## 1. Tổng Quan

### 1.1 Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GIANO SERVER                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────────────┐ │
│  │   Users     │───▶│  Chat System │───▶│   Bot Message Dispatcher   │ │
│  └─────────────┘    └──────────────┘    └────────────────────────────┘ │
│                                                      │                   │
└──────────────────────────────────────────────────────│───────────────────┘
                                                       │
                    ┌──────────────────────────────────┴────────────────┐
                    │                                                   │
                    ▼                                                   ▼
         ┌─────────────────┐                              ┌─────────────────┐
         │   WebSocket     │                              │     Webhook     │
         │   Connection    │                              │     HTTP POST   │
         └────────┬────────┘                              └────────┬────────┘
                  │                                                 │
                  ▼                                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          YOUR BOT APPLICATION                            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │
│  │ Bot Instance │──▶│ UpdateRouter │──▶│   Handlers   │                 │
│  └──────────────┘   └──────────────┘   └──────────────┘                 │
│         │                                     │                          │
│         │            ┌──────────────┐         │                          │
│         └───────────▶│  ApiClient   │◀────────┘                          │
│                      └──────────────┘                                    │
│                             │                                            │
└─────────────────────────────│────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Giano Bot API  │
                    │ /bot<TOKEN>/... │
                    └─────────────────┘
```

### 1.2 Hai Chế Độ Kết Nối

| Chế Độ        | Mô Tả                         | Use Case                              |
| ------------- | ----------------------------- | ------------------------------------- |
| **WebSocket** | Kết nối realtime, persistent  | Bots chạy liên tục trên VPS/container |
| **Webhook**   | HTTP POST mỗi khi có tin nhắn | Serverless (AWS Lambda, Vercel, etc.) |

---

## 2. Cấu Hình Bot

### 2.1 Tất Cả Options

```typescript
interface BotOptions {
  // BẮT BUỘC
  token: string; // Bot token từ Giano

  // TÙY CHỌN
  mode?: "websocket" | "webhook"; // Default: 'websocket'
  apiBaseUrl?: string; // Default: 'http://localhost:3000'
  wsUrl?: string; // Default: 'ws://localhost:3000'
  logLevel?: "debug" | "info" | "error" | "none"; // Default: 'info'
  logger?: Logger; // Custom logger implementation
  retryAttempts?: number; // Default: 3
  retryDelay?: number; // Default: 1000 (ms)
}
```

### 2.2 Cấu Hình Theo Môi Trường

#### Development

```typescript
const bot = new Bot(process.env.BOT_TOKEN!, {
  mode: "websocket",
  apiBaseUrl: "http://localhost:3000",
  wsUrl: "ws://localhost:3000",
  logLevel: "debug", // Xem tất cả logs
});
```

#### Production - WebSocket

```typescript
const bot = new Bot(process.env.BOT_TOKEN!, {
  mode: "websocket",
  apiBaseUrl: process.env.GIANO_API_URL!,
  wsUrl: process.env.GIANO_WS_URL!,
  logLevel: "info",
  retryAttempts: 5,
  retryDelay: 2000,
});
```

#### Production - Webhook (Serverless)

```typescript
const bot = new Bot(process.env.BOT_TOKEN!, {
  mode: "webhook",
  apiBaseUrl: process.env.GIANO_API_URL!,
  logLevel: "error", // Chỉ log lỗi để giảm chi phí
});
```

### 2.3 Environment Variables Template

```env
# .env
BOT_TOKEN=your_bot_token_here
GIANO_API_URL=https://api.giano.example.com
GIANO_WS_URL=wss://api.giano.example.com
LOG_LEVEL=info
```

---

## 3. Vòng Đời Bot

### 3.1 Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BOT LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  CREATE  │───▶│  START   │───▶│ RUNNING  │───▶│   STOP   │  │
│  │   Bot    │    │   Bot    │    │  (Loop)  │    │   Bot    │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │         │
│       ▼               ▼               ▼               ▼         │
│  new Bot()       bot.start()    Handle Updates   bot.stop()    │
│  - Validate      - Connect WS   - Route to       - Disconnect  │
│  - Init Router   - Auth token     handlers       - Cleanup     │
│  - Init Client   - Ready event  - Process msg    - Stopped evt │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Các Giai Đoạn

#### Giai đoạn 1: Khởi Tạo (CREATE)

```typescript
// 1. Validate token (bắt buộc, không rỗng)
// 2. Merge options với defaults
// 3. Khởi tạo ApiClient
// 4. Khởi tạo UpdateRouter
// 5. Khởi tạo EventEmitter

const bot = new Bot("token", options);
```

#### Giai đoạn 2: Khởi Động (START)

```typescript
// WebSocket mode:
await bot.start();
// - Tạo WebSocket connection với token
// - Đợi kết nối thành công
// - Emit 'ready' event

// Webhook mode:
await bot.startWebhook(8080, "/webhook");
// - Tạo Express server
// - Listen trên port và path
// - Emit 'ready' event
```

#### Giai đoạn 3: Chạy (RUNNING)

```typescript
// Bot tự động:
// - Nhận updates từ WebSocket/Webhook
// - Parse và validate update
// - Tạo Context object
// - Chạy middleware chain
// - Route đến handlers phù hợp
// - Xử lý errors
```

#### Giai đoạn 4: Dừng (STOP)

```typescript
await bot.stop();
// - Ngừng nhận updates mới
// - Đóng WebSocket/HTTP server
// - Emit 'stopped' event
```

---

## 4. Luồng Xử Lý Tin Nhắn

### 4.1 Update Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MESSAGE PROCESSING FLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. RECEIVE UPDATE                                                       │
│     ┌──────────────────┐                                                │
│     │  WebSocket/HTTP  │                                                │
│     │  receives JSON   │                                                │
│     └────────┬─────────┘                                                │
│              │                                                           │
│              ▼                                                           │
│  2. PARSE UPDATE                                                         │
│     ┌──────────────────┐                                                │
│     │ {                │                                                │
│     │   updateId: "x", │                                                │
│     │   message: {...} │                                                │
│     │ }                │                                                │
│     └────────┬─────────┘                                                │
│              │                                                           │
│              ▼                                                           │
│  3. CREATE CONTEXT                                                       │
│     ┌──────────────────┐                                                │
│     │ new Context(     │                                                │
│     │   update,        │                                                │
│     │   apiClient      │                                                │
│     │ )                │                                                │
│     └────────┬─────────┘                                                │
│              │                                                           │
│              ▼                                                           │
│  4. RUN MIDDLEWARE CHAIN                                                 │
│     ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐   │
│     │  Middleware 1    │───▶│  Middleware 2    │───▶│    ...       │   │
│     │  (ctx, next)     │    │  (ctx, next)     │    │              │   │
│     └──────────────────┘    └──────────────────┘    └──────┬───────┘   │
│              │                                              │           │
│   (if next() not called, stop here)                         │           │
│              │◀─────────────────────────────────────────────┘           │
│              ▼                                                           │
│  5. ROUTE TO HANDLERS                                                    │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │                                                               │    │
│     │  Is Command? (/start, /help, etc.)                           │    │
│     │     │                                                         │    │
│     │     ├── YES ──▶ Run command handlers (specific + general)    │    │
│     │     │           ctx.command = "start"                         │    │
│     │     │           ctx.args = ["arg1", "arg2"]                   │    │
│     │     │                                                         │    │
│     │     └── NO ───▶ Run text handlers                            │    │
│     │                                                               │    │
│     │  Run message handlers (always)                               │    │
│     │                                                               │    │
│     └──────────────────────────────────────────────────────────────┘    │
│              │                                                           │
│              ▼                                                           │
│  6. HANDLER EXECUTION                                                    │
│     ┌──────────────────┐                                                │
│     │  async (ctx) => {│                                                │
│     │    ctx.reply()   │───────────────────────────────────────────┐    │
│     │  }               │                                           │    │
│     └──────────────────┘                                           │    │
│                                                                     ▼    │
│  7. SEND RESPONSE                                        ┌─────────────┐│
│                                                          │  ApiClient  ││
│                                                          │  POST /bot  ││
│                                                          │  /sendMsg   ││
│                                                          └─────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Handler Priority

```
1. message handlers    ← Chạy đầu tiên, cho TẤT CẢ tin nhắn
2. command handlers    ← Nếu tin nhắn bắt đầu bằng "/"
   - specific handlers ← bot.command('start', ...)
   - general handlers  ← bot.on('command', ...)
3. text handlers       ← Nếu tin nhắn KHÔNG phải command
```

### 4.3 Context Object

```typescript
interface Context {
  // Properties
  updateId: string; // ID của update
  message: Message; // Full message object
  chatId: string; // Getter: message.chat.id
  userId: string; // Getter: message.from.id
  text: string; // Getter: message.text
  messageId: string; // Getter: message.messageId
  command?: string; // Command name (nếu là command)
  args?: string[]; // Command arguments (nếu là command)

  // Methods
  reply(text, options?): Promise<Message>; // Reply với quote
  send(text, options?): Promise<Message>; // Send không quote
  replyWithButtons(text, buttons): Promise<Message>; // Reply với buttons
}
```

---

## 5. Patterns & Best Practices

### 5.1 Middleware Patterns

```typescript
// ✅ Logging Middleware
bot.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`→ ${ctx.userId}: ${ctx.text}`);
  await next();
  console.log(`← Response in ${Date.now() - start}ms`);
});

// ✅ Error Handling Middleware
bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error("Handler error:", error);
    await ctx.reply("Đã xảy ra lỗi, vui lòng thử lại!");
  }
});

// ✅ Rate Limiting Middleware
const userLastMessage = new Map<string, number>();
bot.use(async (ctx, next) => {
  const lastTime = userLastMessage.get(ctx.userId) || 0;
  if (Date.now() - lastTime < 1000) {
    return; // Skip nếu spam
  }
  userLastMessage.set(ctx.userId, Date.now());
  await next();
});

// ✅ Admin Only Middleware
const ADMIN_IDS = ["admin1", "admin2"];
const adminOnly = async (ctx: Context, next: () => Promise<void>) => {
  if (ADMIN_IDS.includes(ctx.userId)) {
    await next();
  } else {
    await ctx.reply("Bạn không có quyền sử dụng lệnh này.");
  }
};
```

### 5.2 Command Handler Patterns

```typescript
// ✅ Simple command
bot.command("ping", async (ctx) => {
  await ctx.reply("Pong! 🏓");
});

// ✅ Command với arguments
bot.command("remind", async (ctx) => {
  const time = ctx.args?.[0];
  const message = ctx.args?.slice(1).join(" ");

  if (!time || !message) {
    await ctx.reply("Cách dùng: /remind <time> <message>");
    return;
  }

  // Schedule reminder...
  await ctx.reply(`Đã đặt nhắc nhở: "${message}" sau ${time}`);
});

// ✅ Multi-step conversation
const userStates = new Map<string, string>();

bot.command("survey", async (ctx) => {
  userStates.set(ctx.userId, "waiting_name");
  await ctx.reply("Xin chào! Tên bạn là gì?");
});

bot.on("text", async (ctx) => {
  const state = userStates.get(ctx.userId);

  switch (state) {
    case "waiting_name":
      userStates.set(ctx.userId, "waiting_age");
      await ctx.reply(`Chào ${ctx.text}! Bạn bao nhiêu tuổi?`);
      break;
    case "waiting_age":
      userStates.delete(ctx.userId);
      await ctx.reply("Cảm ơn bạn đã hoàn thành khảo sát!");
      break;
  }
});
```

### 5.3 Error Handling

```typescript
// Global error handler
bot.on("error", (error, ctx) => {
  console.error("Bot error:", error);

  // Log to external service
  errorReporter.capture(error, {
    userId: ctx?.userId,
    chatId: ctx?.chatId,
    text: ctx?.text,
  });
});

// Handler-level error handling
bot.command("risky", async (ctx) => {
  try {
    await riskyOperation();
    await ctx.reply("Thành công!");
  } catch (error) {
    await ctx.reply("Thao tác thất bại, vui lòng thử lại.");
    throw error; // Re-throw để global handler log
  }
});
```

### 5.4 Graceful Shutdown

```typescript
// Handle SIGINT (Ctrl+C)
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await bot.stop();
  process.exit(0);
});

// Handle SIGTERM (Docker/K8s)
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, graceful shutdown...");
  await bot.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  await bot.stop();
  process.exit(1);
});
```

---

## 6. Ví Dụ Hoàn Chỉnh

### 6.1 Project Structure

```
my-bot/
├── src/
│   ├── index.ts           # Entry point
│   ├── config.ts          # Configuration
│   ├── handlers/
│   │   ├── commands.ts    # Command handlers
│   │   └── text.ts        # Text handlers
│   ├── middleware/
│   │   ├── logging.ts     # Logging middleware
│   │   └── auth.ts        # Auth middleware
│   └── services/
│       └── database.ts    # External services
├── .env
├── package.json
└── tsconfig.json
```

### 6.2 Complete Bot Example

```typescript
// src/config.ts
export const config = {
  token: process.env.BOT_TOKEN!,
  apiBaseUrl: process.env.GIANO_API_URL!,
  wsUrl: process.env.GIANO_WS_URL!,
  logLevel: (process.env.LOG_LEVEL || "info") as "debug" | "info" | "error",
  adminIds: (process.env.ADMIN_IDS || "").split(","),
};

// src/middleware/logging.ts
import { Context } from "gianobot";

export const loggingMiddleware = async (
  ctx: Context,
  next: () => Promise<void>,
) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ← ${ctx.userId}: ${ctx.text}`);
  await next();
  console.log(
    `[${new Date().toISOString()}] → Response in ${Date.now() - start}ms`,
  );
};

// src/handlers/commands.ts
import { Context } from "gianobot";

export const startHandler = async (ctx: Context) => {
  await ctx.replyWithButtons(
    "🤖 Chào mừng bạn đến với Bot!\n\nChọn một hành động:",
    [
      [
        { text: "📚 Trợ giúp", callbackData: "help" },
        { text: "⚙️ Cài đặt", callbackData: "settings" },
      ],
      [{ text: "🌐 Website", url: "https://example.com" }],
    ],
  );
};

export const helpHandler = async (ctx: Context) => {
  await ctx.reply(
    `
📚 *Danh sách lệnh*

/start - Khởi động bot
/help - Hiển thị trợ giúp
/echo <text> - Lặp lại tin nhắn
/time - Hiển thị thời gian hiện tại
  `.trim(),
  );
};

// src/index.ts
import { Bot } from "gianobot";
import { config } from "./config";
import { loggingMiddleware } from "./middleware/logging";
import { startHandler, helpHandler } from "./handlers/commands";

// Create bot instance
const bot = new Bot(config.token, {
  mode: "websocket",
  apiBaseUrl: config.apiBaseUrl,
  wsUrl: config.wsUrl,
  logLevel: config.logLevel,
});

// Register middleware
bot.use(loggingMiddleware);

// Register commands
bot.command("start", startHandler);
bot.command("help", helpHandler);

bot.command("echo", async (ctx) => {
  const text = ctx.args?.join(" ");
  if (text) {
    await ctx.reply(`🔊 ${text}`);
  } else {
    await ctx.reply("Cách dùng: /echo <tin nhắn>");
  }
});

bot.command("time", async (ctx) => {
  await ctx.reply(`🕐 ${new Date().toLocaleString("vi-VN")}`);
});

// Handle text messages
bot.on("text", async (ctx) => {
  // Echo back if not a command
  if (!ctx.text.startsWith("/")) {
    await ctx.reply(`Bạn nói: ${ctx.text}`);
  }
});

// Handle errors
bot.on("error", (error, ctx) => {
  console.error("Bot error:", error);
});

// Start bot
bot
  .start()
  .then(() => console.log("✅ Bot is running!"))
  .catch((error) => {
    console.error("Failed to start bot:", error);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await bot.stop();
  process.exit(0);
});
```

---

## 7. Troubleshooting

| Vấn đề                       | Nguyên nhân                       | Giải pháp                            |
| ---------------------------- | --------------------------------- | ------------------------------------ |
| Bot không nhận tin nhắn      | Token sai hoặc không kết nối được | Kiểm tra token và URL                |
| WebSocket liên tục reconnect | Network không ổn định             | Tăng `retryDelay`                    |
| Rate limit error (429)       | Gửi tin quá nhiều                 | SDK tự động xử lý, đợi `retry_after` |
| Bot không reply              | Handler không async/await đúng    | Kiểm tra async/await                 |

---

## 8. API Reference

### Bot Methods

| Method                                    | Description             | Returns            |
| ----------------------------------------- | ----------------------- | ------------------ |
| `new Bot(token, options?)`                | Tạo bot instance        | `Bot`              |
| `bot.start()`                             | Khởi động WebSocket     | `Promise<void>`    |
| `bot.startWebhook(port, path)`            | Khởi động Webhook       | `Promise<void>`    |
| `bot.stop()`                              | Dừng bot                | `Promise<void>`    |
| `bot.command(cmd, handler)`               | Đăng ký command handler | `void`             |
| `bot.on(event, handler)`                  | Đăng ký event handler   | `void`             |
| `bot.use(middleware)`                     | Đăng ký middleware      | `void`             |
| `bot.sendMessage(chatId, text, options?)` | Gửi tin nhắn            | `Promise<Message>` |

### Context Methods

| Method                                | Description       | Returns            |
| ------------------------------------- | ----------------- | ------------------ |
| `ctx.reply(text, options?)`           | Reply với quote   | `Promise<Message>` |
| `ctx.send(text, options?)`            | Send không quote  | `Promise<Message>` |
| `ctx.replyWithButtons(text, buttons)` | Reply với buttons | `Promise<Message>` |

---

_Tài liệu này được tạo cho GianoBot SDK v1.0.1_
