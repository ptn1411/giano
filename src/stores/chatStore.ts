import { create } from 'zustand';
import { Chat, Message } from '@/services/mockData';

interface ChatState {
  // UI State
  sidebarOpen: boolean;
  activeChatId: string | null;
  activeChat: Chat | null;
  
  // Modals
  showNewGroupModal: boolean;
  forwardingMessage: Message | null;
  editingMessage: Message | null;
  deletingMessage: Message | null;
  replyingTo: Message | null;
  
  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setActiveChatId: (chatId: string | null) => void;
  setActiveChat: (chat: Chat | null) => void;
  
  // Modal actions
  setShowNewGroupModal: (show: boolean) => void;
  setForwardingMessage: (message: Message | null) => void;
  setEditingMessage: (message: Message | null) => void;
  setDeletingMessage: (message: Message | null) => void;
  setReplyingTo: (message: Message | null) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  sidebarOpen: true,
  activeChatId: null,
  activeChat: null,
  showNewGroupModal: false,
  forwardingMessage: null,
  editingMessage: null,
  deletingMessage: null,
  replyingTo: null,
};

export const useChatStore = create<ChatState>()((set) => ({
  ...initialState,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),
  setActiveChat: (chat) => set({ activeChat: chat }),

  setShowNewGroupModal: (show) => set({ showNewGroupModal: show }),
  setForwardingMessage: (message) => set({ forwardingMessage: message }),
  setEditingMessage: (message) => set({ editingMessage: message }),
  setDeletingMessage: (message) => set({ deletingMessage: message }),
  setReplyingTo: (message) => set({ replyingTo: message }),

  reset: () => set(initialState),
}));
