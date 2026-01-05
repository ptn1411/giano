/**
 * Conversation Bot Example
 * 
 * Ví dụ về bot có khả năng quản lý trạng thái hội thoại (conversation state).
 * Bot sẽ hỏi thông tin người dùng theo từng bước.
 * 
 * Chạy: ts-node examples/conversation-bot.ts
 */

import { Bot } from '../src';

const bot = new Bot(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN', {
  mode: 'websocket',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  wsUrl: process.env.WS_URL || 'ws://localhost:3000',
  logLevel: 'info',
});

// Định nghĩa các bước trong hội thoại
enum ConversationStep {
  IDLE = 'idle',
  WAITING_NAME = 'waiting_name',
  WAITING_EMAIL = 'waiting_email',
  WAITING_AGE = 'waiting_age',
}

// Interface cho trạng thái người dùng
interface UserState {
  step: ConversationStep;
  data: {
    name?: string;
    email?: string;
    age?: number;
  };
}

// Lưu trữ trạng thái người dùng
const userStates = new Map<string, UserState>();

// Helper function để lấy hoặc tạo state
function getUserState(userId: string): UserState {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      step: ConversationStep.IDLE,
      data: {},
    });
  }
  return userStates.get(userId)!;
}

// Lệnh /register - Bắt đầu quá trình đăng ký
bot.command('register', async (ctx) => {
  const state = getUserState(ctx.userId);
  state.step = ConversationStep.WAITING_NAME;
  state.data = {};
  
  await ctx.reply('📝 Bắt đầu đăng ký!\n\n👤 Tên của bạn là gì?');
});

// Lệnh /cancel - Hủy quá trình đăng ký
bot.command('cancel', async (ctx) => {
  const state = getUserState(ctx.userId);
  
  if (state.step === ConversationStep.IDLE) {
    await ctx.reply('❌ Không có quá trình đăng ký nào đang diễn ra.');
  } else {
    state.step = ConversationStep.IDLE;
    state.data = {};
    await ctx.reply('🚫 Đã hủy quá trình đăng ký.');
  }
});

// Lệnh /status - Xem thông tin đã đăng ký
bot.command('status', async (ctx) => {
  const state = getUserState(ctx.userId);
  
  if (!state.data.name) {
    await ctx.reply('ℹ️ Bạn chưa đăng ký. Sử dụng /register để bắt đầu.');
    return;
  }
  
  const info = `
📋 Thông tin của bạn:
👤 Tên: ${state.data.name}
📧 Email: ${state.data.email}
🎂 Tuổi: ${state.data.age}
  `.trim();
  
  await ctx.reply(info);
});

// Xử lý tin nhắn văn bản dựa trên trạng thái
bot.on('text', async (ctx) => {
  const state = getUserState(ctx.userId);
  
  // Nếu đang ở trạng thái IDLE, không làm gì
  if (state.step === ConversationStep.IDLE) {
    return;
  }
  
  // Xử lý theo từng bước
  switch (state.step) {
    case ConversationStep.WAITING_NAME:
      // Lưu tên và chuyển sang bước tiếp theo
      state.data.name = ctx.text;
      state.step = ConversationStep.WAITING_EMAIL;
      await ctx.reply(`Xin chào ${state.data.name}! 👋\n\n📧 Email của bạn là gì?`);
      break;
      
    case ConversationStep.WAITING_EMAIL:
      // Kiểm tra định dạng email đơn giản
      if (!ctx.text?.includes('@')) {
        await ctx.reply('❌ Email không hợp lệ. Vui lòng nhập lại:');
        return;
      }
      
      state.data.email = ctx.text;
      state.step = ConversationStep.WAITING_AGE;
      await ctx.reply('📧 Đã lưu email!\n\n🎂 Tuổi của bạn là bao nhiêu?');
      break;
      
    case ConversationStep.WAITING_AGE:
      // Kiểm tra tuổi là số
      const age = parseInt(ctx.text || '');
      
      if (isNaN(age) || age < 1 || age > 150) {
        await ctx.reply('❌ Tuổi không hợp lệ. Vui lòng nhập một số từ 1-150:');
        return;
      }
      
      state.data.age = age;
      state.step = ConversationStep.IDLE;
      
      // Hiển thị thông tin đã đăng ký
      const summary = `
✅ Đăng ký hoàn tất!

📋 Thông tin của bạn:
👤 Tên: ${state.data.name}
📧 Email: ${state.data.email}
🎂 Tuổi: ${state.data.age}

Sử dụng /status để xem lại thông tin.
      `.trim();
      
      await ctx.reply(summary);
      break;
  }
});

// Lệnh /start
bot.command('start', async (ctx) => {
  const welcomeText = `
👋 Xin chào! Tôi là bot quản lý hội thoại.

📚 Các lệnh có sẵn:
/register - Bắt đầu đăng ký thông tin
/status - Xem thông tin đã đăng ký
/cancel - Hủy quá trình đăng ký
/help - Hiển thị trợ giúp
  `.trim();
  
  await ctx.reply(welcomeText);
});

bot.command('help', async (ctx) => {
  await ctx.reply('Sử dụng /start để xem hướng dẫn.');
});

bot.on('ready', () => {
  console.log('✅ Conversation bot đã sẵn sàng!');
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
