/**
 * Messages Store
 * Manages message state using Zustand with real API integration
 * Requirements: 5.1-5.8
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { messagesService } from '@/services/api';
import { Message, Attachment, DeliveryStatus, ReplyTo } from '@/services/api/types';
import { useMessageQueueStore } from './messageQueueStore';
import { useAuthStore } from './authStore';

// ============================================
// Types
// ============================================

interface PaginationState {
  hasMore: boolean;
  isLoadingMore: boolean;
  oldestMessageId?: string;
}

interface MessagesState {
  // State
  messages: Record<string, Message[]>; // chatId -> messages
  pagination: Record<string, PaginationState>; // chatId -> pagination state
  loading: boolean;
  currentChatId: string | null;
  error: string | null;
  
  // Optimistic update tracking for rollback
  pendingMessages: Record<string, Message>; // tempId -> original optimistic message
  
  // Actions
  setCurrentChatId: (chatId: string | null) => void;
  fetchMessages: (chatId: string) => Promise<void>;
  loadMoreMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, text: string, attachments?: Attachment[], replyTo?: ReplyTo) => Promise<Message | undefined>;
  retryMessage: (chatId: string, messageId: string) => Promise<void>;
  updateMessageStatus: (chatId: string, messageId: string, status: DeliveryStatus) => void;
  addMessage: (message: Message) => void;
  addReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  editMessage: (chatId: string, messageId: string, newText: string) => Promise<void>;
  pinMessage: (chatId: string, messageId: string) => Promise<void>;
  unpinMessage: (chatId: string, messageId: string) => Promise<void>;
  clearMessages: (chatId: string) => void;
  clearChatMessages: (chatId: string) => Promise<boolean>;
  clearError: () => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a temporary ID for optimistic updates
 */
const generateTempId = (): string => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Get the current user ID from auth store
 */
const getCurrentUserId = (): string => {
  const session = useAuthStore.getState().session;
  return session?.user?.id || 'user-1';
};

// ============================================
// Messages Store
// ============================================

