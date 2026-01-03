import { create } from 'zustand';
import { Chat, chatApi } from '@/services/mockData';

interface ChatsState {
  chats: Chat[];
  loading: boolean;
  
  // Actions
  fetchChats: () => Promise<void>;
  searchChats: (query: string) => Promise<void>;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  deleteChat: (chatId: string) => void;
}

export const useChatsStore = create<ChatsState>()((set, get) => ({
  chats: [],
  loading: true,
  
  fetchChats: async () => {
    set({ loading: true });
    try {
      const data = await chatApi.getChats();
      set({ chats: data });
    } finally {
      set({ loading: false });
    }
  },
  
  searchChats: async (query: string) => {
    if (!query.trim()) {
      get().fetchChats();
      return;
    }
    set({ loading: true });
    try {
      const data = await chatApi.searchChats(query);
      set({ chats: data });
    } finally {
      set({ loading: false });
    }
  },
  
  addChat: (chat: Chat) => {
    set((state) => ({
      chats: [chat, ...state.chats],
    }));
  },
  
  updateChat: (chatId: string, updates: Partial<Chat>) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, ...updates } : chat
      ),
    }));
  },
  
  deleteChat: (chatId: string) => {
    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== chatId),
    }));
  },
}));

// Stable selectors to avoid infinite loops
const selectChats = (state: ChatsState) => state.chats;
const selectLoading = (state: ChatsState) => state.loading;
const selectFetchChats = (state: ChatsState) => state.fetchChats;
const selectSearchChats = (state: ChatsState) => state.searchChats;

// Selector hook for backward compatibility
export function useChats() {
  const chats = useChatsStore(selectChats);
  const loading = useChatsStore(selectLoading);
  const refetch = useChatsStore(selectFetchChats);
  const searchChats = useChatsStore(selectSearchChats);
  
  return { chats, loading, refetch, searchChats };
}
