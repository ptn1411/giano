/**
 * BotFather Store
 * Manages BotFather chat messages locally (not persisted to backend)
 */

import { create } from 'zustand';
import { Message } from '@/services/api/types';
import { botfatherService } from '@/services/api';
import { BOTFATHER_ID, BOTFATHER_CHAT_ID, BOTFATHER_WELCOME } from '@/lib/botfather';
import { useAuthStore } from './authStore';

interface BotFatherState {
  messages: Message[];
  loading: boolean;
  error: string | null;

  // Actions
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
}

// Generate a unique message ID
const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useBotFatherStore = create<BotFatherState>()((set, get) => ({
  messages: [BOTFATHER_WELCOME],
  loading: false,
  error: null,

  sendMessage: async (text: string) => {
    const { messages } = get();
    
    // Get current user ID from auth store
    const currentUserId = useAuthStore.getState().session?.user?.id || 'current-user';

    // Create user message
    const userMessage: Message = {
      id: generateMessageId(),
      chatId: BOTFATHER_CHAT_ID,
      senderId: currentUserId,
      text,
      timestamp: new Date().toISOString(),
      isRead: true,
      reactions: [],
      deliveryStatus: 'sent',
    };

    // Add user message immediately
    set({ messages: [...messages, userMessage], loading: true, error: null });

    // Send to BotFather API
    const result = await botfatherService.sendMessage(text);

    // Create BotFather response message
    // Use response text if available, otherwise use error message
    const responseText = result.response || result.error || 'An error occurred.';
    
    const botResponse: Message = {
      id: generateMessageId(),
      chatId: BOTFATHER_CHAT_ID,
      senderId: BOTFATHER_ID,
      text: responseText,
      timestamp: new Date().toISOString(),
      isRead: true,
      reactions: [],
      deliveryStatus: 'read',
    };

    set((state) => ({
      messages: [...state.messages, botResponse],
      loading: false,
      error: result.success ? null : result.error,
    }));
  },

  clearMessages: () => {
    set({ messages: [BOTFATHER_WELCOME], error: null });
  },
}));

// Selectors
export const useBotFatherMessages = () => useBotFatherStore((state) => state.messages);
export const useBotFatherLoading = () => useBotFatherStore((state) => state.loading);
