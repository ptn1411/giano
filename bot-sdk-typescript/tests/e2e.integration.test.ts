/**
 * End-to-end integration tests
 * Tests sending and receiving messages, command handling, and middleware execution
 * 
 * Feature: bot-sdk-typescript
 * Task: 14.3 Write integration test for end-to-end message flow
 */

import { Bot } from '../src/bot';
import { Update, Message } from '../src/types';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

describe('End-to-End Integration Tests', () => {
  let bot: Bot;
  let mockAxios: MockAdapter;
  const basePort = 10987;
  let currentPort = basePort;

  beforeEach(() => {
    currentPort++;
    // Create axios mock for API calls only (not webhook server calls)
    mockAxios = new MockAdapter(axios, { onNoMatch: 'passthrough' });
  });

  afterEach(async () => {
    // Clean up bot
    if (bot) {
      await bot.stop();
    }

    // Reset axios mock
    mockAxios.restore();

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Sending and receiving messages', () => {
    test('should send message via API and receive response', async () => {
      const port = currentPort;

      // Mock API response
      const mockMessage: Message = {
        messageId: 'sent-msg-1',
        chat: { id: 'chat-1' },
        from: { id: 'bot-1' },
        text: 'Hello from bot!',
      };

      mockAxios.onPost(/\/bot.*\/sendMessage/).reply(200, mockMessage);

      bot = new Bot('test-token', {
        mode: 'webhook',
        apiBaseUrl: 'http://localhost:3000',
        logLevel: 'none',
      });

      await bot.startWebhook(port);

      // Send message
      const result = await bot.sendMessage('chat-1', 'Hello from bot!');

      expect(result).toEqual(mockMessage);
    });

    test('should receive message and send reply', async () => {
      const port = currentPort;

      // Mock API response for reply
      const mockReply: Message = {
        messageId: 'reply-msg-1',
        chat: { id: 'chat-1' },
        from: { id: 'bot-1' },
        text: 'Reply text',
      };

      mockAxios.onPost(/\/bot.*\/sendMessage/).reply(200, mockReply);

      bot = new Bot('test-token', {
        mode: 'webhook',
        apiBaseUrl: 'http://localhost:3000',
        logLevel: 'none',
      });

      let replySent = false;

      bot.on('message', async (ctx) => {
        await ctx.reply('Reply text');
        replySent = true;
      });

      await bot.startWebhook(port);

      // Send incoming message
      const incomingUpdate: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'Hello bot!',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, incomingUpdate);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(replySent).toBe(true);
    });

    test('should handle message with inline buttons', async () => {
      const port = currentPort;

      // Mock API response
      const mockMessage: Message = {
        messageId: 'msg-with-buttons',
        chat: { id: 'chat-1' },
        from: { id: 'bot-1' },
        text: 'Choose an option',
      };

      mockAxios.onPost(/\/bot.*\/sendMessage/).reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.inline_keyboard).toBeDefined();
        expect(data.inline_keyboard).toHaveLength(1);
        expect(data.inline_keyboard[0]).toHaveLength(2);
        return [200, mockMessage];
      });

      bot = new Bot('test-token', {
        mode: 'webhook',
        apiBaseUrl: 'http://localhost:3000',
        logLevel: 'none',
      });

      bot.on('message', async (ctx) => {
        await ctx.replyWithButtons('Choose an option', [
          [
            { text: 'Option 1', callbackData: 'opt1' },
            { text: 'Option 2', callbackData: 'opt2' },
          ],
        ]);
      });

      await bot.startWebhook(port);

      // Send incoming message
      const incomingUpdate: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'Show options',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, incomingUpdate);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe('Command handling', () => {
    test('should handle /start command', async () => {
      const port = currentPort;

      let commandReceived = false;
      let commandName = '';

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.command('start', (ctx) => {
        commandReceived = true;
        commandName = ctx.command!;
      });

      await bot.startWebhook(port);

      // Send /start command
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: '/start',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(commandReceived).toBe(true);
      expect(commandName).toBe('start');
    });

    test('should handle command with arguments', async () => {
      const port = currentPort;

      let receivedArgs: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.command('echo', (ctx) => {
        receivedArgs = ctx.args || [];
      });

      await bot.startWebhook(port);

      // Send /echo command with arguments
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: '/echo hello world test',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedArgs).toEqual(['hello', 'world', 'test']);
    });

    test('should handle case-insensitive commands', async () => {
      const port = currentPort;

      const receivedCommands: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.command('help', (ctx) => {
        receivedCommands.push(ctx.command!);
      });

      await bot.startWebhook(port);

      // Send commands with different cases
      const commands = ['/help', '/HELP', '/Help', '/HeLp'];

      for (const cmd of commands) {
        const update: Update = {
          updateId: `update-${cmd}`,
          message: {
            messageId: `msg-${cmd}`,
            chat: { id: 'chat-1' },
            from: { id: 'user-1' },
            text: cmd,
          },
        };

        await axios.post(`http://localhost:${port}/webhook`, update);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // All should be normalized to lowercase
      expect(receivedCommands).toEqual(['help', 'help', 'help', 'help']);
    });

    test('should handle multiple commands', async () => {
      const port = currentPort;

      const receivedCommands: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.command('start', (_ctx) => {
        receivedCommands.push('start');
      });

      bot.command('help', (_ctx) => {
        receivedCommands.push('help');
      });

      bot.command('settings', (_ctx) => {
        receivedCommands.push('settings');
      });

      await bot.startWebhook(port);

      // Send different commands
      const commands = ['/start', '/help', '/settings'];

      for (const cmd of commands) {
        const update: Update = {
          updateId: `update-${cmd}`,
          message: {
            messageId: `msg-${cmd}`,
            chat: { id: 'chat-1' },
            from: { id: 'user-1' },
            text: cmd,
          },
        };

        await axios.post(`http://localhost:${port}/webhook`, update);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedCommands).toEqual(['start', 'help', 'settings']);
    });

    test('should send reply from command handler', async () => {
      const port = currentPort;

      // Mock API response
      const mockReply: Message = {
        messageId: 'reply-1',
        chat: { id: 'chat-1' },
        from: { id: 'bot-1' },
        text: 'Welcome!',
      };

      mockAxios.onPost(/\/bot.*\/sendMessage/).reply(200, mockReply);

      bot = new Bot('test-token', {
        mode: 'webhook',
        apiBaseUrl: 'http://localhost:3000',
        logLevel: 'none',
      });

      let replySent = false;

      bot.command('start', async (ctx) => {
        await ctx.reply('Welcome!');
        replySent = true;
      });

      await bot.startWebhook(port);

      // Send /start command
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: '/start',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(replySent).toBe(true);
    });
  });

  describe('Middleware execution', () => {
    test('should execute middleware before handlers', async () => {
      const port = currentPort;

      const executionOrder: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.use(async (_ctx, next) => {
        executionOrder.push('middleware-1');
        await next();
      });

      bot.use(async (_ctx, next) => {
        executionOrder.push('middleware-2');
        await next();
      });

      bot.on('message', (_ctx) => {
        executionOrder.push('handler');
      });

      await bot.startWebhook(port);

      // Send message
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(executionOrder).toEqual(['middleware-1', 'middleware-2', 'handler']);
    });

    test('should stop processing if middleware does not call next', async () => {
      const port = currentPort;

      let handlerCalled = false;

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.use(async (_ctx, _next) => {
        // Don't call next() - stop processing
      });

      bot.on('message', (_ctx) => {
        handlerCalled = true;
      });

      await bot.startWebhook(port);

      // Send message
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handlerCalled).toBe(false);
    });

    test('should allow middleware to modify context', async () => {
      const port = currentPort;

      let modifiedValue = '';

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.use(async (ctx, next) => {
        // Add custom property to context
        (ctx as any).customValue = 'modified';
        await next();
      });

      bot.on('message', (ctx) => {
        modifiedValue = (ctx as any).customValue;
      });

      await bot.startWebhook(port);

      // Send message
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(modifiedValue).toBe('modified');
    });

    test('should handle authentication middleware', async () => {
      const port = currentPort;

      const authorizedUsers = ['user-1', 'user-2'];
      const processedMessages: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      // Authentication middleware
      bot.use(async (ctx, next) => {
        if (authorizedUsers.includes(ctx.userId)) {
          await next();
        }
        // Don't call next() for unauthorized users
      });

      bot.on('message', (ctx) => {
        processedMessages.push(ctx.text);
      });

      await bot.startWebhook(port);

      // Send messages from authorized and unauthorized users
      const updates: Update[] = [
        {
          updateId: 'update-1',
          message: {
            messageId: 'msg-1',
            chat: { id: 'chat-1' },
            from: { id: 'user-1' }, // Authorized
            text: 'Message from user-1',
          },
        },
        {
          updateId: 'update-2',
          message: {
            messageId: 'msg-2',
            chat: { id: 'chat-1' },
            from: { id: 'user-3' }, // Unauthorized
            text: 'Message from user-3',
          },
        },
        {
          updateId: 'update-3',
          message: {
            messageId: 'msg-3',
            chat: { id: 'chat-1' },
            from: { id: 'user-2' }, // Authorized
            text: 'Message from user-2',
          },
        },
      ];

      for (const update of updates) {
        await axios.post(`http://localhost:${port}/webhook`, update);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Only authorized users' messages should be processed
      expect(processedMessages).toEqual(['Message from user-1', 'Message from user-2']);
    });

    test('should handle logging middleware', async () => {
      const port = currentPort;

      const logs: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      // Logging middleware
      bot.use(async (ctx, next) => {
        logs.push(`Before: ${ctx.text}`);
        await next();
        logs.push(`After: ${ctx.text}`);
      });

      bot.on('message', (ctx) => {
        logs.push(`Handler: ${ctx.text}`);
      });

      await bot.startWebhook(port);

      // Send message
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test message',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(logs).toEqual([
        'Before: test message',
        'Handler: test message',
        'After: test message',
      ]);
    });
  });

  describe('Complex scenarios', () => {
    test('should handle message with middleware, command handler, and reply', async () => {
      const port = currentPort;

      const executionFlow: string[] = [];

      // Mock API response
      const mockReply: Message = {
        messageId: 'reply-1',
        chat: { id: 'chat-1' },
        from: { id: 'bot-1' },
        text: 'Pong!',
      };

      mockAxios.onPost(/\/bot.*\/sendMessage/).reply(200, mockReply);

      bot = new Bot('test-token', {
        mode: 'webhook',
        apiBaseUrl: 'http://localhost:3000',
        logLevel: 'none',
      });

      // Middleware
      bot.use(async (_ctx, next) => {
        executionFlow.push('middleware');
        await next();
      });

      // Command handler
      bot.command('ping', async (ctx) => {
        executionFlow.push('command-handler');
        await ctx.reply('Pong!');
        executionFlow.push('reply-sent');
      });

      await bot.startWebhook(port);

      // Send /ping command
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: '/ping',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(executionFlow).toEqual(['middleware', 'command-handler', 'reply-sent']);
    });

    test('should handle multiple handlers for same message', async () => {
      const port = currentPort;

      const handlersCalled: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      // Multiple message handlers
      bot.on('message', (_ctx) => {
        handlersCalled.push('handler-1');
      });

      bot.on('message', (_ctx) => {
        handlersCalled.push('handler-2');
      });

      bot.on('text', (_ctx) => {
        handlersCalled.push('text-handler');
      });

      await bot.startWebhook(port);

      // Send message
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      await axios.post(`http://localhost:${port}/webhook`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handlersCalled).toEqual(['handler-1', 'handler-2', 'text-handler']);
    });
  });
});
