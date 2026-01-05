// Update Router for Bot SDK
// Routes updates to appropriate handlers and manages middleware chain

import { Update, Logger } from './types';
import { ApiClient } from './api-client';
import { Context } from './context';

/**
 * Middleware function type
 * 
 * Middleware runs before handlers and can modify context or stop processing.
 * Call next() to continue to the next middleware or handler.
 * 
 * @param ctx - Context object for the current update
 * @param next - Function to call to continue processing
 * 
 * @example
 * ```typescript
 * const loggingMiddleware: Middleware = async (ctx, next) => {
 *   console.log('Processing message:', ctx.text);
 *   await next();
 * };
 * ```
 */
export type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;

/**
 * Message handler function type
 * 
 * Called for all incoming messages.
 * 
 * @param ctx - Context object for the current message
 * 
 * @example
 * ```typescript
 * const messageHandler: MessageHandler = async (ctx) => {
 *   console.log('Received:', ctx.text);
 * };
 * ```
 */
export type MessageHandler = (ctx: Context) => Promise<void> | void;

/**
 * Text handler function type
 * 
 * Called for text messages that are not commands.
 * 
 * @param ctx - Context object for the current message
 * 
 * @example
 * ```typescript
 * const textHandler: TextHandler = async (ctx) => {
 *   await ctx.reply(`Echo: ${ctx.text}`);
 * };
 * ```
 */
export type TextHandler = (ctx: Context) => Promise<void> | void;

/**
 * Command handler function type
 * 
 * Called for command messages (starting with '/').
 * Context includes command name and arguments.
 * 
 * @param ctx - Context object with command and args properties
 * 
 * @example
 * ```typescript
 * const commandHandler: CommandHandler = async (ctx) => {
 *   console.log('Command:', ctx.command);
 *   console.log('Args:', ctx.args);
 * };
 * ```
 */
export type CommandHandler = (ctx: Context) => Promise<void> | void;

/**
 * Error handler function type
 * 
 * Called when an error occurs in handlers or middleware.
 * 
 * @param error - The error that occurred
 * @param ctx - Optional context object (may be undefined for connection errors)
 * 
 * @example
 * ```typescript
 * const errorHandler: ErrorHandler = (error, ctx) => {
 *   console.error('Error:', error.message);
 *   if (ctx) {
 *     console.error('User:', ctx.userId);
 *   }
 * };
 * ```
 */
export type ErrorHandler = (error: Error, ctx?: Context) => void;

/**
 * UpdateRouter class
 * Manages handler registration and routes updates to appropriate handlers
 * Supports middleware chain execution
 */
export class UpdateRouter {
  // Handler arrays and maps (Requirement 4.1, 4.2, 4.3, 5.1)
  private middlewares: Middleware[] = [];
  private messageHandlers: MessageHandler[] = [];
  private textHandlers: TextHandler[] = [];
  private commandHandlers: Map<string, CommandHandler[]> = new Map();
  private generalCommandHandlers: CommandHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  
  // Store apiClient and logger references
  private apiClient: ApiClient;
  private logger: Logger;

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Register handler for different event types
   * Stores handlers in appropriate arrays (Requirements 4.1, 4.2, 4.3)
   */
  on(event: 'message', handler: MessageHandler): void;
  on(event: 'text', handler: TextHandler): void;
  on(event: 'command', handler: CommandHandler): void;
  on(event: string, handler: MessageHandler | TextHandler | CommandHandler): void {
    if (event === 'message') {
      this.messageHandlers.push(handler as MessageHandler);
    } else if (event === 'text') {
      this.textHandlers.push(handler as TextHandler);
    } else if (event === 'command') {
      this.generalCommandHandlers.push(handler as CommandHandler);
    }
  }

  /**
   * Register command handler
   * Normalizes command to lowercase and stores in commandHandlers map
   * (Requirement 5.1)
   */
  command(command: string, handler: CommandHandler): void {
    // Normalize command to lowercase
    const normalizedCommand = command.toLowerCase();
    
    // Store handler in commandHandlers map
    if (!this.commandHandlers.has(normalizedCommand)) {
      this.commandHandlers.set(normalizedCommand, []);
    }
    this.commandHandlers.get(normalizedCommand)!.push(handler);
  }

