/**
 * Chats API Service
 * Handles chat-related API calls
 * Requirements: 4.1-4.5
 */

import { apiClient, parseApiError } from "./client";
import {
  Chat,
  ChatResponse,
  ChatsResponse,
  CreateGroupRequest,
  User,
} from "./types";

// ============================================
// Chats Service Interface
// ============================================

export interface ChatsResult {
  chats: Chat[];
  error: string | null;
}

export interface ChatResult {
  chat: Chat | null;
  error: string | null;
}

// ============================================
// Chats API Service
// ============================================

export const chatsService = {
  /**
   * Get all chats for the current user
   * Requirement 4.1: Fetch chats from GET /chats
   * Requirement 4.2: Support search with GET /chats?search=query
   */
  async getChats(search?: string): Promise<ChatsResult> {
    try {
      const params = search ? { search } : undefined;
      const response = await apiClient.get<ChatsResponse>("/chats", { params });
      return { chats: response.data.chats, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { chats: [], error: parsedError.message };
    }
  },

  /**
   * Get a single chat by ID
   * Requirement 4.4: Fetch chat details from GET /chats/:chatId
   */
  async getChat(chatId: string): Promise<ChatResult> {
    try {
      const response = await apiClient.get<ChatResponse>(`/chats/${chatId}`);
      return { chat: response.data.chat, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { chat: null, error: parsedError.message };
    }
  },

  /**
   * Create a new group chat
   * Requirement 4.3: Create group chat with POST /chats/group
   */
  async createGroup(
    name: string,
    participantIds: string[],
  ): Promise<ChatResult> {
    try {
      const request: CreateGroupRequest = { name, participantIds };
      const response = await apiClient.post<ChatResponse>(
        "/chats/group",
        request,
      );
      return { chat: response.data.chat, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { chat: null, error: parsedError.message };
    }
  },

  /**
   * Create or get existing private chat with a user
   * POST /chats/private
   */
  async createPrivateChat(user: User): Promise<ChatResult> {
    try {
      const response = await apiClient.post<ChatResponse>("/chats/private", {
        userId: user.id,
      });
      return { chat: response.data.chat, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { chat: null, error: parsedError.message };
    }
  },

  /**
   * Create or get existing private chat with a bot
   * POST /chats/bot
   */
  async createBotChat(botId: string): Promise<ChatResult> {
    try {
      const response = await apiClient.post<ChatResponse>("/chats/bot", {
        botId,
      });
      return { chat: response.data.chat, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { chat: null, error: parsedError.message };
    }
  },

  /**
   * Mark a chat as read
   * Requirement 4.5: Mark chat as read with POST /chats/:chatId/read
   */
  async markAsRead(chatId: string): Promise<{ error: string | null }> {
    try {
      await apiClient.post(`/chats/${chatId}/read`);
      return { error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { error: parsedError.message };
    }
  },

  /**
   * Delete a chat
   * DELETE /chats/:chatId
   */
  async deleteChat(
    chatId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      await apiClient.delete(`/chats/${chatId}`);
      return { success: true, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { success: false, error: parsedError.message };
    }
  },

  /**
   * Pin a chat
   * POST /chats/:chatId/pin
   */
  async pinChat(chatId: string): Promise<{ error: string | null }> {
    try {
      await apiClient.post(`/chats/${chatId}/pin`);
      return { error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { error: parsedError.message };
    }
  },

  /**
   * Unpin a chat
   * POST /chats/:chatId/unpin
   */
  async unpinChat(chatId: string): Promise<{ error: string | null }> {
    try {
      await apiClient.post(`/chats/${chatId}/unpin`);
      return { error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { error: parsedError.message };
    }
  },
};

export default chatsService;
