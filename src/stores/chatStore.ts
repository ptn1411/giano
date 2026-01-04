import { create } from 'zustand';
import { Chat, Message } from '@/services/api/types';

interface ChatState {
  // UI State
  sidebarOpen: boolean;
  activeChatId: string | null;
  activeChat: Chat | null;
  
  // Modals
  showNewGroupModal: boolean;
  showSearchUserModal: boolean;
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
  setShowSearchUserModal: (show: boolean) => void;
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
  showSearchUserModal: false,
  forwardingMessage: null,
  editingMessage: null,
  deletingMessage: null,
  replyingTo: null,
};

export const useChatStoreBase = create<ChatState>()((set) => ({
  ...initialState,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),
  setActiveChat: (chat) => set({ activeChat: chat }),

  setShowNewGroupModal: (show) => set({ showNewGroupModal: show }),
  setShowSearchUserModal: (show) => set({ showSearchUserModal: show }),
  setForwardingMessage: (message) => set({ forwardingMessage: message }),
  setEditingMessage: (message) => set({ editingMessage: message }),
  setDeletingMessage: (message) => set({ deletingMessage: message }),
  setReplyingTo: (message) => set({ replyingTo: message }),

  reset: () => set(initialState),
}));

// Stable selectors
const selectSidebarOpen = (state: ChatState) => state.sidebarOpen;
const selectActiveChatId = (state: ChatState) => state.activeChatId;
const selectActiveChat = (state: ChatState) => state.activeChat;
const selectShowNewGroupModal = (state: ChatState) => state.showNewGroupModal;
const selectShowSearchUserModal = (state: ChatState) => state.showSearchUserModal;
const selectReplyingTo = (state: ChatState) => state.replyingTo;
const selectForwardingMessage = (state: ChatState) => state.forwardingMessage;
const selectEditingMessage = (state: ChatState) => state.editingMessage;
const selectDeletingMessage = (state: ChatState) => state.deletingMessage;
const selectSetSidebarOpen = (state: ChatState) => state.setSidebarOpen;
const selectToggleSidebar = (state: ChatState) => state.toggleSidebar;
const selectSetActiveChatId = (state: ChatState) => state.setActiveChatId;
const selectSetActiveChat = (state: ChatState) => state.setActiveChat;
const selectSetShowNewGroupModal = (state: ChatState) => state.setShowNewGroupModal;
const selectSetShowSearchUserModal = (state: ChatState) => state.setShowSearchUserModal;
const selectSetReplyingTo = (state: ChatState) => state.setReplyingTo;
const selectSetForwardingMessage = (state: ChatState) => state.setForwardingMessage;
const selectSetEditingMessage = (state: ChatState) => state.setEditingMessage;
const selectSetDeletingMessage = (state: ChatState) => state.setDeletingMessage;

// Hook with stable selectors to prevent infinite loops
export function useChatStore() {
  const sidebarOpen = useChatStoreBase(selectSidebarOpen);
  const activeChatId = useChatStoreBase(selectActiveChatId);
  const activeChat = useChatStoreBase(selectActiveChat);
  const showNewGroupModal = useChatStoreBase(selectShowNewGroupModal);
  const showSearchUserModal = useChatStoreBase(selectShowSearchUserModal);
  const replyingTo = useChatStoreBase(selectReplyingTo);
  const forwardingMessage = useChatStoreBase(selectForwardingMessage);
  const editingMessage = useChatStoreBase(selectEditingMessage);
  const deletingMessage = useChatStoreBase(selectDeletingMessage);
  const setSidebarOpen = useChatStoreBase(selectSetSidebarOpen);
  const toggleSidebar = useChatStoreBase(selectToggleSidebar);
  const setActiveChatId = useChatStoreBase(selectSetActiveChatId);
  const setActiveChat = useChatStoreBase(selectSetActiveChat);
  const setShowNewGroupModal = useChatStoreBase(selectSetShowNewGroupModal);
  const setShowSearchUserModal = useChatStoreBase(selectSetShowSearchUserModal);
  const setReplyingTo = useChatStoreBase(selectSetReplyingTo);
  const setForwardingMessage = useChatStoreBase(selectSetForwardingMessage);
  const setEditingMessage = useChatStoreBase(selectSetEditingMessage);
  const setDeletingMessage = useChatStoreBase(selectSetDeletingMessage);

  return {
    sidebarOpen,
    activeChatId,
    activeChat,
    showNewGroupModal,
    showSearchUserModal,
    replyingTo,
    forwardingMessage,
    editingMessage,
    deletingMessage,
    setSidebarOpen,
    toggleSidebar,
    setActiveChatId,
    setActiveChat,
    setShowNewGroupModal,
    setShowSearchUserModal,
    setReplyingTo,
    setForwardingMessage,
    setEditingMessage,
    setDeletingMessage,
    reset: useChatStoreBase.getState().reset,
  };
}