export const useMessagesStore = create<MessagesState>((set, get) => ({
  // Initial state
  messages: {},
  pagination: {},
  loading: false,
  currentChatId: null,
  error: null,
  pendingMessages: {},

  /**
   * Set the current active chat ID
   */
  setCurrentChatId: (chatId: string | null) => {
    set({ currentChatId: chatId });
  },

  /**
   * Fetch messages for a chat
   * Requirement 5.1: WHEN opening a chat THEN THE Message_Store SHALL fetch messages from GET /chats/:chatId/messages
   */
  fetchMessages: async (chatId: string) => {
    set({ loading: true, error: null });
    
    try {
      const result = await messagesService.getMessages(chatId);
      
      if (result.error) {
        set({ 
          loading: false, 
          error: result.error.message 
        });
        return;
      }

      // Sort messages by timestamp (oldest first for display)
      const sortedMessages = [...result.messages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Get the oldest message ID for pagination
      const oldestMessageId = sortedMessages.length > 0 ? sortedMessages[0].id : undefined;

      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: sortedMessages,
        },
        pagination: {
          ...state.pagination,
          [chatId]: {
            hasMore: result.hasMore,
            isLoadingMore: false,
            oldestMessageId,
          },
        },
        loading: false,
      }));
    } catch {
      set({ 
        loading: false, 
        error: 'Failed to fetch messages' 
      });
    }
  },

  /**
   * Load more messages (pagination)
   * Requirement 5.7: THE Message_Store SHALL support pagination with "before" parameter for loading older messages
   */
  loadMoreMessages: async (chatId: string) => {
    const state = get();
    const paginationState = state.pagination[chatId];
    
    // Don't load if already loading or no more messages
    if (!paginationState?.hasMore || paginationState.isLoadingMore) {
      return;
    }

    // Update loading state
    set((state) => ({
      pagination: {
        ...state.pagination,
        [chatId]: {
          ...state.pagination[chatId],
          isLoadingMore: true,
        },
      },
    }));

    try {
      const result = await messagesService.getMessages(
        chatId, 
        paginationState.oldestMessageId
      );

      if (result.error) {
        set((state) => ({
          pagination: {
            ...state.pagination,
            [chatId]: {
              ...state.pagination[chatId],
              isLoadingMore: false,
            },
          },
          error: result.error?.message || 'Failed to load more messages',
        }));
        return;
      }

      // Sort new messages by timestamp
      const sortedNewMessages = [...result.messages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Get the new oldest message ID
      const newOldestMessageId = sortedNewMessages.length > 0 
        ? sortedNewMessages[0].id 
        : paginationState.oldestMessageId;

      set((state) => {
        const existingMessages = state.messages[chatId] || [];
        // Prepend older messages to the beginning
        const combinedMessages = [...sortedNewMessages, ...existingMessages];
        
        // Remove duplicates based on message ID
        const uniqueMessages = combinedMessages.filter(
          (msg, index, self) => index === self.findIndex(m => m.id === msg.id)
        );

        return {
          messages: {
            ...state.messages,
            [chatId]: uniqueMessages,
          },
          pagination: {
            ...state.pagination,
            [chatId]: {
              hasMore: result.hasMore,
              isLoadingMore: false,
              oldestMessageId: newOldestMessageId,
            },
          },
        };
      });
    } catch {
      set((state) => ({
        pagination: {
          ...state.pagination,
          [chatId]: {
            ...state.pagination[chatId],
            isLoadingMore: false,
          },
        },
        error: 'Failed to load more messages',
      }));
    }
  },

  /**
   * Send a new message with optimistic update
   * Requirement 5.2: WHEN sending a message THEN THE Message_Store SHALL call POST /chats/:chatId/messages
   * Requirement 9.4: THE UI SHALL support optimistic updates for better perceived performance
   * Requirement 9.5: WHEN optimistic update fails THEN THE UI SHALL rollback and show error
   */
  sendMessage: async (chatId, text, attachments, replyTo) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;
    
    const queueStore = useMessageQueueStore.getState();
    const isOnline = queueStore.isOnline;
    const currentUserId = getCurrentUserId();
    
    // If offline, queue the message
    if (!isOnline) {
      const queuedId = queueStore.addToQueue({ chatId, text, attachments, replyTo });
      
      // Add queued message to UI with 'sending' status
      const queuedMessage: Message = {
        id: queuedId,
        chatId,
        senderId: currentUserId,
        text,
        timestamp: new Date().toISOString(),
        isRead: false,
        reactions: [],
        attachments,
        replyTo,
        deliveryStatus: 'sending',
      };
      
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: [...(state.messages[chatId] || []), queuedMessage],
        },
      }));
      
      return undefined;
    }
    
    // Create optimistic message with 'sending' status
    const tempId = generateTempId();
    const optimisticMessage: Message = {
      id: tempId,
      chatId,
      senderId: currentUserId,
      text,
      timestamp: new Date().toISOString(),
      isRead: false,
      reactions: [],
      attachments,
      replyTo,
      deliveryStatus: 'sending',
    };
    
    // Store the optimistic message for potential rollback
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), optimisticMessage],
      },
      pendingMessages: {
        ...state.pendingMessages,
        [tempId]: optimisticMessage,
      },
    }));
    
    try {
      // Call the real API
      const result = await messagesService.sendMessage(chatId, {
        text,
        attachments,
        replyTo,
      });
      
      if (result.error || !result.message) {
        // Rollback: Mark message as failed
        set((state) => {
          const { [tempId]: _, ...remainingPending } = state.pendingMessages;
          return {
            messages: {
              ...state.messages,
              [chatId]: (state.messages[chatId] || []).map(msg => 
                msg.id === tempId 
                  ? { ...msg, deliveryStatus: 'failed' as DeliveryStatus } 
                  : msg
              ),
            },
            pendingMessages: remainingPending,
            error: result.error?.message || 'Failed to send message',
          };
        });
        
        // Add to queue for retry
        queueStore.addToQueue({ chatId, text, attachments, replyTo });
        return undefined;
      }
      
      // Success: Replace optimistic message with real message
      set((state) => {
        const { [tempId]: _, ...remainingPending } = state.pendingMessages;
        return {
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg => 
              msg.id === tempId 
                ? { ...result.message!, deliveryStatus: 'sent' as DeliveryStatus } 
                : msg
            ),
          },
          pendingMessages: remainingPending,
        };
      });
      
      return result.message;
    } catch {
      // Rollback on error
      set((state) => {
        const { [tempId]: _, ...remainingPending } = state.pendingMessages;
        return {
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg => 
              msg.id === tempId 
                ? { ...msg, deliveryStatus: 'failed' as DeliveryStatus } 
                : msg
            ),
          },
          pendingMessages: remainingPending,
          error: 'Failed to send message',
        };
      });
      
      // Add to queue for retry
      queueStore.addToQueue({ chatId, text, attachments, replyTo });
      return undefined;
    }
  },

  /**
   * Retry sending a failed message
   */
  retryMessage: async (chatId, messageId) => {
    const messages = get().messages[chatId] || [];
    const failedMessage = messages.find(m => m.id === messageId);
    
    if (!failedMessage || failedMessage.deliveryStatus !== 'failed') return;
    
    // Update to sending status
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map(msg => 
          msg.id === messageId 
            ? { ...msg, deliveryStatus: 'sending' as DeliveryStatus } 
            : msg
        ),
      },
    }));
    
    try {
      const result = await messagesService.sendMessage(chatId, {
        text: failedMessage.text,
        attachments: failedMessage.attachments,
        replyTo: failedMessage.replyTo,
      });
      
      if (result.error || !result.message) {
        // Mark as failed again
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg => 
              msg.id === messageId 
                ? { ...msg, deliveryStatus: 'failed' as DeliveryStatus } 
                : msg
            ),
          },
        }));
        return;
      }
      
      // Replace with new message
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg => 
            msg.id === messageId 
              ? { ...result.message!, deliveryStatus: 'sent' as DeliveryStatus } 
              : msg
          ),
        },
      }));
    } catch {
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg => 
            msg.id === messageId 
              ? { ...msg, deliveryStatus: 'failed' as DeliveryStatus } 
              : msg
          ),
        },
      }));
    }
  },

  /**
   * Update message delivery status
   * Requirement 5.8: THE Message_Store SHALL receive new messages via WebSocket and update UI immediately
   */
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

  /**
   * Add a new message (used for WebSocket incoming messages)
   * Requirement 5.8: THE Message_Store SHALL receive new messages via WebSocket and update UI immediately
   */
  addMessage: (message) => {
    set((state) => {
      const existingMessages = state.messages[message.chatId] || [];
      // Check if message already exists (avoid duplicates)
      if (existingMessages.some(m => m.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [message.chatId]: [...existingMessages, message],
        },
      };
    });
  },

  /**
   * Add a reaction to a message with optimistic update
   * Requirement 5.5: WHEN adding a reaction THEN THE Message_Store SHALL call POST /chats/:chatId/messages/:messageId/reactions
   */
  addReaction: async (chatId, messageId, emoji) => {
    const currentUserId = getCurrentUserId();
    const messages = get().messages[chatId] || [];
    const message = messages.find(m => m.id === messageId);
    
    if (!message) return;
    
    // Check if user already has this reaction
    const existingReaction = message.reactions.find(
      r => r.userId === currentUserId && r.emoji === emoji
    );
    
    // Optimistic update
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map(msg => {
          if (msg.id === messageId) {
            if (existingReaction) {
              // Remove reaction
              return {
                ...msg,
                reactions: msg.reactions.filter(
                  r => !(r.userId === currentUserId && r.emoji === emoji)
                ),
              };
            } else {
              // Add reaction
              return {
                ...msg,
                reactions: [...msg.reactions, { emoji, userId: currentUserId, userName: '' }],
              };
            }
          }
          return msg;
        }),
      },
    }));
    
    try {
      const result = await messagesService.addReaction(chatId, messageId, emoji);
      
      if (result.error) {
        // Rollback on error
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg => {
              if (msg.id === messageId) {
                if (existingReaction) {
                  // Restore removed reaction
                  return {
                    ...msg,
                    reactions: [...msg.reactions, existingReaction],
                  };
                } else {
                  // Remove added reaction
                  return {
                    ...msg,
                    reactions: msg.reactions.filter(
                      r => !(r.userId === currentUserId && r.emoji === emoji)
                    ),
                  };
                }
              }
              return msg;
            }),
          },
          error: result.error.message,
        }));
      } else if (result.message) {
        // Update with server response
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg => 
              msg.id === messageId ? result.message! : msg
            ),
          },
        }));
      }
    } catch {
      // Rollback on error
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg => {
            if (msg.id === messageId) {
              if (existingReaction) {
                return {
                  ...msg,
                  reactions: [...msg.reactions, existingReaction],
                };
              } else {
                return {
                  ...msg,
                  reactions: msg.reactions.filter(
                    r => !(r.userId === currentUserId && r.emoji === emoji)
                  ),
                };
              }
            }
            return msg;
          }),
        },
        error: 'Failed to add reaction',
      }));
    }
  },

  /**
   * Delete a message with optimistic update
   * Requirement 5.4: WHEN deleting a message THEN THE Message_Store SHALL call DELETE /chats/:chatId/messages/:messageId
   */
  deleteMessage: async (chatId, messageId) => {
    const messages = get().messages[chatId] || [];
    const messageToDelete = messages.find(m => m.id === messageId);
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (!messageToDelete) return;
    
    // Optimistic update: Remove message
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).filter(msg => msg.id !== messageId),
      },
    }));
    
    try {
      const result = await messagesService.deleteMessage(chatId, messageId);
      
      if (!result.success) {
        // Rollback: Restore message at original position
        set((state) => {
          const currentMessages = [...(state.messages[chatId] || [])];
          currentMessages.splice(messageIndex, 0, messageToDelete);
          return {
            messages: {
              ...state.messages,
              [chatId]: currentMessages,
            },
            error: result.error?.message || 'Failed to delete message',
          };
        });
      }
    } catch {
      // Rollback on error
      set((state) => {
        const currentMessages = [...(state.messages[chatId] || [])];
        currentMessages.splice(messageIndex, 0, messageToDelete);
        return {
          messages: {
            ...state.messages,
            [chatId]: currentMessages,
          },
          error: 'Failed to delete message',
        };
      });
    }
  },

  /**
   * Edit a message with optimistic update
   * Requirement 5.3: WHEN editing a message THEN THE Message_Store SHALL call PUT /chats/:chatId/messages/:messageId
   */
  editMessage: async (chatId, messageId, newText) => {
    const messages = get().messages[chatId] || [];
    const originalMessage = messages.find(m => m.id === messageId);
    
    if (!originalMessage) return;
    
    // Optimistic update
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map(msg =>
          msg.id === messageId ? { ...msg, text: newText, isEdited: true } : msg
        ),
      },
    }));
    
    try {
      const result = await messagesService.editMessage(chatId, messageId, newText);
      
      if (result.error) {
        // Rollback on error
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg =>
              msg.id === messageId ? originalMessage : msg
            ),
          },
          error: result.error.message,
        }));
      } else if (result.message) {
        // Update with server response
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg =>
              msg.id === messageId ? result.message! : msg
            ),
          },
        }));
      }
    } catch {
      // Rollback on error
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg =>
            msg.id === messageId ? originalMessage : msg
          ),
        },
        error: 'Failed to edit message',
      }));
    }
  },

  /**
   * Pin a message with optimistic update
   * Requirement 5.6: WHEN pinning a message THEN THE Message_Store SHALL call POST /chats/:chatId/messages/:messageId/pin
   */
  pinMessage: async (chatId, messageId) => {
    // Optimistic update
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map(msg =>
          msg.id === messageId ? { ...msg, isPinned: true } : msg
        ),
      },
    }));
    
    try {
      const result = await messagesService.pinMessage(chatId, messageId);
      
      if (result.error) {
        // Rollback on error
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg =>
              msg.id === messageId ? { ...msg, isPinned: false } : msg
            ),
          },
          error: result.error.message,
        }));
      } else if (result.message) {
        // Update with server response
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg =>
              msg.id === messageId ? result.message! : msg
            ),
          },
        }));
      }
    } catch {
      // Rollback on error
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg =>
            msg.id === messageId ? { ...msg, isPinned: false } : msg
          ),
        },
        error: 'Failed to pin message',
      }));
    }
  },

  /**
   * Unpin a message with optimistic update
   * Requirement 5.6: WHEN pinning a message THEN THE Message_Store SHALL call POST /chats/:chatId/messages/:messageId/pin
   */
  unpinMessage: async (chatId, messageId) => {
    // Optimistic update
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map(msg =>
          msg.id === messageId ? { ...msg, isPinned: false } : msg
        ),
      },
    }));
    
    try {
      const result = await messagesService.unpinMessage(chatId, messageId);
      
      if (!result.success) {
        // Rollback on error
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map(msg =>
              msg.id === messageId ? { ...msg, isPinned: true } : msg
            ),
          },
          error: result.error?.message || 'Failed to unpin message',
        }));
      }
    } catch {
      // Rollback on error
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map(msg =>
            msg.id === messageId ? { ...msg, isPinned: true } : msg
          ),
        },
        error: 'Failed to unpin message',
      }));
    }
  },

  /**
   * Clear messages for a chat (local only)
   */
  clearMessages: (chatId) => {
    set((state) => {
      const { [chatId]: _, ...restMessages } = state.messages;
      const { [chatId]: __, ...restPagination } = state.pagination;
      return { 
        messages: restMessages,
        pagination: restPagination,
      };
    });
  },

  /**
   * Clear all messages in a chat (calls API)
   */
  clearChatMessages: async (chatId) => {
    const messages = get().messages[chatId] || [];
    
    // Optimistic update: Clear messages locally
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [],
      },
    }));
    
    try {
      const result = await messagesService.clearChat(chatId);
      
      if (!result.success) {
        // Rollback on error
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: messages,
          },
          error: result.error?.message || 'Failed to clear chat',
        }));
        return false;
      }
      
      return true;
    } catch {
      // Rollback on error
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: messages,
        },
        error: 'Failed to clear chat',
      }));
      return false;
    }
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },
}));

