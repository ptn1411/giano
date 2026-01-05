// API Client with retry logic for Bot SDK
import axios, { AxiosInstance, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { BotOptions, Logger, Message, SendMessageOptions } from './types';
import { BotError } from './errors';

export class ApiClient extends EventEmitter {
  private token: string;
  private client: AxiosInstance;
  private retryAttempts: number;
  private retryDelay: number;
  private logger: Logger;

  constructor(token: string, options: Required<BotOptions>) {
    super();
    
    // Store token (Requirement 7.1, 13.1)
    this.token = token;
    
    // Store retry configuration (Requirement 13.1)
    this.retryAttempts = options.retryAttempts;
    this.retryDelay = options.retryDelay;
    
    // Store logger (Requirement 13.1)
    this.logger = options.logger;

    // Initialize axios client with baseURL and timeout (Requirement 13.1)
    this.client = axios.create({
      baseURL: options.apiBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Send message method (Requirements 7.1, 7.2, 7.3)
  async sendMessage(
    chatId: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<Message> {
    // Construct POST request to /bot<TOKEN>/sendMessage (Requirement 7.1)
    const url = `/bot${this.token}/sendMessage`;
    
    // Include chat_id, text, reply_to_id, inline_keyboard in payload (Requirements 7.2, 7.3)
    const payload = {
      chat_id: chatId,
      text,
      reply_to_id: options?.replyToId,
      inline_keyboard: options?.inlineKeyboard,
    };

    // Call requestWithRetry() (Requirement 7.1)
    return this.requestWithRetry('POST', url, payload);
  }

  // Request with retry logic (Requirements 13.1, 13.2, 13.3, 13.4, 13.5)
  private async requestWithRetry(
    method: string,
    url: string,
    data?: Record<string, unknown>,
    attempt: number = 0
  ): Promise<Message> {
    try {
      const response = await this.client.request({ method, url, data });
      return response.data as Message;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Handle rate limit errors (429) - wait retry_after seconds (Requirement 13.2)
        if (axiosError.response?.status === 429) {
          const responseData = axiosError.response.data as { retry_after?: number };
          const retryAfter = responseData?.retry_after ?? 60;
          this.logger.info(`Rate limited, retrying after ${retryAfter}s`);
          
          // Emit "retry" event before retry (Requirement 13.5)
          this.emit('retry', { attempt, reason: 'rate_limit', retryAfter });
          
          await this.sleep(retryAfter * 1000);
          return this.requestWithRetry(method, url, data, attempt);
        }

        // Handle client errors (4xx except 429) - reject immediately (Requirement 13.3)
        if (
          axiosError.response &&
          axiosError.response.status >= 400 &&
          axiosError.response.status < 500
        ) {
          const errorData = axiosError.response.data as { description?: string };
          throw new BotError(
            axiosError.response.status,
            errorData?.description || axiosError.message
          );
        }

        // Handle network/5xx errors - retry with exponential backoff (Requirement 13.1)
        if (attempt < this.retryAttempts) {
          // Calculate exponential backoff delay
          const delay = this.retryDelay * Math.pow(2, attempt);
          this.logger.info(
            `Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryAttempts})`
          );
          
          // Emit "retry" event before each retry (Requirement 13.5)
          this.emit('retry', { attempt: attempt + 1, reason: 'network_error', delay });
          
          await this.sleep(delay);
          return this.requestWithRetry(method, url, data, attempt + 1);
        }
      }

      // Return last error after exhausting retries (Requirement 13.4)
      this.logger.error('All retry attempts exhausted', error);
      throw error;
    }
  }

  // Helper method to sleep
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
