/**
 * Buttons Bot Example
 * 
 * Ví dụ về cách sử dụng inline buttons (nút bấm) trong bot.
 * 
 * Chạy: ts-node examples/buttons-bot.ts
 */

import { Bot } from '../src';

const bot = new Bot(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN', {
  mode: 'websocket',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  wsUrl: process.env.WS_URL || 'ws://localhost:3000',
  logLevel: 'info',
});

// Lệnh /menu - Hiển thị menu với các nút
bot.command('menu', async (ctx) => {
  await ctx.replyWithButtons(
    '🍽️ Chọn một tùy chọn:',
    [
      [
        { text: '🍕 Pizza', callbackData: 'food_pizza' },
        { text: '🍔 Burger', callbackData: 'food_burger' },
      ],
      [
        { text: '🍜 Phở', callbackData: 'food_pho' },
        { text: '🍱 Sushi', callbackData: 'food_sushi' },
      ],
      [
        { text: '🌐 Xem website', url: 'https://example.com' },
      ],
    ]
  );
});

// Lệnh /settings - Hiển thị cài đặt với các nút
bot.command('settings', async (ctx) => {
  await ctx.replyWithButtons(
    '⚙️ Cài đặt:',
    [
      [
        { text: '🔔 Thông báo: Bật', callbackData: 'setting_notif_on' },
      ],
      [
        { text: '🌙 Chế độ tối: Tắt', callbackData: 'setting_dark_off' },
      ],
      [
        { text: '🌍 Ngôn ngữ: Tiếng Việt', callbackData: 'setting_lang_vi' },
      ],
      [
        { text: '🔙 Quay lại', callbackData: 'back_to_menu' },
      ],
    ]
  );
});

// Lệnh /quiz - Tạo một quiz đơn giản
bot.command('quiz', async (ctx) => {
  await ctx.replyWithButtons(
    '❓ Thủ đô của Việt Nam là gì?',
    [
      [
        { text: 'Hà Nội', callbackData: 'quiz_correct' },
        { text: 'TP.HCM', callbackData: 'quiz_wrong' },
      ],
      [
        { text: 'Đà Nẵng', callbackData: 'quiz_wrong' },
        { text: 'Cần Thơ', callbackData: 'quiz_wrong' },
      ],
    ]
  );
});

// Lệnh /rating - Đánh giá với emoji
bot.command('rating', async (ctx) => {
  await ctx.replyWithButtons(
    '⭐ Bạn đánh giá dịch vụ của chúng tôi như thế nào?',
    [
      [
        { text: '😍', callbackData: 'rate_5' },
        { text: '😊', callbackData: 'rate_4' },
        { text: '😐', callbackData: 'rate_3' },
        { text: '😕', callbackData: 'rate_2' },
        { text: '😞', callbackData: 'rate_1' },
      ],
    ]
  );
});

// Lệnh /confirm - Xác nhận hành động
bot.command('confirm', async (ctx) => {
  await ctx.replyWithButtons(
    '⚠️ Bạn có chắc chắn muốn xóa tất cả dữ liệu?',
    [
      [
        { text: '✅ Có, xóa', callbackData: 'confirm_yes' },
        { text: '❌ Không, hủy', callbackData: 'confirm_no' },
      ],
    ]
  );
});

// Lệnh /pagination - Ví dụ về phân trang
let currentPage = 1;
const totalPages = 5;

bot.command('pagination', async (ctx) => {
  currentPage = 1;
  await showPage(ctx, currentPage);
});

async function showPage(ctx: any, page: number) {
  const buttons: Array<{ text: string; callbackData: string }> = [];
  
  // Nút Previous
  if (page > 1) {
    buttons.push({ text: '⬅️ Trước', callbackData: `page_${page - 1}` });
  }
  
  // Hiển thị trang hiện tại
  buttons.push({ text: `📄 ${page}/${totalPages}`, callbackData: 'page_current' });
  
  // Nút Next
  if (page < totalPages) {
    buttons.push({ text: 'Sau ➡️', callbackData: `page_${page + 1}` });
  }
  
  await ctx.replyWithButtons(
    `📖 Trang ${page}/${totalPages}\n\nNội dung của trang ${page}...`,
    [buttons]
  );
}

// Xử lý callback từ các nút (giả lập)
// Lưu ý: Trong thực tế, bạn cần xử lý callback_query từ API
bot.on('text', async (ctx) => {
  // Giả lập xử lý callback
  const text = ctx.text?.toLowerCase() || '';
  
  if (text.startsWith('callback:')) {
    const callbackData = text.replace('callback:', '');
    
    // Xử lý các callback từ menu
    if (callbackData.startsWith('food_')) {
      const food = callbackData.replace('food_', '');
      await ctx.reply(`✅ Bạn đã chọn: ${food}`);
    }
    
    // Xử lý quiz
    else if (callbackData === 'quiz_correct') {
      await ctx.reply('🎉 Chính xác! Hà Nội là thủ đô của Việt Nam.');
    } else if (callbackData === 'quiz_wrong') {
      await ctx.reply('❌ Sai rồi! Thủ đô của Việt Nam là Hà Nội.');
    }
    
    // Xử lý rating
    else if (callbackData.startsWith('rate_')) {
      const rating = callbackData.replace('rate_', '');
      await ctx.reply(`⭐ Cảm ơn bạn đã đánh giá ${rating}/5 sao!`);
    }
    
    // Xử lý confirm
    else if (callbackData === 'confirm_yes') {
      await ctx.reply('🗑️ Đã xóa tất cả dữ liệu!');
    } else if (callbackData === 'confirm_no') {
      await ctx.reply('✅ Đã hủy thao tác.');
    }
    
    // Xử lý pagination
    else if (callbackData.startsWith('page_')) {
      const page = parseInt(callbackData.replace('page_', ''));
      if (!isNaN(page)) {
        currentPage = page;
        await showPage(ctx, page);
      }
    }
  }
});

bot.command('start', async (ctx) => {
  const welcomeText = `
👋 Xin chào! Tôi là bot với các nút tương tác.

📚 Các lệnh có sẵn:
/menu - Hiển thị menu món ăn
/settings - Cài đặt
/quiz - Câu đố vui
/rating - Đánh giá dịch vụ
/confirm - Xác nhận hành động
/pagination - Ví dụ phân trang

💡 Mẹo: Để giả lập callback, gửi tin nhắn "callback:<data>"
Ví dụ: callback:food_pizza
  `.trim();
  
  await ctx.reply(welcomeText);
});

bot.on('ready', () => {
  console.log('✅ Buttons bot đã sẵn sàng!');
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
