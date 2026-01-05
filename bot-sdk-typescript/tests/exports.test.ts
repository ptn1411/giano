// Test that all public exports are available and work correctly

import {
  Bot,
  Context,
  ConsoleLogger,
  BotError,
  InitializationError,
  ConnectionError,
  ValidationError,
} from '../src/index';

import type {
  Update,
  InlineButton,
  SendMessageOptions,
  Logger,
  BotOptions,
  Middleware,
  MessageHandler,
  TextHandler,
  CommandHandler,
  ErrorHandler,
} from '../src/index';

describe('Public Exports', () => {
  describe('Classes', () => {
    it('should export Bot class', () => {
      expect(Bot).toBeDefined();
      expect(typeof Bot).toBe('function');
    });

    it('should export Context class', () => {
      expect(Context).toBeDefined();
      expect(typeof Context).toBe('function');
    });

    it('should export ConsoleLogger class', () => {
      expect(ConsoleLogger).toBeDefined();
      expect(typeof ConsoleLogger).toBe('function');
    });

    it('should export error classes', () => {
      expect(BotError).toBeDefined();
      expect(InitializationError).toBeDefined();
      expect(ConnectionError).toBeDefined();
      expect(ValidationError).toBeDefined();
    });
  });

  describe('Type Definitions', () => {
    it('should allow creating typed variables', () => {
      // This test verifies that TypeScript types are properly exported
      // If types are not exported, this would fail at compile time
      
      const update: Update = {
        updateId: '123',
        message: {
          messageId: 'msg1',
          chat: { id: 'chat1' },
          from: { id: 'user1' },
          text: 'Hello',
        },
      };

      const options: BotOptions = {
        token: 'test',
        mode: 'websocket',
      };

      const sendOptions: SendMessageOptions = {
        replyToId: 'msg1',
      };

      const button: InlineButton = {
        text: 'Click me',
        callbackData: 'action',
      };

      // If we get here, types are working correctly
      expect(update).toBeDefined();
      expect(options).toBeDefined();
      expect(sendOptions).toBeDefined();
      expect(button).toBeDefined();
    });

    it('should allow creating handler functions with correct types', () => {
      // Verify handler types are exported and work correctly
      
      const messageHandler: MessageHandler = async (ctx) => {
        console.log(ctx.text);
      };

      const textHandler: TextHandler = async (ctx) => {
        await ctx.reply('Response');
      };

      const commandHandler: CommandHandler = async (ctx) => {
        console.log(ctx.command);
      };

      const errorHandler: ErrorHandler = (error, _ctx) => {
        console.error(error);
      };

      const middleware: Middleware = async (_ctx, next) => {
        await next();
      };

      expect(messageHandler).toBeDefined();
      expect(textHandler).toBeDefined();
      expect(commandHandler).toBeDefined();
      expect(errorHandler).toBeDefined();
      expect(middleware).toBeDefined();
    });
  });

  describe('Instantiation', () => {
    it('should allow creating Bot instance from exported class', () => {
      const bot = new Bot('test-token');
      expect(bot).toBeInstanceOf(Bot);
    });

    it('should allow creating ConsoleLogger instance', () => {
      const logger = new ConsoleLogger('info');
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should allow creating error instances', () => {
      const botError = new BotError(400, 'Bad request');
      const initError = new InitializationError('Init failed');
      const connError = new ConnectionError('Connection failed');
      const validError = new ValidationError('Validation failed');

      expect(botError).toBeInstanceOf(BotError);
      expect(initError).toBeInstanceOf(InitializationError);
      expect(connError).toBeInstanceOf(ConnectionError);
      expect(validError).toBeInstanceOf(ValidationError);
    });
  });

  describe('Custom Logger Implementation', () => {
    it('should allow implementing custom Logger interface', () => {
      class CustomLogger implements Logger {
        debug(_message: string, ..._args: any[]): void {
          // Custom implementation
        }
        info(_message: string, ..._args: any[]): void {
          // Custom implementation
        }
        error(_message: string, ..._args: any[]): void {
          // Custom implementation
        }
      }

      const logger = new CustomLogger();
      expect(logger).toBeDefined();
      
      // Verify it can be used with Bot
      const bot = new Bot('test-token', { logger });
      expect(bot).toBeInstanceOf(Bot);
    });
  });
});
