import { create } from 'zustand';
import { Message, Attachment, chatApi } from '@/services/mockData';

interface MessagesState {
  // State
  messages: Record<string, Message[]>; // chatId -> messages
  loading: boolean;
  currentChatId: string | null;
  
  // Computed
  currentMessages: Message[];
  
  // Actions
  setCurrentChatId: (chatId: string | null) => void;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) => Promise<Message | undefined>;
  addMessage: (message: Message) => void;
  addReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  editMessage: (chatId: string, messageId: string, newText: string) => Promise<void>;
  pinMessage: (chatId: string, messageId: string) => Promise<void>;
  unpinMessage: (chatId: string, messageId: string) => Promise<void>;
  clearMessages: (chatId: string) => void;
}

export const useMessagesStore = create<MessagesState>()((set, get) => ({
  messages: {},
  loading: false,
  currentChatId: null,

  get currentMessages() {
    const { currentChatId, messages } = get();
    return currentChatId ? messages[currentChatId] || [] : [];
  },

  setCurrentChatId: (chatId) => {
    set({ currentChatId: chatId });
    if (chatId) {
      get().fetchMessages(chatId);
    }
  },

  fetchMessages: async (chatId) => {
    set({ loading: true });
    try {
      const data = await chatApi.getMessages(chatId);
      await chatApi.markAsRead(chatId);
      set((state) => ({
        messages: { ...state.messages, [chatId]: data },
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  sendMessage: async (chatId, text, attachments, replyTo) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;
    
    const newMessage = await chatApi.sendMessage(chatId, text, attachments, replyTo);
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), newMessage],
      },
    }));
    return newMessage;
  },

  addMessage: (message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [message.chatId]: [...(state.messages[message.chatId] || []), message],
      },
    }));
  },

  addReaction: async (chatId, messageId, emoji) => {
    await chatApi.addReaction(messageId, chatId, emoji);
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((msg) => {
          if (msg.id === messageId) {
            const existingReaction = msg.reactions.find(
              (r) => r.userId === 'user-1' && r.emoji === emoji
            );
            if (existingReaction) {
              return {
                ...msg,
                reactions: msg.reactions.filter(
                  (r) => !(r.userId === 'user-1' && r.emoji === emoji)
                ),
              };
            } else {
              return {
                ...msg,
                reactions: [...msg.reactions, { emoji, userId: 'user-1' }],
              };
            }
          }
          return msg;
        }),
      },
    }));
  },

  deleteMessage: async (chatId, messageId) => {
    await chatApi.deleteMessage(chatId, messageId);
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).filter((msg) => msg.id !== messageId),
      },
    }));
  },

  editMessage: async (chatId, messageId, newText) => {
    const updated = await chatApi.editMessage(chatId, messageId, newText);
    if (updated) {
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map((msg) =>
            msg.id === messageId ? { ...msg, text: newText, isEdited: true } : msg
          ),
        },
      }));
    }
  },

  pinMessage: async (chatId, messageId) => {
    const updated = await chatApi.pinMessage(chatId, messageId);
    if (updated) {
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map((msg) =>
            msg.id === messageId ? { ...msg, isPinned: true } : msg
          ),
        },
      }));
    }
  },

  unpinMessage: async (chatId, messageId) => {
    await chatApi.unpinMessage(chatId, messageId);
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((msg) =>
          msg.id === messageId ? { ...msg, isPinned: false } : msg
        ),
      },
    }));
  },

  clearMessages: (chatId) => {
    set((state) => {
      const { [chatId]: _, ...rest } = state.messages;
      return { messages: rest };
    });
  },
}));

// Selector hooks for better performance
export const useMessages = (chatId: string | null) => {
  const messages = useMessagesStore((state) => 
    chatId ? state.messages[chatId] || [] : []
  );
  const loading = useMessagesStore((state) => state.loading);
  const fetchMessages = useMessagesStore((state) => state.fetchMessages);
  const sendMessage = useMessagesStore((state) => state.sendMessage);
  const addMessage = useMessagesStore((state) => state.addMessage);
  const addReaction = useMessagesStore((state) => state.addReaction);
  const deleteMessage = useMessagesStore((state) => state.deleteMessage);
  const editMessage = useMessagesStore((state) => state.editMessage);
  const pinMessage = useMessagesStore((state) => state.pinMessage);
  const unpinMessage = useMessagesStore((state) => state.unpinMessage);

  return {
    messages,
    loading,
    sendMessage: (text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) =>
      chatId ? sendMessage(chatId, text, attachments, replyTo) : Promise.resolve(undefined),
    addMessage,
    addReaction: (messageId: string, emoji: string) =>
      chatId ? addReaction(chatId, messageId, emoji) : Promise.resolve(),
    deleteMessage: (messageId: string) =>
      chatId ? deleteMessage(chatId, messageId) : Promise.resolve(),
    editMessage: (messageId: string, newText: string) =>
      chatId ? editMessage(chatId, messageId, newText) : Promise.resolve(),
    pinMessage: (messageId: string) =>
      chatId ? pinMessage(chatId, messageId) : Promise.resolve(),
    unpinMessage: (messageId: string) =>
      chatId ? unpinMessage(chatId, messageId) : Promise.resolve(),
    refetch: () => chatId ? fetchMessages(chatId) : Promise.resolve(),
  };
};
