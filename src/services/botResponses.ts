import { Message, InlineButton } from './mockData';

interface BotResponse {
  text: string;
  inlineKeyboard?: InlineButton[][];
}

// Response templates for different bots
const botResponseTemplates: Record<string, Record<string, BotResponse>> = {
  'bot-1': {
    // Commands
    '/start': {
      text: "👋 Welcome back!\n\nI'm your personal assistant. How can I help you today?",
      inlineKeyboard: [
        [
          { text: "📊 Statistics", callbackData: "stats" },
          { text: "⚙️ Settings", callbackData: "settings" },
        ],
        [{ text: "💬 Start Chat", callbackData: "chat" }],
      ],
    },
    '/help': {
      text: "📚 Help Center\n\nAvailable commands:\n• /start - Restart the bot\n• /help - Show this help\n• /settings - Open settings\n• /profile - View your profile\n• /stats - View statistics",
      inlineKeyboard: [
        [{ text: "📞 Contact Support", callbackData: "support" }],
      ],
    },
    '/settings': {
      text: "⚙️ Settings\n\nConfigure your preferences:",
      inlineKeyboard: [
        [
          { text: "🔔 Notifications", callbackData: "notifications" },
          { text: "🌐 Language", callbackData: "language" },
        ],
        [
          { text: "🎨 Theme", callbackData: "theme" },
          { text: "🔒 Privacy", callbackData: "privacy" },
        ],
      ],
    },
    '/profile': {
      text: "👤 Your Profile\n\n📛 Name: User\n📧 Email: user@example.com\n📅 Joined: Jan 2024\n⭐ Status: Premium",
      inlineKeyboard: [
        [
          { text: "✏️ Edit", callbackData: "edit_profile" },
          { text: "📤 Share", callbackData: "share_profile" },
        ],
      ],
    },
    '/stats': {
      text: "📊 Your Statistics\n\n📈 Messages: 156\n👥 Interactions: 94\n⭐ Rating: 4.9/5\n🏆 Rank: #189",
      inlineKeyboard: [
        [
          { text: "📅 Daily", callbackData: "daily" },
          { text: "📆 Weekly", callbackData: "weekly" },
        ],
        [{ text: "🔄 Refresh", callbackData: "refresh" }],
      ],
    },
    // Callback responses
    'stats': {
      text: "📊 Statistics Dashboard\n\n📈 Today: 12 messages\n📊 This week: 89 messages\n🎯 Goal: 100 messages\n\nProgress: 89%",
      inlineKeyboard: [
        [{ text: "📈 View Details", callbackData: "stats_detail" }],
        [{ text: "🔙 Back", callbackData: "back" }],
      ],
    },
    'settings': {
      text: "⚙️ Settings Panel\n\nSelect an option to configure:",
      inlineKeyboard: [
        [
          { text: "🔔 On", callbackData: "notif_on" },
          { text: "🔕 Off", callbackData: "notif_off" },
        ],
        [{ text: "🔙 Back", callbackData: "back" }],
      ],
    },
    'support': {
      text: "📞 Contact Support\n\nOur team is here to help!\n\n📧 Email: support@example.com\n💬 Live chat: Available 24/7",
      inlineKeyboard: [
        [{ text: "💬 Start Chat", callbackData: "live_chat" }],
      ],
    },
    // Default responses
    'default': {
      text: "I understand you said: \"{message}\"\n\nHow can I help you with that?",
      inlineKeyboard: [
        [
          { text: "📚 Help", callbackData: "help" },
          { text: "📞 Support", callbackData: "support" },
        ],
      ],
    },
  },
  'bot-2': {
    '/start': {
      text: "🛒 Welcome to Shop Bot!\n\nBrowse our amazing products and find the best deals!",
      inlineKeyboard: [
        [
          { text: "🛍️ Shop Now", callbackData: "shop" },
          { text: "🔥 Deals", callbackData: "deals" },
        ],
        [{ text: "🛒 My Cart (0)", callbackData: "cart" }],
      ],
    },
    '/help': {
      text: "🛍️ Shop Bot Help\n\nCommands:\n• /start - Main menu\n• /cart - View your cart\n• /orders - Your orders\n• /deals - Hot deals",
    },
    '/cart': {
      text: "🛒 Your Shopping Cart\n\nYour cart is empty.\n\nStart shopping to add items!",
      inlineKeyboard: [
        [{ text: "🛍️ Browse Products", callbackData: "shop" }],
      ],
    },
    '/orders': {
      text: "📦 Your Orders\n\n1. Order #12345 - Delivered ✅\n2. Order #12346 - In Transit 🚚\n3. Order #12347 - Processing ⏳",
      inlineKeyboard: [
        [{ text: "📋 Order Details", callbackData: "order_details" }],
      ],
    },
    '/deals': {
      text: "🔥 Hot Deals!\n\n🏷️ 50% off Electronics\n🏷️ Buy 2 Get 1 Free - Clothing\n🏷️ Free Shipping over $50",
      inlineKeyboard: [
        [
          { text: "📱 Electronics", callbackData: "electronics" },
          { text: "👕 Clothing", callbackData: "clothing" },
        ],
      ],
    },
    'electronics': {
      text: "📱 Electronics\n\n1. iPhone 15 Pro - $999 💰\n2. MacBook Air M3 - $1,299\n3. AirPods Pro 2 - $249",
      inlineKeyboard: [
        [
          { text: "Add iPhone", callbackData: "add_iphone" },
          { text: "Add MacBook", callbackData: "add_macbook" },
        ],
        [{ text: "🔙 Back", callbackData: "back" }],
      ],
    },
    'clothing': {
      text: "👕 Clothing\n\n1. Premium T-Shirt - $29\n2. Denim Jeans - $59\n3. Hoodie - $49",
      inlineKeyboard: [
        [{ text: "🛒 Add to Cart", callbackData: "add_clothing" }],
        [{ text: "🔙 Back", callbackData: "back" }],
      ],
    },
    'default': {
      text: "🛒 I can help you find products!\n\nTry searching for: electronics, clothing, or deals",
      inlineKeyboard: [
        [
          { text: "🔍 Search", callbackData: "search" },
          { text: "📂 Categories", callbackData: "categories" },
        ],
      ],
    },
  },
  'bot-3': {
    '/start': {
      text: "📰 Welcome to News Bot!\n\nGet the latest news from around the world.",
      inlineKeyboard: [
        [
          { text: "🌍 World", callbackData: "world" },
          { text: "💼 Business", callbackData: "business" },
        ],
        [
          { text: "💻 Tech", callbackData: "tech" },
          { text: "⚽ Sports", callbackData: "sports" },
        ],
      ],
    },
    '/help': {
      text: "📰 News Bot Help\n\nCommands:\n• /start - Main menu\n• /breaking - Breaking news\n• /subscribe - Subscribe to topics\n• /saved - Saved articles",
    },
    '/breaking': {
      text: "🔴 Breaking News\n\n• Major tech company announces layoffs\n• Climate summit reaches historic deal\n• Sports team wins championship",
      inlineKeyboard: [
        [{ text: "📖 Read More", callbackData: "read_more" }],
      ],
    },
    '/subscribe': {
      text: "🔔 Subscription Settings\n\nSelect topics to subscribe:",
      inlineKeyboard: [
        [
          { text: "✅ World", callbackData: "sub_world" },
          { text: "❌ Business", callbackData: "sub_business" },
        ],
        [
          { text: "✅ Tech", callbackData: "sub_tech" },
          { text: "❌ Sports", callbackData: "sub_sports" },
        ],
      ],
    },
    'world': {
      text: "🌍 World News\n\n1. UN Summit discusses climate action\n2. Trade agreements signed in Asia\n3. Cultural festival draws millions",
      inlineKeyboard: [
        [{ text: "📖 Read Full Articles", callbackData: "read_world" }],
        [{ text: "🔙 Back", callbackData: "back" }],
      ],
    },
    'tech': {
      text: "💻 Technology News\n\n1. AI breakthrough in medical research\n2. New smartphone features leaked\n3. Cybersecurity threats on the rise",
      inlineKeyboard: [
        [{ text: "📖 Read Full Articles", callbackData: "read_tech" }],
        [{ text: "🔙 Back", callbackData: "back" }],
      ],
    },
    'sports': {
      text: "⚽ Sports News\n\n1. Championship finals this weekend\n2. Record-breaking performance\n3. Transfer rumors heating up",
      inlineKeyboard: [
        [{ text: "📖 Read Full Articles", callbackData: "read_sports" }],
        [{ text: "🔙 Back", callbackData: "back" }],
      ],
    },
    'default': {
      text: "📰 What news are you interested in?\n\nTry: world, tech, sports, or business",
      inlineKeyboard: [
        [
          { text: "🔥 Trending", callbackData: "trending" },
          { text: "📂 Categories", callbackData: "categories" },
        ],
      ],
    },
  },
};

