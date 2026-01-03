import { useMemo } from 'react';
import { create } from 'zustand';
import { Message, Attachment, chatApi, DeliveryStatus } from '@/services/mockData';

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
  retryMessage: (chatId: string, messageId: string) => Promise<void>;
  updateMessageStatus: (chatId: string, messageId: string, status: DeliveryStatus) => void;
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
    
    // Create optimistic message with 'sending' status
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      chatId,
      senderId: 'user-1',
      text,
      timestamp: new Date(),
      isRead: false,
      reactions: [],
      attachments,
      replyTo,
      deliveryStatus: 'sending',
    };
    
    // Add optimistic message immediately
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), optimisticMessage],
      },
    }));
    
    try {
      // Simulate network delay for demo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Randomly fail 10% of messages for demo purposes
      if (Math.random() < 0.1) {
        throw new Error('Network error');
      }
      
      const newMessage = await chatApi.sendMessage(chatId, text, attachments, replyTo);
      
      // Replace optimistic message with real message
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg => 
            msg.id === tempId ? { ...newMessage, deliveryStatus: 'sent' as DeliveryStatus } : msg
          ),
        },
      }));
      
      // Simulate delivery after a short delay
      setTimeout(() => {
        get().updateMessageStatus(chatId, newMessage.id, 'delivered');
      }, 1000);
      
      // Simulate read after another delay
      setTimeout(() => {
        get().updateMessageStatus(chatId, newMessage.id, 'read');
      }, 3000);
      
      return newMessage;
    } catch (error) {
      // Mark message as failed
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg => 
            msg.id === tempId ? { ...msg, deliveryStatus: 'failed' as DeliveryStatus } : msg
          ),
        },
      }));
      return undefined;
    }
  },

  retryMessage: async (chatId, messageId) => {
    const messages = get().messages[chatId] || [];
    const failedMessage = messages.find(m => m.id === messageId);
    
    if (!failedMessage || failedMessage.deliveryStatus !== 'failed') return;
    
    // Update to sending status
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map(msg => 
          msg.id === messageId ? { ...msg, deliveryStatus: 'sending' as DeliveryStatus } : msg
        ),
      },
    }));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Retry has higher success rate
      if (Math.random() < 0.05) {
        throw new Error('Network error');
      }
      
      const newMessage = await chatApi.sendMessage(chatId, failedMessage.text, failedMessage.attachments, failedMessage.replyTo);
      
      // Replace with new message
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg => 
            msg.id === messageId ? { ...newMessage, deliveryStatus: 'sent' as DeliveryStatus } : msg
          ),
        },
      }));
      
      setTimeout(() => {
        get().updateMessageStatus(chatId, newMessage.id, 'delivered');
      }, 1000);
      
      setTimeout(() => {
        get().updateMessageStatus(chatId, newMessage.id, 'read');
      }, 3000);
    } catch {
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg => 
            msg.id === messageId ? { ...msg, deliveryStatus: 'failed' as DeliveryStatus } : msg
          ),
        },
      }));
    }
  },

  updateMessageStatus: (chatId, messageId, status) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map(msg => 
          msg.id === messageId ? { ...msg, deliveryStatus: status } : msg
        ),
      },
    }));
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

// Empty array constant to avoid creating new references
const EMPTY_MESSAGES: Message[] = [];

// Stable selectors
const selectLoading = (state: MessagesState) => state.loading;
const selectAddMessage = (state: MessagesState) => state.addMessage;

// Selector hooks for better performance
export const useMessages = (chatId: string | null) => {
  const messages = useMessagesStore((state) => 
    chatId ? (state.messages[chatId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const loading = useMessagesStore(selectLoading);
  const addMessage = useMessagesStore(selectAddMessage);

  // Memoize actions to prevent infinite loops in useCallback dependencies
  const actions = useMemo(() => {
    const store = useMessagesStore.getState();
    return {
      sendMessage: (text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) =>
        chatId ? store.sendMessage(chatId, text, attachments, replyTo) : Promise.resolve(undefined),
      retryMessage: (messageId: string) =>
        chatId ? store.retryMessage(chatId, messageId) : Promise.resolve(),
      addReaction: (messageId: string, emoji: string) =>
        chatId ? store.addReaction(chatId, messageId, emoji) : Promise.resolve(),
      deleteMessage: (messageId: string) =>
        chatId ? store.deleteMessage(chatId, messageId) : Promise.resolve(),
      editMessage: (messageId: string, newText: string) =>
        chatId ? store.editMessage(chatId, messageId, newText) : Promise.resolve(),
      pinMessage: (messageId: string) =>
        chatId ? store.pinMessage(chatId, messageId) : Promise.resolve(),
      unpinMessage: (messageId: string) =>
        chatId ? store.unpinMessage(chatId, messageId) : Promise.resolve(),
      refetch: () => chatId ? store.fetchMessages(chatId) : Promise.resolve(),
    };
  }, [chatId]);

  return {
    messages,
    loading,
    addMessage,
    ...actions,
  };
};
