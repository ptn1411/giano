import { Bot } from '../src/bot';
import { InitializationError } from '../src/errors';

describe('Bot Client', () => {
  describe('Constructor', () => {
    test('should create bot with valid token', () => {
      const bot = new Bot('test-token');
      expect(bot).toBeInstanceOf(Bot);
    });

    test('should throw error with empty token', () => {
      expect(() => new Bot('')).toThrow(InitializationError);
      expect(() => new Bot('')).toThrow('Bot token is required and must be non-empty');
    });

    test('should throw error with whitespace-only token', () => {
      expect(() => new Bot('   ')).toThrow(InitializationError);
    });

    test('should accept custom options', () => {
      const bot = new Bot('test-token', {
        mode: 'webhook',
        apiBaseUrl: 'http://example.com',
        wsUrl: 'ws://example.com',
        logLevel: 'debug',
        retryAttempts: 5,
        retryDelay: 2000,
      });
      expect(bot).toBeInstanceOf(Bot);
    });

    test('should use default options when not provided', () => {
      const bot = new Bot('test-token');
      expect(bot).toBeInstanceOf(Bot);
    });
  });

  describe('Handler Registration', () => {
    test('should register message handler', () => {
      const bot = new Bot('test-token');
      const handler = jest.fn();
      expect(() => bot.on('message', handler)).not.toThrow();
    });

    test('should register text handler', () => {
      const bot = new Bot('test-token');
      const handler = jest.fn();
      expect(() => bot.on('text', handler)).not.toThrow();
    });

    test('should register command handler', () => {
      const bot = new Bot('test-token');
      const handler = jest.fn();
      expect(() => bot.on('command', handler)).not.toThrow();
    });

    test('should register specific command handler', () => {
      const bot = new Bot('test-token');
      const handler = jest.fn();
      expect(() => bot.command('start', handler)).not.toThrow();
    });

    test('should register middleware', () => {
      const bot = new Bot('test-token');
      const middleware = jest.fn();
      expect(() => bot.use(middleware)).not.toThrow();
    });

    test('should register error handler', () => {
      const bot = new Bot('test-token');
      const handler = jest.fn();
      expect(() => bot.on('error', handler)).not.toThrow();
    });

    test('should register ready handler', () => {
      const bot = new Bot('test-token');
      const handler = jest.fn();
      expect(() => bot.on('ready', handler)).not.toThrow();
    });

    test('should register stopped handler', () => {
      const bot = new Bot('test-token');
      const handler = jest.fn();
      expect(() => bot.on('stopped', handler)).not.toThrow();
    });
  });
});
