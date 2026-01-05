/**
 * Basic Bot Example
 * 
 * Ví dụ cơ bản về cách tạo một bot đơn giản với các lệnh cơ bản.
 * 
 * Chạy: ts-node examples/basic-bot.ts
 */

import { Bot } from '../src';

// Tạo bot instance với token
const bot = new Bot(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN', {
  mode: 'websocket',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  wsUrl: process.env.WS_URL || 'ws://localhost:3000',
  logLevel: 'info',
});

// Xử lý lệnh /start
bot.command('start', async (ctx) => {
  await ctx.reply('Xin chào! Tôi là bot của bạn. Sử dụng /help để xem các lệnh có sẵn.');
});

// Xử lý lệnh /help
bot.command('help', async (ctx) => {
  const helpText = `
📚 Các lệnh có sẵn:
/start - Khởi động bot
/help - Hiển thị trợ giúp
/echo <text> - Lặp lại tin nhắn của bạn
/time - Hiển thị thời gian hiện tại
  `.trim();
  
  await ctx.reply(helpText);
});

// Xử lý lệnh /echo với tham số
bot.command('echo', async (ctx) => {
  if (ctx.args && ctx.args.length > 0) {
    const message = ctx.args.join(' ');
    await ctx.reply(`🔊 ${message}`);
  } else {
    await ctx.reply('Cách dùng: /echo <text>');
  }
});

// Xử lý lệnh /time
bot.command('time', async (ctx) => {
  const now = new Date();
  await ctx.reply(`🕐 Thời gian hiện tại: ${now.toLocaleString('vi-VN')}`);
});

// Xử lý tất cả tin nhắn văn bản
bot.on('text', async (ctx) => {
  console.log(`Nhận tin nhắn từ ${ctx.userId}: ${ctx.text}`);
});

// Xử lý lỗi
bot.on('error', (error) => {
  console.error('Lỗi bot:', error);
});

// Xử lý sự kiện ready
bot.on('ready', () => {
  console.log('✅ Bot đã sẵn sàng và đang chạy!');
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
