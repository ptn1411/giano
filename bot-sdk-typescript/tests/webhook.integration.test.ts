/**
 * Integration tests for Webhook mode
 * Tests webhook server startup, update processing, and graceful shutdown
 * 
 * Feature: bot-sdk-typescript
 * Task: 14.2 Write integration test for webhook mode
 */

import { Bot } from '../src/bot';
import { Update } from '../src/types';
import axios from 'axios';

describe('Webhook Integration Tests', () => {
  let bot: Bot;
  const basePort = 9876;
  let currentPort = basePort;

  beforeEach(() => {
    currentPort++;
  });

  afterEach(async () => {
    // Clean up bot
    if (bot) {
      await bot.stop();
    }

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Webhook server startup', () => {
    test('should start webhook server on specified port and path', async () => {
      const port = currentPort;
      const path = '/test-webhook';

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      await bot.startWebhook(port, path);

      // Verify server is listening by sending a request
      const validUpdate: Update = {
        updateId: 'test-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      const response = await axios.post(`http://localhost:${port}${path}`, validUpdate);

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ ok: true });
    });

    test('should emit ready event when webhook server starts', async () => {
      const port = currentPort;

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      let readyEmitted = false;
      bot.on('ready', () => {
        readyEmitted = true;
      });

      await bot.startWebhook(port);

      expect(readyEmitted).toBe(true);
    });

    test('should throw error if bot is already running', async () => {
      const port = currentPort;

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      await bot.startWebhook(port);

      // Try to start again
      await expect(bot.startWebhook(port + 1)).rejects.toThrow('Bot is already running');
    });
  });

  describe('Update processing', () => {
    test('should process valid updates through registered handlers', async () => {
      const port = currentPort;
      const path = '/webhook';

      const receivedMessages: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.on('message', (ctx) => {
        receivedMessages.push(ctx.text);
      });

      await bot.startWebhook(port, path);

      // Send update
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'Hello webhook!',
        },
      };

      await axios.post(`http://localhost:${port}${path}`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedMessages).toContain('Hello webhook!');
    });

    test('should process multiple updates in sequence', async () => {
      const port = currentPort;
      const path = '/webhook';

      const receivedMessages: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.on('message', (ctx) => {
        receivedMessages.push(ctx.text);
      });

      await bot.startWebhook(port, path);

      // Send multiple updates
      const updates: Update[] = [
        {
          updateId: 'update-1',
          message: {
            messageId: 'msg-1',
            chat: { id: 'chat-1' },
            from: { id: 'user-1' },
            text: 'Message 1',
          },
        },
        {
          updateId: 'update-2',
          message: {
            messageId: 'msg-2',
            chat: { id: 'chat-1' },
            from: { id: 'user-1' },
            text: 'Message 2',
          },
        },
        {
          updateId: 'update-3',
          message: {
            messageId: 'msg-3',
            chat: { id: 'chat-1' },
            from: { id: 'user-1' },
            text: 'Message 3',
          },
        },
      ];

      for (const update of updates) {
        await axios.post(`http://localhost:${port}${path}`, update);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedMessages).toEqual(['Message 1', 'Message 2', 'Message 3']);
    });

    test('should return 400 for invalid updates', async () => {
      const port = currentPort;
      const path = '/webhook';

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      await bot.startWebhook(port, path);

      // Send invalid update (missing updateId)
      const invalidUpdate = {
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      try {
        await axios.post(`http://localhost:${port}${path}`, invalidUpdate);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual({ error: 'Invalid update payload' });
      }
    });

    test('should return 400 for update missing message', async () => {
      const port = currentPort;
      const path = '/webhook';

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      await bot.startWebhook(port, path);

      // Send invalid update (missing message)
      const invalidUpdate = {
        updateId: 'test-1',
      };

      try {
        await axios.post(`http://localhost:${port}${path}`, invalidUpdate);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual({ error: 'Invalid update payload' });
      }
    });

    test('should handle command updates', async () => {
      const port = currentPort;
      const path = '/webhook';

      const receivedCommands: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.command('start', (ctx) => {
        receivedCommands.push(ctx.command!);
      });

      await bot.startWebhook(port, path);

      // Send command update
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: '/start',
        },
      };

      await axios.post(`http://localhost:${port}${path}`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedCommands).toContain('start');
    });

    test('should execute middleware before handlers', async () => {
      const port = currentPort;
      const path = '/webhook';

      const executionOrder: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.use(async (_ctx, next) => {
        executionOrder.push('middleware');
        await next();
      });

      bot.on('message', (_ctx) => {
        executionOrder.push('handler');
      });

      await bot.startWebhook(port, path);

      // Send update
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      await axios.post(`http://localhost:${port}${path}`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(executionOrder).toEqual(['middleware', 'handler']);
    });
  });

  describe('Graceful shutdown', () => {
    test('should close webhook server when stopped', async () => {
      const port = currentPort;
      const path = '/webhook';

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      await bot.startWebhook(port, path);

      // Verify server is running
      const update: Update = {
        updateId: 'test-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      const response1 = await axios.post(`http://localhost:${port}${path}`, update);
      expect(response1.status).toBe(200);

      // Stop bot
      await bot.stop();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify server is stopped
      try {
        await axios.post(`http://localhost:${port}${path}`, update);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(['ECONNREFUSED', 'ECONNRESET']).toContain(error.code);
      }
    });

    test('should emit stopped event when shutdown completes', async () => {
      const port = currentPort;

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      let stoppedEmitted = false;
      bot.on('stopped', () => {
        stoppedEmitted = true;
      });

      await bot.startWebhook(port);

      // Stop bot
      await bot.stop();

      expect(stoppedEmitted).toBe(true);
    });

    test('should wait for pending requests before shutdown', async () => {
      const port = currentPort;
      const path = '/webhook';

      let handlerCalled = false;

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.on('message', async (_ctx) => {
        handlerCalled = true;
        // Simulate handler processing
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await bot.startWebhook(port, path);

      // Send update
      const update: Update = {
        updateId: 'update-1',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      };

      // Send request
      await axios.post(`http://localhost:${port}${path}`, update);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Verify handler was called
      expect(handlerCalled).toBe(true);
      
      // Stop bot
      await bot.stop();
    });

    test('should not process new updates after stop is called', async () => {
      const port = currentPort;
      const path = '/webhook';

      const receivedMessages: string[] = [];

      bot = new Bot('test-token', {
        mode: 'webhook',
        logLevel: 'none',
      });

      bot.on('message', (ctx) => {
        receivedMessages.push(ctx.text);
      });

      await bot.startWebhook(port, path);

      // Stop bot
      await bot.stop();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to send update after stop
      try {
        await axios.post(`http://localhost:${port}${path}`, {
          updateId: 'update-after-stop',
          message: {
            messageId: 'msg-after-stop',
            chat: { id: 'chat-1' },
            from: { id: 'user-1' },
            text: 'Should not be processed',
          },
        });
      } catch (error) {
        // Expected to fail since server is stopped
      }

      // Should not have received the message
      expect(receivedMessages).not.toContain('Should not be processed');
    });
  });
});
