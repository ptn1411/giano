/**
 * Middleware Bot Example
 * 
 * Ví dụ về cách sử dụng middleware để logging, authentication, và rate limiting.
 * 
 * Chạy: ts-node examples/middleware-bot.ts
 */

import { Bot } from '../src';

const bot = new Bot(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN', {
  mode: 'websocket',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  wsUrl: process.env.WS_URL || 'ws://localhost:3000',
  logLevel: 'info',
});

// 1. Logging Middleware - Ghi log tất cả tin nhắn
bot.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`📨 [${new Date().toISOString()}] Tin nhắn từ ${ctx.userId}`);
  
  await next(); // Tiếp tục xử lý
  
  const duration = Date.now() - start;
  console.log(`⏱️  Xử lý mất ${duration}ms`);
});

// 2. Authentication Middleware - Kiểm tra quyền admin
const ADMIN_IDS = ['admin123', 'admin456'];

bot.use(async (ctx, next) => {
  // Chỉ kiểm tra cho lệnh admin
  if (ctx.command === 'admin') {
    if (!ADMIN_IDS.includes(ctx.userId)) {
      await ctx.reply('❌ Bạn không có quyền sử dụng lệnh này.');
      return; // Dừng xử lý (không gọi next())
    }
  }
  
  await next(); // Tiếp tục xử lý
});

// 3. Rate Limiting Middleware - Giới hạn tốc độ gửi tin nhắn
const userLastMessage = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 2 giây

bot.use(async (ctx, next) => {
  const userId = ctx.userId;
  const now = Date.now();
  const lastMessageTime = userLastMessage.get(userId) || 0;
  
  if (now - lastMessageTime < RATE_LIMIT_MS) {
    await ctx.reply('⏳ Vui lòng chờ một chút trước khi gửi tin nhắn tiếp theo!');
    return; // Dừng xử lý
  }
  
  userLastMessage.set(userId, now);
  await next();
});

// 4. Error Handling Middleware - Xử lý lỗi toàn cục
bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('❌ Lỗi trong handler:', error);
    await ctx.reply('😔 Xin lỗi, đã xảy ra lỗi khi xử lý tin nhắn của bạn.');
  }
});

// Đăng ký các handler
bot.command('start', async (ctx) => {
  await ctx.reply('👋 Xin chào! Bot với middleware đã sẵn sàng.');
});

bot.command('admin', async (ctx) => {
  await ctx.reply('🔐 Chào mừng đến bảng điều khiển admin!');
});

bot.command('test', async (ctx) => {
  // Giả lập lỗi để test error handling middleware
  if (ctx.args?.[0] === 'error') {
    throw new Error('Test error');
  }
  await ctx.reply('✅ Test thành công!');
});

bot.on('text', async (ctx) => {
  await ctx.reply(`Đã nhận: ${ctx.text}`);
});

bot.on('ready', () => {
  console.log('✅ Bot với middleware đã sẵn sàng!');
});

// Khởi động bot
bot.start().catch((error) => {
  console.error('Không thể khởi động bot:', error);
  process.exit(1);
});

// Xử lý tắt graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Đang tắt bot...');
  await bot.stop();
  process.exit(0);
});