  /**
   * Register middleware
   * Adds middleware to middlewares array (Requirement 9.1)
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Register error handler
   * (Requirements 10.2, 10.3)
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Route update to handlers
   * Creates Context, runs middleware chain, then calls handlers
   * (Requirements 6.1, 9.2, 9.3, 9.4, 9.5)
   */
  async route(update: Update): Promise<void> {
    try {
      // Create Context from update (Requirement 6.1)
      const ctx = new Context(update, this.apiClient);

      // Run middleware chain with next() support
      let middlewareIndex = 0;
      const runMiddleware = async (): Promise<void> => {
        if (middlewareIndex < this.middlewares.length) {
          const middleware = this.middlewares[middlewareIndex++];
          // Call middleware with next function (Requirements 9.2, 9.3)
          await middleware(ctx, runMiddleware);
        } else {
          // Middleware chain complete, run handlers (Requirement 9.4)
          await this.runHandlers(ctx);
        }
      };

      await runMiddleware();
    } catch (error) {
      // Catch and handle errors (Requirement 9.5)
      this.handleError(error as Error);
    }
  }

  /**
   * Run handlers for the update
   * Calls appropriate handlers based on message type
   * (Requirements 4.4, 5.2, 5.3, 5.5)
   */
  private async runHandlers(ctx: Context): Promise<void> {
    // Always call message handlers (Requirement 4.4)
    for (const handler of this.messageHandlers) {
      try {
        await handler(ctx);
      } catch (error) {
        this.handleError(error as Error, ctx);
      }
    }

    // Parse command if message starts with "/" (Requirement 5.2)
    const parsedCommand = this.parseCommand(ctx.message.text);
    
    if (parsedCommand) {
      // Set command and args on context (Requirement 5.3)
      ctx.command = parsedCommand.command;
      ctx.args = parsedCommand.args;

      // Call specific command handlers if command matches (Requirement 5.2)
      const handlers = this.commandHandlers.get(parsedCommand.command) ?? [];
      for (const handler of handlers) {
        try {
          await handler(ctx);
        } catch (error) {
          this.handleError(error as Error, ctx);
        }
      }

      // Call general command handlers for all commands (Requirement 5.2)
      for (const handler of this.generalCommandHandlers) {
        try {
          await handler(ctx);
        } catch (error) {
          this.handleError(error as Error, ctx);
        }
      }
    } else if (ctx.message.text) {
      // Call text handlers for non-command text messages (Requirement 5.5)
      for (const handler of this.textHandlers) {
        try {
          await handler(ctx);
        } catch (error) {
          this.handleError(error as Error, ctx);
        }
      }
    }
  }

  /**
   * Parse command from message text
   * Checks if text starts with "/", extracts command name and arguments
   * (Requirement 5.2)
   */
  private parseCommand(text: string): { command: string; args: string[] } | null {
    // Check if text starts with "/"
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) {
      return null;
    }

    // Extract command content (after the "/")
    const content = trimmed.slice(1);
    if (content.length === 0) {
      return null;
    }

    // Split by whitespace to get command and arguments
    const parts = content.split(/\s+/);
    
    // Extract command name (lowercase) and arguments
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { command, args };
  }

  /**
   * Handle errors from handlers or middleware
   * Calls registered error handlers or logs to console
   * (Requirements 10.1, 10.2, 10.3, 10.4)
   */
  private handleError(error: Error, ctx?: Context): void {
    // Call registered error handlers with error and context (Requirement 10.2)
    if (this.errorHandlers.length > 0) {
      for (const handler of this.errorHandlers) {
        try {
          handler(error, ctx);
        } catch (handlerError) {
          // Catch errors in error handlers (Requirement 10.3)
          this.logger.error('Error in error handler:', handlerError);
        }
      }
    } else {
      // Log to console.error if no handlers registered (Requirement 10.4)
      this.logger.error('Unhandled error:', error);
    }
  }
}
