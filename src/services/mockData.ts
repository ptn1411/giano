// Types
export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: Date;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  url: string;
  mimeType: string;
  progress?: number; // 0-100 for upload progress
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  isRead: boolean;
  reactions: { emoji: string; userId: string }[];
  attachments?: Attachment[];
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  name: string;
  avatar: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  isTyping?: boolean;
  typingUser?: string;
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
];

// Mock Messages
const createMessages = (chatId: string): Message[] => {
  const messageTemplates = [
    { text: "Hey! How's it going?", senderId: 'user-2' },
    { text: "I'm doing great, thanks for asking! Working on some new projects.", senderId: 'user-1' },
    { text: "That sounds exciting! What kind of projects?", senderId: 'user-2' },
    { text: "Building a chat application with React and TypeScript 🚀", senderId: 'user-1' },
    { text: "Nice! That's really cool. Let me know if you need any help.", senderId: 'user-2' },
    { text: "Will do! Thanks 😊", senderId: 'user-1' },
  ];

  return messageTemplates.map((msg, index) => ({
    id: `msg-${chatId}-${index}`,
    chatId,
    senderId: msg.senderId,
    text: msg.text,
    timestamp: new Date(Date.now() - (messageTemplates.length - index) * 300000),
    isRead: index < messageTemplates.length - 1,
    reactions: index === 3 ? [{ emoji: '🔥', userId: 'user-2' }] : [],
  }));
};

// Mock Chats
export const mockChats: Chat[] = [
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

// Add last messages to chats
mockChats.forEach((chat) => {
  const messages = createMessages(chat.id);
  chat.lastMessage = messages[messages.length - 1];
});

// Storage for messages
const messagesStore: Record<string, Message[]> = {};
mockChats.forEach((chat) => {
  messagesStore[chat.id] = createMessages(chat.id);
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

  async sendMessage(chatId: string, text: string, attachments?: Attachment[]): Promise<Message> {
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
};
