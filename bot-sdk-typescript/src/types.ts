// Core data types for Bot SDK

/**
 * Update object representing a new message or event
 */
export interface Update {
  /** Unique identifier for this update */
  updateId: string;
  /** The message that triggered this update */
  message: Message;
}

/**
 * Message object representing a chat message
 */
export interface Message {
  /** Unique identifier for this message */
  messageId: string;
  /** Chat where the message was sent */
  chat: Chat;
  /** User who sent the message */
  from: User;
  /** Text content of the message */
  text: string;
  /** Optional timestamp when the message was sent */
  timestamp?: string;
}

/**
 * Chat object representing a conversation
 */
export interface Chat {
  /** Unique identifier for this chat */
  id: string;
  /** Type of chat: 'private' for direct messages, 'group' for group chats */
  type?: 'private' | 'group';
}

/**
 * User object representing a chat participant
 */
export interface User {
  /** Unique identifier for this user */
  id: string;
  /** Optional username */
  username?: string;
}

/**
 * Inline button for interactive messages
 */
export interface InlineButton {
  /** Button text displayed to the user */
  text: string;
  /** Callback data sent when button is clicked (mutually exclusive with url) */
  callbackData?: string;
  /** URL to open when button is clicked (mutually exclusive with callbackData) */
  url?: string;
}

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  /** ID of the message to reply to */
  replyToId?: string;
  /** Inline keyboard buttons (array of rows, each row is an array of buttons) */
  inlineKeyboard?: InlineButton[][];
}

/**
 * Bot API error response
 */
export interface BotError {
  /** Always false for errors */
  ok: false;
  /** HTTP error code */
  errorCode: number;
  /** Human-readable error description */
  description: string;
}

/**
 * Logger interface for custom logging implementations
 */
export interface Logger {
  /**
   * Log debug-level messages
   * @param message - Log message
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: any[]): void;
  
  /**
   * Log info-level messages
   * @param message - Log message
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: any[]): void;
  
  /**
   * Log error-level messages
   * @param message - Log message
   * @param args - Additional arguments to log
   */
  error(message: string, ...args: any[]): void;
}

/**
 * Default console logger implementation
 * 
 * @example
 * ```typescript
 * const logger = new ConsoleLogger('debug');
 * logger.info('Bot started');
 * ```
 */
export class ConsoleLogger implements Logger {
  /**
   * Create a new ConsoleLogger
   * @param level - Log level: 'debug', 'info', 'error', or 'none'
   */
  constructor(private level: 'debug' | 'info' | 'error' | 'none' = 'info') {}

  debug(message: string, ...args: any[]): void {
    if (this.level === 'debug') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level === 'debug' || this.level === 'info') {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level !== 'none') {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

/**
 * Bot configuration options
 */
export interface BotOptions {
  /** Bot authentication token */
  token: string;
  /** Connection mode: 'websocket' for real-time, 'webhook' for serverless */
  mode?: 'websocket' | 'webhook';
  /** Base URL for the Bot API (default: 'http://localhost:3000') */
  apiBaseUrl?: string;
  /** WebSocket URL for real-time connections (default: 'ws://localhost:3000') */
  wsUrl?: string;
  /** Log level: 'debug', 'info', 'error', or 'none' (default: 'info') */
  logLevel?: 'debug' | 'info' | 'error' | 'none';
  /** Custom logger implementation (default: ConsoleLogger) */
  logger?: Logger;
  /** Number of retry attempts for failed API requests (default: 3) */
  retryAttempts?: number;
  /** Initial delay in milliseconds between retries (default: 1000) */
  retryDelay?: number;
}
