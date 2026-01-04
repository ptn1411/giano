/**
 * Chats Store
 * Zustand store for managing chat data with real API integration
 * Requirements: 4.1-4.6
 */

import { create } from 'zustand';
import { chatsService } from '@/services/api';
import { Chat } from '@/services/api/types';

interface ChatsState {
  chats: Chat[];
  /**
   * `loading` is used for the initial chat list skeleton only.
   * Subsequent refreshes should not blank the list.
   */
  loading: boolean;
  hasLoaded: boolean;
  error: string | null;

  // Actions
  fetchChats: () => Promise<void>;
  searchChats: (query: string) => Promise<void>;
  getChat: (chatId: string) => Promise<Chat | null>;
  createGroup: (name: string, participantIds: string[]) => Promise<Chat | null>;
  markAsRead: (chatId: string) => Promise<void>;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  deleteChat: (chatId: string) => void;
  deleteChatAsync: (chatId: string) => Promise<boolean>;
  setTyping: (chatId: string, isTyping: boolean, typingUser?: string) => void;
  clearError: () => void;
}

export const useChatsStore = create<ChatsState>()((set, get) => ({
  chats: [],
  loading: true,
  hasLoaded: false,
  error: null,

  /**
   * Fetch all chats from API
   * Requirement 4.1: Fetch chats from GET /chats
   */
  fetchChats: async () => {
    const isInitialLoad = !get().hasLoaded;

    // Only show skeleton on first load; keep current list during refresh
    if (isInitialLoad) {
      set({ loading: true, error: null });
    }

    const result = await chatsService.getChats();
    
    if (result.error) {
      set({ 
        loading: false, 
        hasLoaded: true,
        error: result.error 
      });
      return;
    }

    set({ 
      chats: result.chats, 
      loading: false, 
      hasLoaded: true,
      error: null 
    });
  },

  /**
   * Search chats by query
   * Requirement 4.2: Search chats with GET /chats?search=query
   */
  searchChats: async (query: string) => {
    if (!query.trim()) {
      get().fetchChats();
      return;
    }

    set({ loading: true, error: null });
    
    const result = await chatsService.getChats(query);
    
    if (result.error) {
      set({ 
        loading: false, 
        hasLoaded: true,
        error: result.error 
      });
      return;
    }

    set({ 
      chats: result.chats, 
      loading: false, 
      hasLoaded: true,
      error: null 
    });
  },

  /**
   * Get a single chat by ID
   * Requirement 4.4: Fetch chat details from GET /chats/:chatId
   */
  getChat: async (chatId: string) => {
    const result = await chatsService.getChat(chatId);
    
    if (result.error || !result.chat) {
      set({ error: result.error });
      return null;
    }

    // Update the chat in the store if it exists
    const { chats } = get();
    const existingIndex = chats.findIndex(c => c.id === chatId);
    
    if (existingIndex >= 0) {
      const updatedChats = [...chats];
      updatedChats[existingIndex] = result.chat;
      set({ chats: updatedChats });
    }

    return result.chat;
  },

  /**
   * Create a new group chat
   * Requirement 4.3: Create group chat with POST /chats/group
   */
  createGroup: async (name: string, participantIds: string[]) => {
    const result = await chatsService.createGroup(name, participantIds);
    
    if (result.error || !result.chat) {
      set({ error: result.error });
      return null;
    }

    // Add the new chat to the beginning of the list
    set((state) => ({
      chats: [result.chat!, ...state.chats],
      error: null,
    }));

    return result.chat;
  },

  /**
   * Mark a chat as read
   * Requirement 4.5: Mark chat as read with POST /chats/:chatId/read
   */
  markAsRead: async (chatId: string) => {
    const result = await chatsService.markAsRead(chatId);
    
    if (result.error) {
      set({ error: result.error });
      return;
    }

    // Update the chat's unread count locally
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      ),
      error: null,
    }));
  },

  /**
   * Add a new chat to the store (used by WebSocket events)
   * Requirement 4.6: Update chat data from WebSocket events
   */
  addChat: (chat: Chat) => {
    set((state) => ({
      chats: [chat, ...state.chats],
    }));
  },

  /**
   * Update an existing chat in the store
   * Requirement 4.6: Update chat data from WebSocket events
   */
  updateChat: (chatId: string, updates: Partial<Chat>) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, ...updates } : chat
      ),
    }));
  },

  /**
   * Delete a chat from the store (local only)
   */
  deleteChat: (chatId: string) => {
    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== chatId),
    }));
  },

  /**
   * Delete a chat via API and remove from store
   */
  deleteChatAsync: async (chatId: string) => {
    const { chats } = get();
    const chatToDelete = chats.find(c => c.id === chatId);
    
    // Optimistic update
    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== chatId),
    }));

    const result = await chatsService.deleteChat(chatId);
    
    if (!result.success) {
      // Rollback on error
      if (chatToDelete) {
        set((state) => ({
          chats: [chatToDelete, ...state.chats],
          error: result.error,
        }));
      }
      return false;
    }

    return true;
  },

  /**
   * Set typing indicator for a chat
   * Requirement 4.6: Update typing indicators from WebSocket events
   */
  setTyping: (chatId: string, isTyping: boolean, typingUser?: string) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId 
          ? { ...chat, isTyping, typingUser: isTyping ? typingUser : undefined } 
          : chat
      ),
    }));
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },
}));

// ============================================
// Selectors
// ============================================

const selectChats = (state: ChatsState) => state.chats;
const selectLoading = (state: ChatsState) => state.loading;
const selectError = (state: ChatsState) => state.error;
const selectFetchChats = (state: ChatsState) => state.fetchChats;
const selectSearchChats = (state: ChatsState) => state.searchChats;

/**
 * Selector hook for backward compatibility
 */
export function useChats() {
  const chats = useChatsStore(selectChats);
  const loading = useChatsStore(selectLoading);
  const error = useChatsStore(selectError);
  const refetch = useChatsStore(selectFetchChats);
  const searchChats = useChatsStore(selectSearchChats);
  
  return { chats, loading, error, refetch, searchChats };
}

/**
 * Get a chat by ID from the store
 */
export function useChatById(chatId: string): Chat | undefined {
  return useChatsStore((state) => state.chats.find((c) => c.id === chatId));
}
