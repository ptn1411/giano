// Main Bot Client class
import { EventEmitter } from 'events';
import { BotOptions, ConsoleLogger, Message, SendMessageOptions } from './types';
import { InitializationError } from './errors';
import { ApiClient } from './api-client';
import { UpdateRouter, MessageHandler, TextHandler, CommandHandler, ErrorHandler, Middleware } from './update-router';
import { WebSocketManager } from './websocket-manager';
import { WebhookServer } from './webhook-server';

/**
 * Main Bot Client class for building bots
 * 
 * The Bot class is the main entry point for the SDK. It manages connections,
 * routes updates to handlers, and provides methods for sending messages.
 * 
 * @example
 * ```typescript
 * const bot = new Bot('YOUR_BOT_TOKEN');
 * 
 * bot.command('start', async (ctx) => {
 *   await ctx.reply('Hello!');
 * });
 * 
 * await bot.start();
 * ```
 */
export class Bot {
  private token: string;
  private options: Required<BotOptions>;
  private wsManager?: WebSocketManager;
  private webhookServer?: WebhookServer;
  private apiClient: ApiClient;
  private updateRouter: UpdateRouter;
  private eventEmitter: EventEmitter;
  private isRunning: boolean = false;

  /**
   * Create a new Bot instance
   * 
   * @param token - Bot authentication token (required, non-empty)
   * @param options - Optional configuration options
   * 
   * @throws {InitializationError} If token is empty or invalid
   * 
   * @example
   * ```typescript
   * // Basic usage
   * const bot = new Bot('YOUR_BOT_TOKEN');
   * 
   * // With options
   * const bot = new Bot('YOUR_BOT_TOKEN', {
   *   mode: 'websocket',
   *   apiBaseUrl: 'http://localhost:3000',
   *   logLevel: 'debug',
   * });
   * ```
   */
  constructor(token: string, options?: Partial<BotOptions>) {
    // Validate token is non-empty (Requirement 1.4, 1.5)
    if (!token || token.trim() === '') {
      throw new InitializationError('Bot token is required and must be non-empty');
    }

    // Store token (Requirement 1.1)
    this.token = token;

    // Merge options with defaults (Requirement 1.2, 1.3)
    this.options = {
      token,
      mode: options?.mode ?? 'websocket',
      apiBaseUrl: options?.apiBaseUrl ?? 'http://localhost:3000',
      wsUrl: options?.wsUrl ?? 'ws://localhost:3000',
      logLevel: options?.logLevel ?? 'info',
      logger: options?.logger ?? new ConsoleLogger(options?.logLevel ?? 'info'),
      retryAttempts: options?.retryAttempts ?? 3,
      retryDelay: options?.retryDelay ?? 1000,
    };

    // Initialize ApiClient, UpdateRouter, EventEmitter (Requirement 1.1)
    this.apiClient = new ApiClient(this.token, this.options);
    this.updateRouter = new UpdateRouter(this.apiClient, this.options.logger);
    this.eventEmitter = new EventEmitter();
  }

  // Start bot in WebSocket mode (Requirement 2.1)
  /**
   * Start the bot in WebSocket mode
   * 
   * Establishes a WebSocket connection to the server for real-time updates.
   * The bot will automatically reconnect if the connection drops.
   * 
   * @returns Promise that resolves when the bot is connected and ready
   * 
   * @throws {InitializationError} If bot is already running or mode is not 'websocket'
   * 
   * @example
   * ```typescript
   * const bot = new Bot('YOUR_BOT_TOKEN', { mode: 'websocket' });
   * await bot.start();
   * console.log('Bot is running!');
   * ```
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new InitializationError('Bot is already running');
    }

    if (this.options.mode !== 'websocket') {
      throw new InitializationError('Use startWebhook() for webhook mode');
    }

    // Create WebSocketManager instance
    this.wsManager = new WebSocketManager(
      this.token,
      this.options.wsUrl,
      this.updateRouter,
      this.options.logger
    );

    // Call connect() and handle ready event
    await this.wsManager.connect();

    // Set isRunning flag
    this.isRunning = true;
    this.emit('ready');
  }

  // Start bot in webhook mode (Requirement 3.1)
  /**
   * Start the bot in webhook mode
   * 
   * Starts an HTTP server to receive updates via webhooks.
   * Ideal for serverless deployments.
   * 
   * @param port - Port number for the webhook server
   * @param path - URL path for the webhook endpoint (default: '/webhook')
   * 
   * @returns Promise that resolves when the server is listening
   * 
   * @throws {InitializationError} If bot is already running or mode is not 'webhook'
   * 
   * @example
   * ```typescript
   * const bot = new Bot('YOUR_BOT_TOKEN', { mode: 'webhook' });
   * await bot.startWebhook(8080, '/webhook');
   * console.log('Webhook server listening on port 8080');
   * ```
   */
  async startWebhook(port: number, path: string = '/webhook'): Promise<void> {
    if (this.isRunning) {
      throw new InitializationError('Bot is already running');
    }

    if (this.options.mode !== 'webhook') {
      throw new InitializationError('Use start() for websocket mode');
    }

    // Create WebhookServer instance
    this.webhookServer = new WebhookServer(
      port,
      path,
      this.updateRouter,
      this.options.logger
    );

    // Start server on specified port and path
    await this.webhookServer.start();

    // Set isRunning flag
    this.isRunning = true;
    this.emit('ready');
  }

