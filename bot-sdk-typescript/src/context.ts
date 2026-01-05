// Context class for Bot SDK
import { Update, Message, InlineButton, SendMessageOptions } from './types';
import { ApiClient } from './api-client';
import { ValidationError } from './errors';

/**
 * Context object provided to message handlers
 * Contains message information and helper methods for responding
 */
export class Context {
  public message: Message;
  public updateId: string;
  public command?: string;
  public args?: string[];
  private apiClient: ApiClient;

  constructor(update: Update, apiClient: ApiClient) {
    // Store update, message, and apiClient (Requirement 6.1)
    this.updateId = update.updateId;
    this.message = update.message;
    this.apiClient = apiClient;
  }

  /**
   * Reply to the message
   * Sends a message to the same chat with replyToId set
   * (Requirement 6.2, 6.3)
   */
  async reply(text: string, options?: SendMessageOptions): Promise<Message> {
    return this.apiClient.sendMessage(
      this.message.chat.id,
      text,
      {
        ...options,
        replyToId: this.message.messageId,
      }
    );
  }

  /**
   * Reply with inline keyboard buttons
   * Validates button structure and includes inline_keyboard
   * (Requirement 6.3, 8.5)
   */
  async replyWithButtons(
    text: string,
    buttons: InlineButton[][]
  ): Promise<Message> {
    // Validate each button has either callback_data or url (not both) (Requirement 8.5)
    this.validateButtons(buttons);

    return this.apiClient.sendMessage(
      this.message.chat.id,
      text,
      {
        replyToId: this.message.messageId,
        inlineKeyboard: buttons,
      }
    );
  }

  /**
   * Send message to the same chat without replyToId
   * (Requirement 6.4)
   */
  async send(text: string, options?: SendMessageOptions): Promise<Message> {
    return this.apiClient.sendMessage(this.message.chat.id, text, options);
  }

  /**
   * Validate button structure
   * Each button must have either callback_data or url (not both)
   * (Requirement 8.5)
   */
  private validateButtons(buttons: InlineButton[][]): void {
    for (const row of buttons) {
      for (const button of row) {
        const hasCallbackData = button.callbackData !== undefined;
        const hasUrl = button.url !== undefined;

        // Button must have either callback_data or url, but not both
        if (hasCallbackData && hasUrl) {
          throw new ValidationError(
            `Button "${button.text}" cannot have both callbackData and url`
          );
        }

        if (!hasCallbackData && !hasUrl) {
          throw new ValidationError(
            `Button "${button.text}" must have either callbackData or url`
          );
        }
      }
    }
  }

  /**
   * Convenience getter for chat ID
   * (Requirement 6.4)
   */
  get chatId(): string {
    return this.message.chat.id;
  }

  /**
   * Convenience getter for user ID
   * (Requirement 6.4)
   */
  get userId(): string {
    return this.message.from.id;
  }

  /**
   * Convenience getter for message text
   * (Requirement 6.4)
   */
  get text(): string {
    return this.message.text;
  }
}