export function generateBotResponse(
  botId: string,
  userMessage: string,
  chatId: string
): Message {
  const botTemplates = botResponseTemplates[botId] || botResponseTemplates['bot-1'];
  
  // Check for exact command match
  const lowerMessage = userMessage.toLowerCase().trim();
  let response: BotResponse;
  
  if (botTemplates[lowerMessage]) {
    response = botTemplates[lowerMessage];
  } else if (botTemplates[userMessage]) {
    response = botTemplates[userMessage];
  } else {
    // Use default response and replace placeholder
    response = { ...botTemplates['default'] };
    response.text = response.text.replace('{message}', userMessage);
  }
  
  return {
    id: `msg-${chatId}-${Date.now()}`,
    chatId,
    senderId: botId,
    text: response.text,
    timestamp: new Date(),
    isRead: false,
    reactions: [],
    inlineKeyboard: response.inlineKeyboard,
  };
}

export function generateCallbackResponse(
  botId: string,
  callbackData: string,
  chatId: string
): Message | null {
  const botTemplates = botResponseTemplates[botId] || botResponseTemplates['bot-1'];
  
  const response = botTemplates[callbackData];
  if (!response) {
    return {
      id: `msg-${chatId}-${Date.now()}`,
      chatId,
      senderId: botId,
      text: `✅ Action "${callbackData}" processed successfully!`,
      timestamp: new Date(),
      isRead: false,
      reactions: [],
    };
  }
  
  return {
    id: `msg-${chatId}-${Date.now()}`,
    chatId,
    senderId: botId,
    text: response.text,
    timestamp: new Date(),
    isRead: false,
    reactions: [],
    inlineKeyboard: response.inlineKeyboard,
  };
}
