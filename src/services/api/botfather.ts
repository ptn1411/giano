/**
 * BotFather API Service
 * Handles BotFather chat interactions
 */

import { apiClient, parseApiError } from './client';

export interface BotFatherMessageRequest {
  text: string;
  chatId?: string;
}

export interface BotFatherMessageResponse {
  success: boolean;
  response: string | null;
  error: string | null;
}

export interface BotFatherResult {
  success: boolean;
  response: string | null;
  error: string | null;
}

export const botfatherService = {
  /**
   * Send a message to BotFather and get response
   */
  async sendMessage(text: string, chatId?: string): Promise<BotFatherResult> {
    try {
      const response = await apiClient.post<BotFatherMessageResponse>('/botfather/message', {
        text,
        chatId,
      });
      return {
        success: response.data.success,
        response: response.data.response,
        error: response.data.error,
      };
    } catch (error) {
      const parsedError = parseApiError(error);
      return {
        success: false,
        response: null,
        error: parsedError.message,
      };
    }
  },
};

export default botfatherService;
