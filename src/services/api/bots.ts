/**
 * Bot API Service
 * Handles bot-related API calls including inline button callbacks
 * Requirements: Backend 8.1-8.3
 */

import { apiClient, parseApiError } from './client';
import { Message, ParsedError } from './types';

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

// ============================================
// Bot Service
// ============================================

export const botsService = {
  /**
   * Handle inline keyboard button callback
   * POST /bots/:botId/callback
   */
  handleCallback: async (
    botId: string,
    request: BotCallbackRequest
  ): Promise<BotCallbackResult> => {
    try {
      const response = await apiClient.post<BotCallbackResponse>(
        `/bots/${botId}/callback`,
        request
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
