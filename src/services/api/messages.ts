/**
 * Messages API Service
 * Handles all message-related API calls
 * Requirements: 5.1-5.6
 */

import { apiClient, parseApiError } from './client';
import {
  Message,
  MessagesResponse,
  MessageResponse,
  SendMessageRequest,
  EditMessageRequest,
  AddReactionRequest,
  ParsedError,
} from './types';

// ============================================
// Result Types
// ============================================

export interface MessagesResult {
  messages: Message[];
  hasMore: boolean;
  error?: ParsedError;
}

export interface MessageResult {
  message?: Message;
  error?: ParsedError;
}

export interface DeleteResult {
  success: boolean;
  error?: ParsedError;
}

// ============================================
// Messages Service
// ============================================

export const messagesService = {
  /**
   * Get messages for a chat with pagination support
   * Requirement 5.1, 5.7
   */
  getMessages: async (
    chatId: string,
    before?: string,
    limit: number = 20
  ): Promise<MessagesResult> => {
    try {
      const params: Record<string, string | number> = { limit };
      if (before) {
        params.before = before;
      }

      const response = await apiClient.get<MessagesResponse>(
        `/chats/${chatId}/messages`,
        { params }
      );

      return {
        messages: response.data.messages,
        hasMore: response.data.hasMore,
      };
    } catch (error) {
      return {
        messages: [],
        hasMore: false,
        error: parseApiError(error),
      };
    }
  },

  /**
   * Send a new message to a chat
   * Requirement 5.2
   */
  sendMessage: async (
    chatId: string,
    data: SendMessageRequest
  ): Promise<MessageResult> => {
    try {
      const response = await apiClient.post<MessageResponse>(
        `/chats/${chatId}/messages`,
        data
      );

      return {
        message: response.data.message,
      };
    } catch (error) {
      return {
        error: parseApiError(error),
      };
    }
  },

  /**
   * Edit an existing message
   * Requirement 5.3
   */
  editMessage: async (
    chatId: string,
    messageId: string,
    text: string
  ): Promise<MessageResult> => {
    try {
      const data: EditMessageRequest = { text };
      const response = await apiClient.put<MessageResponse>(
        `/chats/${chatId}/messages/${messageId}`,
        data
      );

      return {
        message: response.data.message,
      };
    } catch (error) {
      return {
        error: parseApiError(error),
      };
    }
  },

  /**
   * Delete a message
   * Requirement 5.4
   */
  deleteMessage: async (
    chatId: string,
    messageId: string
  ): Promise<DeleteResult> => {
    try {
      await apiClient.delete(`/chats/${chatId}/messages/${messageId}`);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: parseApiError(error),
      };
    }
  },

  /**
   * Add a reaction to a message
   * Requirement 5.5
   */
  addReaction: async (
    chatId: string,
    messageId: string,
    emoji: string
  ): Promise<MessageResult> => {
    try {
      const data: AddReactionRequest = { emoji };
      const response = await apiClient.post<MessageResponse>(
        `/chats/${chatId}/messages/${messageId}/reactions`,
        data
      );

      return {
        message: response.data.message,
      };
    } catch (error) {
      return {
        error: parseApiError(error),
      };
    }
  },

  /**
   * Remove a reaction from a message
   */
  removeReaction: async (
    chatId: string,
    messageId: string,
    emoji: string
  ): Promise<MessageResult> => {
    try {
      const response = await apiClient.delete<MessageResponse>(
        `/chats/${chatId}/messages/${messageId}/reactions`,
        { data: { emoji } }
      );

      return {
        message: response.data.message,
      };
    } catch (error) {
      return {
        error: parseApiError(error),
      };
    }
  },

  /**
   * Pin a message in a chat
   * Requirement 5.6
   */
  pinMessage: async (
    chatId: string,
    messageId: string
  ): Promise<MessageResult> => {
    try {
      const response = await apiClient.post<MessageResponse>(
        `/chats/${chatId}/messages/${messageId}/pin`
      );

      return {
        message: response.data.message,
      };
    } catch (error) {
      return {
        error: parseApiError(error),
      };
    }
  },

  /**
   * Unpin a message in a chat
   * Requirement 5.6
   */
  unpinMessage: async (
    chatId: string,
    messageId: string
  ): Promise<DeleteResult> => {
    try {
      await apiClient.delete(`/chats/${chatId}/messages/${messageId}/pin`);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: parseApiError(error),
      };
    }
  },

  /**
   * Clear all messages in a chat
   */
  clearChat: async (chatId: string): Promise<DeleteResult> => {
    try {
      await apiClient.delete(`/chats/${chatId}/messages`);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: parseApiError(error),
      };
    }
  },
};


export default messagesService;
