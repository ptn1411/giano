import { Bot, Context } from "../src";

// 1. Lấy token từ biến môi trường
const token =
  "aeabd319-f175-4b19-8477-e0b7a574fdb2:l5mPHcf5qbzvGKZbMafsa0u8snlZfF3w";
const apiBaseUrl = "https://messages-api.bug.edu.vn";
const wsUrl = "wss://messages-api.bug.edu.vn/bot/ws";

if (!token) {
  console.error("Error: BOT_TOKEN is required");
  console.error("Usage: BOT_TOKEN=your_token npx ts-node echo-test-bot.ts");
  process.exit(1);
}

console.log("🤖 Starting Echo Test Bot...");
console.log(`   API URL: ${apiBaseUrl}`);
console.log(`   WS URL:  ${wsUrl}`);

// 2. Khởi tạo Bot
const bot = new Bot(token, {
  apiBaseUrl,
  wsUrl,
  mode: "websocket", // Dùng WebSocket cho realtime
  logLevel: "info",
});

// 3. Đăng ký sự kiện

// Khi kết nối thành công

bot.on("ready", () => {
  console.log("✅ Bot connected to Giano!");
});

// Khi nhận tin nhắn text
bot.on("text", async (ctx: Context) => {
  const text = ctx.text || "";
  const sender = ctx.userId || "unknown";

  console.log(`📩 Received message from ${sender}: "${text}"`);

  if (text === "/ping") {
    await ctx.reply("🏓 Pong!");
    return;
  }

  // Echo lại tin nhắn
  try {
    await ctx.reply(`Bạn nói: ${text}`);
    console.log("   ↪️ Replied success");
  } catch (err) {
    console.error("   ❌ Reply failed:", err);
  }
});

// Khi có lỗi
bot.on("error", (err) => {
  console.error("🔥 Bot Error:", err);
});

// 4. Chạy bot
bot.start().catch((err) => {
  console.error("Failed to start bot:", err);
});
