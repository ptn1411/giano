/**
 * BotFather API Service
 * Handles BotFather chat interactions
 */

import { apiClient, parseApiError } from './client';

export interface BotFatherMessageDto {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface BotFatherMessageRequest {
  text: string;
  chatId?: string;
}

export interface BotFatherMessageResponse {
  success: boolean;
  response: string | null;
  error: string | null;
  userMessage?: BotFatherMessageDto;
  botMessage?: BotFatherMessageDto;
}

export interface BotFatherResult {
  success: boolean;
  response: string | null;
  error: string | null;
  userMessage?: BotFatherMessageDto;
  botMessage?: BotFatherMessageDto;
}

export interface GetMessagesResponse {
  messages: BotFatherMessageDto[];
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
        userMessage: response.data.userMessage,
        botMessage: response.data.botMessage,
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

  /**
   * Get message history
   */
  async getMessages(limit?: number, before?: string): Promise<BotFatherMessageDto[]> {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (before) params.append('before', before);
      
      const response = await apiClient.get<GetMessagesResponse>(
        `/botfather/messages?${params.toString()}`
      );
      return response.data.messages;
    } catch (error) {
      console.error('Failed to get BotFather messages:', error);
      return [];
    }
  },
};

export default botfatherService;
