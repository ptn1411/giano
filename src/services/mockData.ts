// Types
export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: Date;
  isBot?: boolean;
}

export interface InlineButton {
  text: string;
  callbackData?: string;
  url?: string;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  url: string;
  mimeType: string;
  progress?: number; // 0-100 for upload progress
  duration?: number; // for voice messages, in seconds
}

export interface ReadReceipt {
  userId: string;
  readAt: Date;
}

export type DeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  isRead: boolean;
  isEdited?: boolean;
  isPinned?: boolean;
  reactions: { emoji: string; userId: string }[];
  attachments?: Attachment[];
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
  };
  inlineKeyboard?: InlineButton[][];
  readBy?: ReadReceipt[]; // For group chat read receipts
  deliveryStatus?: DeliveryStatus; // Message delivery status
}

export interface Chat {
  id: string;
  type: 'private' | 'group' | 'bot';
  name: string;
  avatar: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  isTyping?: boolean;
  typingUser?: string;
  isBot?: boolean;
}

// Mock Users
export const mockUsers: User[] = [
  { id: 'user-1', name: 'You', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You', status: 'online' },
  { id: 'user-2', name: 'Alice Johnson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', status: 'online' },
  { id: 'user-3', name: 'Bob Smith', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', status: 'offline', lastSeen: new Date(Date.now() - 3600000) },
  { id: 'user-4', name: 'Carol White', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol', status: 'online' },
  { id: 'user-5', name: 'David Brown', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David', status: 'away' },
  { id: 'user-6', name: 'Emma Davis', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma', status: 'online' },
  { id: 'user-7', name: 'Frank Miller', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Frank', status: 'offline', lastSeen: new Date(Date.now() - 86400000) },
  // Bots
  { id: 'bot-1', name: 'Assistant Bot', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Assistant', status: 'online', isBot: true },
  { id: 'bot-2', name: 'Shop Bot', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Shop', status: 'online', isBot: true },
  { id: 'bot-3', name: 'News Bot', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=News', status: 'online', isBot: true },
];

// Mock Messages
const createMessages = (chatId: string, participants: string[] = []): Message[] => {
  const messageTemplates = [
    { text: "Hey! How's it going?", senderId: 'user-2' },
    { text: "I'm doing great, thanks for asking! Working on some new projects.", senderId: 'user-1' },
    { text: "That sounds exciting! What kind of projects?", senderId: 'user-2' },
    { text: "Building a chat application with React and TypeScript 🚀", senderId: 'user-1' },
    { text: "Nice! That's really cool. Let me know if you need any help.", senderId: 'user-2' },
    { text: "Will do! Thanks 😊", senderId: 'user-1' },
  ];

  // Generate read receipts for group chats (messages from user-1)
  const generateReadBy = (senderId: string, msgIndex: number): ReadReceipt[] | undefined => {
    if (senderId !== 'user-1' || participants.length <= 2) return undefined;
    
    // Other participants who could have read the message
    const otherParticipants = participants.filter(p => p !== 'user-1');
    
    // Older messages are read by more people
    const readCount = Math.min(otherParticipants.length, messageTemplates.length - msgIndex);
    
    return otherParticipants.slice(0, readCount).map((userId, i) => ({
      userId,
      readAt: new Date(Date.now() - (messageTemplates.length - msgIndex - i) * 60000),
    }));
  };

  // Generate delivery status based on message age and sender
  const generateDeliveryStatus = (senderId: string, msgIndex: number): DeliveryStatus => {
    if (senderId !== 'user-1') return 'read'; // Received messages are always "read" by us
    
    // Simulate different statuses for user's own messages
    if (msgIndex === messageTemplates.length - 1) return 'delivered'; // Latest message just delivered
    if (msgIndex === messageTemplates.length - 2) return 'read'; // Second to last is read
    return 'read'; // Older messages are read
  };

  return messageTemplates.map((msg, index) => ({
    id: `msg-${chatId}-${index}`,
    chatId,
    senderId: msg.senderId,
    text: msg.text,
    timestamp: new Date(Date.now() - (messageTemplates.length - index) * 300000),
    isRead: index < messageTemplates.length - 1,
    reactions: index === 3 ? [{ emoji: '🔥', userId: 'user-2' }] : [],
    readBy: generateReadBy(msg.senderId, index),
    deliveryStatus: generateDeliveryStatus(msg.senderId, index),
  }));
};

// Mock Chats
export const mockChats: Chat[] = [
  // Bot chats first
  {
    id: 'bot-chat-1',
    type: 'bot',
    name: 'Assistant Bot',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Assistant',
    participants: ['user-1', 'bot-1'],
    unreadCount: 1,
    isBot: true,
  },
  {
    id: 'bot-chat-2',
    type: 'bot',
    name: 'Shop Bot',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Shop',
    participants: ['user-1', 'bot-2'],
    unreadCount: 0,
    isBot: true,
  },
  {
    id: 'bot-chat-3',
    type: 'bot',
    name: 'News Bot',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=News',
    participants: ['user-1', 'bot-3'],
    unreadCount: 3,
    isBot: true,
  },
  // Regular chats
  {
    id: 'chat-1',
    type: 'private',
    name: 'Alice Johnson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    participants: ['user-1', 'user-2'],
    unreadCount: 2,
    isTyping: false,
  },
  {
    id: 'chat-2',
    type: 'group',
    name: 'Project Team',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Project',
    participants: ['user-1', 'user-2', 'user-3', 'user-4'],
    unreadCount: 5,
    isTyping: true,
    typingUser: 'Bob',
  },
  {
    id: 'chat-3',
    type: 'private',
    name: 'Bob Smith',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    participants: ['user-1', 'user-3'],
    unreadCount: 0,
  },
  {
    id: 'chat-4',
    type: 'group',
    name: 'Family Group',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Family',
    participants: ['user-1', 'user-5', 'user-6', 'user-7'],
    unreadCount: 12,
  },
  {
    id: 'chat-5',
    type: 'private',
    name: 'Carol White',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol',
    participants: ['user-1', 'user-4'],
    unreadCount: 0,
  },
  {
    id: 'chat-6',
    type: 'private',
    name: 'David Brown',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    participants: ['user-1', 'user-5'],
    unreadCount: 1,
  },
  {
    id: 'chat-7',
    type: 'group',
    name: 'Gaming Squad',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Gaming',
    participants: ['user-1', 'user-2', 'user-5', 'user-6'],
    unreadCount: 0,
  },
];

// Create bot messages with inline keyboards
const createBotMessages = (chatId: string, botId: string): Message[] => {
  if (botId === 'bot-1') {
    return [
      {
        id: `msg-${chatId}-1`,
        chatId,
        senderId: 'bot-1',
        text: "👋 Welcome to Assistant Bot!\n\nI can help you with various tasks. Use the buttons below or type / to see commands.",
        timestamp: new Date(Date.now() - 60000 * 10),
        isRead: true,
        reactions: [],
        inlineKeyboard: [
          [
            { text: "✅ Get Started", callbackData: "start" },
            { text: "ℹ️ Learn More", callbackData: "learn" },
          ],
          [{ text: "📋 View Commands", callbackData: "commands" }],
        ],
      },
      {
        id: `msg-${chatId}-2`,
        chatId,
        senderId: 'user-1',
        text: "/help",
        timestamp: new Date(Date.now() - 60000 * 8),
        isRead: true,
        reactions: [],
      },
      {
        id: `msg-${chatId}-3`,
        chatId,
        senderId: 'bot-1',
        text: "📚 Help Center\n\nHere's what I can do for you:\n\n• 📊 Statistics - View your stats\n• ⚙️ Settings - Configure preferences\n• 💳 Wallet - Manage your balance\n• 👤 Profile - Edit your profile",
        timestamp: new Date(Date.now() - 60000 * 7),
        isRead: true,
        reactions: [],
        inlineKeyboard: [
          [
            { text: "📊 Statistics", callbackData: "stats" },
            { text: "⚙️ Settings", callbackData: "settings" },
          ],
          [
            { text: "💳 Wallet", callbackData: "wallet" },
            { text: "👤 Profile", callbackData: "profile" },
          ],
          [{ text: "📞 Contact Support", callbackData: "support" }],
        ],
      },
      {
        id: `msg-${chatId}-4`,
        chatId,
        senderId: 'bot-1',
        text: "📊 Your Statistics\n\n📈 Messages: 142\n👥 Interactions: 89\n⭐ Rating: 4.8/5\n🏆 Rank: #234\n💎 Status: Premium",
        timestamp: new Date(Date.now() - 60000 * 5),
        isRead: false,
        reactions: [{ emoji: '👍', userId: 'user-1' }],
        inlineKeyboard: [
          [
            { text: "📅 Daily", callbackData: "daily" },
            { text: "📆 Weekly", callbackData: "weekly" },
            { text: "📊 Monthly", callbackData: "monthly" },
          ],
          [{ text: "🔄 Refresh", callbackData: "refresh" }],
        ],
      },
    ];
  } else if (botId === 'bot-2') {
    return [
      {
        id: `msg-${chatId}-1`,
        chatId,
        senderId: 'bot-2',
        text: "🛒 Welcome to Shop Bot!\n\nBrowse our products and get the best deals. What would you like to explore?",
        timestamp: new Date(Date.now() - 60000 * 30),
        isRead: true,
        reactions: [],
        inlineKeyboard: [
          [
            { text: "👕 Clothing", callbackData: "clothing" },
            { text: "📱 Electronics", callbackData: "electronics" },
          ],
          [
            { text: "🏠 Home & Living", callbackData: "home" },
            { text: "🎮 Gaming", callbackData: "gaming" },
          ],
          [{ text: "🔥 Hot Deals", callbackData: "deals" }],
        ],
      },
      {
        id: `msg-${chatId}-2`,
        chatId,
        senderId: 'user-1',
        text: "Show me electronics",
        timestamp: new Date(Date.now() - 60000 * 25),
        isRead: true,
        reactions: [],
      },
      {
        id: `msg-${chatId}-3`,
        chatId,
        senderId: 'bot-2',
        text: "📱 Electronics\n\n1. iPhone 15 Pro - $999\n2. MacBook Air M3 - $1,299\n3. AirPods Pro 2 - $249\n4. iPad Pro - $899\n\nSelect a product for details:",
        timestamp: new Date(Date.now() - 60000 * 24),
        isRead: true,
        reactions: [],
        inlineKeyboard: [
          [
            { text: "📱 iPhone 15 Pro", callbackData: "iphone" },
            { text: "💻 MacBook Air", callbackData: "macbook" },
          ],
          [
            { text: "🎧 AirPods Pro", callbackData: "airpods" },
            { text: "📲 iPad Pro", callbackData: "ipad" },
          ],
          [
            { text: "🛒 View Cart (2)", callbackData: "cart" },
            { text: "🔙 Back", callbackData: "back" },
          ],
        ],
      },
    ];
  } else {
    return [
      {
        id: `msg-${chatId}-1`,
        chatId,
        senderId: 'bot-3',
        text: "📰 Welcome to News Bot!\n\nStay updated with the latest news from around the world. Select a category:",
        timestamp: new Date(Date.now() - 60000 * 60),
        isRead: true,
        reactions: [],
        inlineKeyboard: [
          [
            { text: "🌍 World", callbackData: "world" },
            { text: "💼 Business", callbackData: "business" },
          ],
          [
            { text: "💻 Technology", callbackData: "tech" },
            { text: "⚽ Sports", callbackData: "sports" },
          ],
          [{ text: "🔔 Subscribe", callbackData: "subscribe" }],
        ],
      },
      {
        id: `msg-${chatId}-2`,
        chatId,
        senderId: 'bot-3',
        text: "🔥 Breaking News\n\n📌 Tech Giants Report Record Q4 Earnings\n📌 Global Climate Summit Reaches Agreement\n📌 New AI Breakthrough in Healthcare",
        timestamp: new Date(Date.now() - 60000 * 30),
        isRead: false,
        reactions: [],
        inlineKeyboard: [
          [{ text: "📖 Read More", callbackData: "read" }],
          [{ text: "📤 Share", callbackData: "share" }, { text: "🔖 Save", callbackData: "save" }],
        ],
      },
      {
        id: `msg-${chatId}-3`,
        chatId,
        senderId: 'bot-3',
        text: "💻 Technology News\n\n1. Apple announces new Vision Pro features\n2. Google's Gemini 2.0 released\n3. Tesla unveils new Robotaxi design",
        timestamp: new Date(Date.now() - 60000 * 15),
        isRead: false,
        reactions: [],
        inlineKeyboard: [
          [
            { text: "1️⃣ Apple", callbackData: "apple" },
            { text: "2️⃣ Google", callbackData: "google" },
            { text: "3️⃣ Tesla", callbackData: "tesla" },
          ],
          [{ text: "🔄 Refresh", callbackData: "refresh" }],
        ],
      },
    ];
  }
};

// Add last messages to chats
mockChats.forEach((chat) => {
  if (chat.isBot) {
    const botId = chat.participants.find(p => p.startsWith('bot-')) || 'bot-1';
    const messages = createBotMessages(chat.id, botId);
    chat.lastMessage = messages[messages.length - 1];
  } else {
    const messages = createMessages(chat.id);
    chat.lastMessage = messages[messages.length - 1];
  }
});

// Storage for messages
const messagesStore: Record<string, Message[]> = {};
mockChats.forEach((chat) => {
  if (chat.isBot) {
    const botId = chat.participants.find(p => p.startsWith('bot-')) || 'bot-1';
    messagesStore[chat.id] = createBotMessages(chat.id, botId);
  } else {
    messagesStore[chat.id] = createMessages(chat.id, chat.participants);
  }
});

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock API Service
export const chatApi = {
  async getChats(): Promise<Chat[]> {
    await delay(300);
    return [...mockChats];
  },

  async getChat(chatId: string): Promise<Chat | undefined> {
    await delay(200);
    return mockChats.find((c) => c.id === chatId);
  },

  async getMessages(chatId: string): Promise<Message[]> {
    await delay(400);
    return messagesStore[chatId] || [];
  },

  async sendMessage(chatId: string, text: string, attachments?: Attachment[], replyTo?: Message['replyTo']): Promise<Message> {
    await delay(200);
    const newMessage: Message = {
      id: `msg-${chatId}-${Date.now()}`,
      chatId,
      senderId: 'user-1',
      text,
      timestamp: new Date(),
      isRead: false,
      reactions: [],
      attachments,
      replyTo,
      deliveryStatus: 'sent', // Initially sent, will update to delivered/read
    };
    
    if (!messagesStore[chatId]) {
      messagesStore[chatId] = [];
    }
    messagesStore[chatId].push(newMessage);
    
    // Update last message in chat
    const chat = mockChats.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessage = newMessage;
    }
    
    return newMessage;
  },

  async addReaction(messageId: string, chatId: string, emoji: string): Promise<void> {
    await delay(100);
    const messages = messagesStore[chatId];
    if (messages) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        const existingReaction = message.reactions.find(
          (r) => r.userId === 'user-1' && r.emoji === emoji
        );
        if (existingReaction) {
          message.reactions = message.reactions.filter(
            (r) => !(r.userId === 'user-1' && r.emoji === emoji)
          );
        } else {
          message.reactions.push({ emoji, userId: 'user-1' });
        }
      }
    }
  },

  async markAsRead(chatId: string): Promise<void> {
    await delay(100);
    const chat = mockChats.find((c) => c.id === chatId);
    if (chat) {
      chat.unreadCount = 0;
    }
    const messages = messagesStore[chatId];
    if (messages) {
      messages.forEach((m) => (m.isRead = true));
    }
  },

  async searchChats(query: string): Promise<Chat[]> {
    await delay(200);
    const lowerQuery = query.toLowerCase();
    return mockChats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(lowerQuery) ||
        chat.lastMessage?.text.toLowerCase().includes(lowerQuery)
    );
  },

  async getUsers(): Promise<User[]> {
    await delay(200);
    return [...mockUsers];
  },

  async getUser(userId: string): Promise<User | undefined> {
    await delay(100);
    return mockUsers.find((u) => u.id === userId);
  },

  async createGroupChat(name: string, participantIds: string[]): Promise<Chat> {
    await delay(300);
    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      type: 'group',
      name,
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${name}`,
      participants: ['user-1', ...participantIds],
      unreadCount: 0,
    };
    mockChats.unshift(newChat);
    messagesStore[newChat.id] = [];
    return newChat;
  },

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    await delay(100);
    const messages = messagesStore[chatId];
    if (messages) {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index !== -1) {
        messages.splice(index, 1);
        // Update last message if needed
        const chat = mockChats.find((c) => c.id === chatId);
        if (chat) {
          chat.lastMessage = messages[messages.length - 1];
        }
      }
    }
  },

  async editMessage(chatId: string, messageId: string, newText: string): Promise<Message | undefined> {
    await delay(100);
    const messages = messagesStore[chatId];
    if (messages) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        message.text = newText;
        message.isEdited = true;
        // Update last message if needed
        const chat = mockChats.find((c) => c.id === chatId);
        if (chat && chat.lastMessage?.id === messageId) {
          chat.lastMessage = message;
        }
        return message;
      }
    }
    return undefined;
  },

  async pinMessage(chatId: string, messageId: string): Promise<Message | undefined> {
    await delay(100);
    const messages = messagesStore[chatId];
    if (messages) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        message.isPinned = true;
        return message;
      }
    }
    return undefined;
  },

  async unpinMessage(chatId: string, messageId: string): Promise<void> {
    await delay(100);
    const messages = messagesStore[chatId];
    if (messages) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        message.isPinned = false;
      }
    }
  },
};