// ============================================
// Selectors and Hooks
// ============================================

// Empty array constant to avoid creating new references
const EMPTY_MESSAGES: Message[] = [];

// Stable selectors
const selectLoading = (state: MessagesState) => state.loading;
const selectError = (state: MessagesState) => state.error;
const selectAddMessage = (state: MessagesState) => state.addMessage;

/**
 * Hook to get messages and actions for a specific chat
 */
export const useMessages = (chatId: string | null) => {
  const messages = useMessagesStore((state) => 
    chatId ? (state.messages[chatId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const loading = useMessagesStore(selectLoading);
  const error = useMessagesStore(selectError);
  const addMessage = useMessagesStore(selectAddMessage);
  const pagination = useMessagesStore((state) => 
    chatId ? state.pagination[chatId] : undefined
  );

  // Memoize actions to prevent infinite loops in useCallback dependencies
  const actions = useMemo(() => {
    const store = useMessagesStore.getState();
    return {
      sendMessage: (text: string, attachments?: Attachment[], replyTo?: ReplyTo) =>
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
      loadMore: () => chatId ? store.loadMoreMessages(chatId) : Promise.resolve(),
      clearError: () => store.clearError(),
    };
  }, [chatId]);

  return {
    messages,
    loading,
    error,
    addMessage,
    pagination,
    ...actions,
  };
};
