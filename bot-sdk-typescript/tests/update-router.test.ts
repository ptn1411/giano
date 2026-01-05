// Tests for UpdateRouter class
import { UpdateRouter, MessageHandler, CommandHandler, Middleware } from '../src/update-router';
import { ApiClient } from '../src/api-client';
import { ConsoleLogger, Update } from '../src/types';
import { Context } from '../src/context';

// Mock ApiClient
const mockApiClient = {
  sendMessage: jest.fn(),
} as unknown as ApiClient;

const mockLogger = new ConsoleLogger('none');

// Helper to create test update
function createUpdate(text: string): Update {
  return {
    updateId: '123',
    message: {
      messageId: 'msg-1',
      chat: { id: 'chat-1' },
      from: { id: 'user-1' },
      text,
    },
  };
}

describe('UpdateRouter', () => {
  let router: UpdateRouter;

  beforeEach(() => {
    router = new UpdateRouter(mockApiClient, mockLogger);
    jest.clearAllMocks();
  });

  describe('Handler Registration', () => {
    test('should register message handler', () => {
      const handler = jest.fn();
      router.on('message', handler);
      expect(router['messageHandlers']).toContain(handler);
    });

    test('should register text handler', () => {
      const handler = jest.fn();
      router.on('text', handler);
      expect(router['textHandlers']).toContain(handler);
    });

    test('should register general command handler', () => {
      const handler = jest.fn();
      router.on('command', handler);
      expect(router['generalCommandHandlers']).toContain(handler);
    });

    test('should register specific command handler', () => {
      const handler = jest.fn();
      router.command('start', handler);
      expect(router['commandHandlers'].get('start')).toContain(handler);
    });

    test('should normalize command to lowercase', () => {
      const handler = jest.fn();
      router.command('START', handler);
      expect(router['commandHandlers'].has('start')).toBe(true);
      expect(router['commandHandlers'].has('START')).toBe(false);
    });

    test('should register middleware', () => {
      const middleware = jest.fn();
      router.use(middleware);
      expect(router['middlewares']).toContain(middleware);
    });

    test('should register error handler', () => {
      const handler = jest.fn();
      router.onError(handler);
      expect(router['errorHandlers']).toContain(handler);
    });
  });

  describe('Handler Invocation Order', () => {
    test('should call message handlers in registration order', async () => {
      const calls: number[] = [];
      const handler1: MessageHandler = async () => { calls.push(1); };
      const handler2: MessageHandler = async () => { calls.push(2); };
      const handler3: MessageHandler = async () => { calls.push(3); };

      router.on('message', handler1);
      router.on('message', handler2);
      router.on('message', handler3);

      await router.route(createUpdate('hello'));

      expect(calls).toEqual([1, 2, 3]);
    });

    test('should call text handlers for non-command messages', async () => {
      const messageHandler = jest.fn();
      const textHandler = jest.fn();

      router.on('message', messageHandler);
      router.on('text', textHandler);

      await router.route(createUpdate('hello'));

      expect(messageHandler).toHaveBeenCalled();
      expect(textHandler).toHaveBeenCalled();
    });

    test('should not call text handlers for command messages', async () => {
      const messageHandler = jest.fn();
      const textHandler = jest.fn();

      router.on('message', messageHandler);
      router.on('text', textHandler);

      await router.route(createUpdate('/start'));

      expect(messageHandler).toHaveBeenCalled();
      expect(textHandler).not.toHaveBeenCalled();
    });
  });

  describe('Command Parsing', () => {
    test('should parse simple command', async () => {
      let capturedCtx: Context | undefined;
      const handler: CommandHandler = async (ctx) => { capturedCtx = ctx; };

      router.command('start', handler);
      await router.route(createUpdate('/start'));

      expect(capturedCtx?.command).toBe('start');
      expect(capturedCtx?.args).toEqual([]);
    });

    test('should parse command with arguments', async () => {
      let capturedCtx: Context | undefined;
      const handler: CommandHandler = async (ctx) => { capturedCtx = ctx; };

      router.command('echo', handler);
      await router.route(createUpdate('/echo hello world'));

      expect(capturedCtx?.command).toBe('echo');
      expect(capturedCtx?.args).toEqual(['hello', 'world']);
    });

    test('should match commands case-insensitively', async () => {
      const handler = jest.fn();

      router.command('start', handler);
      
      await router.route(createUpdate('/START'));
      expect(handler).toHaveBeenCalledTimes(1);

      await router.route(createUpdate('/Start'));
      expect(handler).toHaveBeenCalledTimes(2);

      await router.route(createUpdate('/start'));
      expect(handler).toHaveBeenCalledTimes(3);
    });

    test('should call general command handlers for all commands', async () => {
      const generalHandler = jest.fn();
      const specificHandler = jest.fn();

      router.on('command', generalHandler);
      router.command('start', specificHandler);

      await router.route(createUpdate('/start'));

      expect(generalHandler).toHaveBeenCalled();
      expect(specificHandler).toHaveBeenCalled();
    });

    test('should call general message handlers even for unmatched commands', async () => {
      const messageHandler = jest.fn();

      router.on('message', messageHandler);

      await router.route(createUpdate('/unknown'));

      expect(messageHandler).toHaveBeenCalled();
    });

    test('should not parse text without slash as command', async () => {
      const commandHandler = jest.fn();
      const textHandler = jest.fn();

      router.on('command', commandHandler);
      router.on('text', textHandler);

      await router.route(createUpdate('start'));

      expect(commandHandler).not.toHaveBeenCalled();
      expect(textHandler).toHaveBeenCalled();
    });

    test('should handle slash-only message', async () => {
      const commandHandler = jest.fn();
      const textHandler = jest.fn();

      router.on('command', commandHandler);
      router.on('text', textHandler);

      await router.route(createUpdate('/'));

      expect(commandHandler).not.toHaveBeenCalled();
      expect(textHandler).toHaveBeenCalled();
    });
  });

  describe('Middleware', () => {
    test('should call middleware before handlers', async () => {
      const calls: string[] = [];
      
      const middleware: Middleware = async (_ctx, next) => {
        calls.push('middleware');
        await next();
      };
      
      const handler: MessageHandler = async () => {
        calls.push('handler');
      };

      router.use(middleware);
      router.on('message', handler);

      await router.route(createUpdate('hello'));

      expect(calls).toEqual(['middleware', 'handler']);
    });

    test('should call multiple middleware in order', async () => {
      const calls: number[] = [];
      
      const middleware1: Middleware = async (_ctx, next) => {
        calls.push(1);
        await next();
      };
      
      const middleware2: Middleware = async (_ctx, next) => {
        calls.push(2);
        await next();
      };
      
      const middleware3: Middleware = async (_ctx, next) => {
        calls.push(3);
        await next();
      };

      router.use(middleware1);
      router.use(middleware2);
      router.use(middleware3);

      await router.route(createUpdate('hello'));

      expect(calls).toEqual([1, 2, 3]);
    });

    test('should stop processing if middleware does not call next', async () => {
      const handler = jest.fn();
      
      const middleware: Middleware = async (_ctx, _next) => {
        // Don't call next()
      };

      router.use(middleware);
      router.on('message', handler);

      await router.route(createUpdate('hello'));

      expect(handler).not.toHaveBeenCalled();
    });

    test('should allow middleware to modify context', async () => {
      let capturedText: string = '';
      
      const middleware: Middleware = async (ctx, next) => {
        (ctx as Context & { customField?: string }).customField = 'modified';
        await next();
      };
      
      const handler: MessageHandler = async (ctx) => {
        capturedText = (ctx as Context & { customField?: string }).customField || '';
      };

      router.use(middleware);
      router.on('message', handler);

      await router.route(createUpdate('hello'));

      expect(capturedText).toBe('modified');
    });
  });

  describe('Error Handling', () => {
    test('should catch handler errors and continue processing', async () => {
      const handler1 = jest.fn().mockRejectedValue(new Error('Handler 1 error'));
      const handler2 = jest.fn();

      router.on('message', handler1);
      router.on('message', handler2);

      await router.route(createUpdate('hello'));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('should call error handlers when handler throws', async () => {
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const errorHandler = jest.fn();

      router.on('message', handler);
      router.onError(errorHandler);

      await router.route(createUpdate('hello'));

      expect(errorHandler).toHaveBeenCalledWith(error, expect.any(Object));
    });

    test('should call multiple error handlers', async () => {
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);
      const errorHandler1 = jest.fn();
      const errorHandler2 = jest.fn();

      router.on('message', handler);
      router.onError(errorHandler1);
      router.onError(errorHandler2);

      await router.route(createUpdate('hello'));

      expect(errorHandler1).toHaveBeenCalled();
      expect(errorHandler2).toHaveBeenCalled();
    });

    test('should catch errors in middleware', async () => {
      const error = new Error('Middleware error');
      const middleware: Middleware = async () => {
        throw error;
      };
      const errorHandler = jest.fn();

      router.use(middleware);
      router.onError(errorHandler);

      await router.route(createUpdate('hello'));

      expect(errorHandler).toHaveBeenCalledWith(error, undefined);
    });

    test('should catch errors in error handlers', async () => {
      const consoleErrorSpy = jest.spyOn(mockLogger, 'error').mockImplementation();
      
      const error = new Error('Handler error');
      const handler = jest.fn().mockRejectedValue(error);
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('Error handler error');
      });

      router.on('message', handler);
      router.onError(errorHandler);

      await router.route(createUpdate('hello'));

      expect(errorHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in error handler:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    test('should log to logger if no error handlers registered', async () => {
      const consoleErrorSpy = jest.spyOn(mockLogger, 'error').mockImplementation();
      
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);

      router.on('message', handler);

      await router.route(createUpdate('hello'));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Unhandled error:', error);
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Context Creation', () => {
    test('should create context with update and apiClient', async () => {
      let capturedCtx: Context | undefined;
      const handler: MessageHandler = async (ctx) => { capturedCtx = ctx; };

      router.on('message', handler);
      await router.route(createUpdate('hello'));

      expect(capturedCtx).toBeDefined();
      expect(capturedCtx?.updateId).toBe('123');
      expect(capturedCtx?.message.text).toBe('hello');
    });
  });
});
