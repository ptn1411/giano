/**
 * Webhook Bot Example
 * 
 * Ví dụ về bot chạy ở chế độ webhook, phù hợp cho serverless deployment.
 * 
 * Chạy: ts-node examples/webhook-bot.ts
 */

import { Bot } from '../src';

// Tạo bot instance với chế độ webhook
const bot = new Bot(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN', {
  mode: 'webhook',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  logLevel: 'info',
});

// Đăng ký các handler
bot.command('start', async (ctx) => {
  await ctx.reply('👋 Xin chào từ webhook mode!');
});

bot.command('ping', async (ctx) => {
  await ctx.reply('🏓 Pong!');
});

bot.on('text', async (ctx) => {
  await ctx.reply(`📝 Bạn đã nói: ${ctx.text}`);
});

bot.on('error', (error) => {
  console.error('Lỗi bot:', error);
});

// Cấu hình webhook server
const PORT = parseInt(process.env.PORT || '8080');
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';

// Khởi động webhook server
bot.startWebhook(PORT, WEBHOOK_PATH)
  .then(() => {
    console.log(`✅ Webhook server đang lắng nghe trên cổng ${PORT}`);
    console.log(`📍 Webhook URL: http://localhost:${PORT}${WEBHOOK_PATH}`);
  })
  .catch((error) => {
    console.error('Không thể khởi động webhook server:', error);
    process.exit(1);
  });

// Xử lý tắt graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Đang tắt webhook server...');
  await bot.stop();
  process.exit(0);
});
