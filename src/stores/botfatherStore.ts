/**
 * BotFather Store
 * Manages BotFather chat messages with persistence to backend
 */

import { create } from 'zustand';
import { Message } from '@/services/api/types';
import { botfatherService, BotFatherMessageDto } from '@/services/api/botfather';
import { BOTFATHER_ID, BOTFATHER_CHAT_ID, BOTFATHER_WELCOME } from '@/lib/botfather';
import { useAuthStore } from './authStore';

interface BotFatherState {
  messages: Message[];
  loading: boolean;
  loadingHistory: boolean;
  initialized: boolean;
  error: string | null;

  // Actions
  loadMessages: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
}

// Convert API message to local Message format
const toMessage = (dto: BotFatherMessageDto): Message => ({
  id: dto.id,
  chatId: BOTFATHER_CHAT_ID,
  senderId: dto.senderId,
  text: dto.text,
  timestamp: dto.createdAt,
  isRead: true,
  reactions: [],
  deliveryStatus: 'read',
});

export const useBotFatherStore = create<BotFatherState>()((set, get) => ({
  messages: [BOTFATHER_WELCOME],
  loading: false,
  loadingHistory: false,
  initialized: false,
  error: null,

  loadMessages: async () => {
    const { initialized, loadingHistory } = get();
    if (initialized || loadingHistory) return;

    set({ loadingHistory: true });

    const apiMessages = await botfatherService.getMessages(100);
    
    if (apiMessages.length > 0) {
      const messages = apiMessages.map(toMessage);
      set({ messages, initialized: true, loadingHistory: false });
    } else {
      // No history, show welcome message
      set({ messages: [BOTFATHER_WELCOME], initialized: true, loadingHistory: false });
    }
  },

  sendMessage: async (text: string) => {
    const { messages } = get();
    const currentUserId = useAuthStore.getState().session?.user?.id || 'current-user';

    // Optimistic: add user message immediately with temp ID
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      chatId: BOTFATHER_CHAT_ID,
      senderId: currentUserId,
      text,
      timestamp: new Date().toISOString(),
      isRead: true,
      reactions: [],
      deliveryStatus: 'sending',
    };

    set({ messages: [...messages, tempUserMsg], loading: true, error: null });

    // Send to API
    const result = await botfatherService.sendMessage(text);

    set((state) => {
      // Remove temp message
      const filteredMessages = state.messages.filter((m) => m.id !== tempUserMsg.id);

      // Add real messages from API
      const newMessages = [...filteredMessages];
      if (result.userMessage) {
        newMessages.push(toMessage(result.userMessage));
      }
      if (result.botMessage) {
        newMessages.push(toMessage(result.botMessage));
      }

      return {
        messages: newMessages,
        loading: false,
        error: result.success ? null : result.error,
      };
    });
  },

  clearMessages: () => {
    set({ messages: [BOTFATHER_WELCOME], error: null, initialized: false });
  },
}));

// Selectors
export const useBotFatherMessages = () => useBotFatherStore((state) => state.messages);
export const useBotFatherLoading = () => useBotFatherStore((state) => state.loading);