  // Stop bot gracefully (Requirements 14.1, 14.4, 14.5)
  /**
   * Stop the bot gracefully
   * 
   * Stops accepting new updates and closes connections.
   * Waits for pending handlers to complete before shutting down.
   * 
   * @returns Promise that resolves when shutdown is complete
   * 
   * @example
   * ```typescript
   * // Graceful shutdown on SIGINT
   * process.on('SIGINT', async () => {
   *   await bot.stop();
   *   process.exit(0);
   * });
   * ```
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Stop accepting new updates
    this.isRunning = false;

    // Disconnect WebSocket or close webhook server
    if (this.wsManager) {
      await this.wsManager.disconnect();
    }

    if (this.webhookServer) {
      await this.webhookServer.stop();
    }

    // Emit "stopped" event
    this.emit('stopped');
  }

  // Register message handler (Requirements 4.1, 4.2, 4.3)
  /**
   * Register an event handler
   * 
   * @param event - Event type ('message', 'text', 'command', 'error', 'ready', 'stopped')
   * @param handler - Handler function to call when event occurs
   * 
   * @example
   * ```typescript
   * // Handle all messages
   * bot.on('message', async (ctx) => {
   *   console.log('Received message:', ctx.text);
   * });
   * 
   * // Handle text messages only
   * bot.on('text', async (ctx) => {
   *   await ctx.reply(`You said: ${ctx.text}`);
   * });
   * 
   * // Handle all commands
   * bot.on('command', async (ctx) => {
   *   console.log('Command:', ctx.command);
   * });
   * 
   * // Handle errors
   * bot.on('error', (error, ctx) => {
   *   console.error('Error:', error);
   * });
   * 
   * // Handle ready event
   * bot.on('ready', () => {
   *   console.log('Bot is ready!');
   * });
   * ```
   */
  on(event: 'message', handler: MessageHandler): void;
  on(event: 'text', handler: TextHandler): void;
  on(event: 'command', handler: CommandHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: 'ready' | 'stopped', handler: () => void): void;
  on(event: string, handler: MessageHandler | TextHandler | CommandHandler | ErrorHandler | (() => void)): void {
    // Delegate to UpdateRouter for message/text/command handlers
    if (event === 'message') {
      this.updateRouter.on('message', handler as MessageHandler);
    } else if (event === 'text') {
      this.updateRouter.on('text', handler as TextHandler);
    } else if (event === 'command') {
      this.updateRouter.on('command', handler as CommandHandler);
    } else {
      // Register event handlers on EventEmitter
      this.eventEmitter.on(event, handler);
    }
  }

  // Register command handler (Requirement 5.1)
  /**
   * Register a handler for a specific command
   * 
   * Commands are matched case-insensitively. The handler receives a Context
   * object with the command name and arguments parsed.
   * 
   * @param command - Command name (without the leading '/')
   * @param handler - Handler function to call when command is received
   * 
   * @example
   * ```typescript
   * // Handle /start command
   * bot.command('start', async (ctx) => {
   *   await ctx.reply('Welcome!');
   * });
   * 
   * // Handle /echo command with arguments
   * bot.command('echo', async (ctx) => {
   *   const text = ctx.args?.join(' ') || 'Nothing to echo';
   *   await ctx.reply(text);
   * });
   * 
   * // Case-insensitive: /HELP, /help, /Help all match
   * bot.command('help', async (ctx) => {
   *   await ctx.reply('Help text here');
   * });
   * ```
   */
  command(command: string, handler: CommandHandler): void {
    this.updateRouter.command(command, handler);
  }

  // Register middleware (Requirement 9.1)
  /**
   * Register a middleware function
   * 
   * Middleware functions run before handlers and can modify the context,
   * perform logging, authentication, or stop processing by not calling next().
   * 
   * @param middleware - Middleware function
   * 
   * @example
   * ```typescript
   * // Logging middleware
   * bot.use(async (ctx, next) => {
   *   console.log('Message from:', ctx.userId);
   *   await next();
   * });
   * 
   * // Authentication middleware
   * bot.use(async (ctx, next) => {
   *   if (isAuthorized(ctx.userId)) {
   *     await next();
   *   } else {
   *     await ctx.reply('Not authorized');
   *   }
   * });
   * 
   * // Rate limiting middleware
   * bot.use(async (ctx, next) => {
   *   if (rateLimiter.check(ctx.userId)) {
   *     await next();
   *   } else {
   *     await ctx.reply('Too many requests');
   *   }
   * });
   * ```
   */
  use(middleware: Middleware): void {
    this.updateRouter.use(middleware);
  }

  // Send message (Requirement 7.1)
  /**
   * Send a message to a chat
   * 
   * @param chatId - ID of the chat to send the message to
   * @param text - Text content of the message
   * @param options - Optional message options (reply_to, inline_keyboard)
   * 
   * @returns Promise that resolves with the sent Message object
   * 
   * @throws {BotError} If the API request fails
   * 
   * @example
   * ```typescript
   * // Simple message
   * await bot.sendMessage('chat123', 'Hello!');
   * 
   * // Reply to a message
   * await bot.sendMessage('chat123', 'Reply text', {
   *   replyToId: 'msg456',
   * });
   * 
   * // Message with inline buttons
   * await bot.sendMessage('chat123', 'Choose:', {
   *   inlineKeyboard: [
   *     [
   *       { text: 'Button 1', callbackData: 'btn1' },
   *       { text: 'Button 2', callbackData: 'btn2' },
   *     ],
   *   ],
   * });
   * ```
   */
  async sendMessage(
    chatId: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<Message> {
    return this.apiClient.sendMessage(chatId, text, options);
  }

  // Helper method to emit events
  private emit(event: string, ...args: unknown[]): void {
    this.eventEmitter.emit(event, ...args);
  }
}
