/**
 * Bot API Service
 * Handles bot-related API calls including inline button callbacks
 * Requirements: Backend 8.1-8.3
 */

import { apiClient, parseApiError } from "./client";
import { Message, ParsedError } from "./types";

// ============================================
// Types
// ============================================

export interface BotCallbackRequest {
  chatId: string;
  messageId: string;
  callbackData: string;
}

export interface BotCallbackResponse {
  message: Message;
}

export interface BotCallbackResult {
  success: boolean;
  message?: Message;
  error?: ParsedError;
}

export interface BotPublic {
  id: string;
  name: string;
  username: string | null;
  isActive: boolean;
}

export interface BotResult {
  bot: BotPublic | null;
  error: string | null;
}

interface BotSearchResponse {
  bot: BotPublic;
}

// ============================================
// Bot Service
// ============================================

export const botsService = {
  /**
   * Search for a bot by username
   * GET /bots/search?username=xxx
   */
  searchByUsername: async (username: string): Promise<BotResult> => {
    try {
      const response = await apiClient.get<BotSearchResponse>("/bots/search", {
        params: { username },
      });
      return { bot: response.data.bot, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { bot: null, error: parsedError.message };
    }
  },

  /**
   * Handle inline keyboard button callback
   * POST /bots/:botId/callback
   */
  handleCallback: async (
    botId: string,
    request: BotCallbackRequest,
  ): Promise<BotCallbackResult> => {
    try {
      const response = await apiClient.post<BotCallbackResponse>(
        `/bots/${botId}/callback`,
        request,
      );

      return {
        success: true,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: parseApiError(error),
      };
    }
  },
};

export default botsService;
