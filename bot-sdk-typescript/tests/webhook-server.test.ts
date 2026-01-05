// Tests for WebhookServer class
import { WebhookServer } from '../src/webhook-server';
import { UpdateRouter } from '../src/update-router';
import { ApiClient } from '../src/api-client';
import { ConsoleLogger, Update } from '../src/types';
import axios from 'axios';

describe('WebhookServer', () => {
  let webhookServer: WebhookServer | undefined;
  let updateRouter: UpdateRouter;
  let apiClient: ApiClient;
  let logger: ConsoleLogger;
  const basePort = 3456;
  let currentPort = basePort;
  const testPath = '/test-webhook';

  beforeEach(() => {
    currentPort++;
    logger = new ConsoleLogger('none');
    apiClient = new ApiClient('test-token', {
      token: 'test-token',
      mode: 'webhook',
      apiBaseUrl: 'http://localhost:3000',
      wsUrl: 'ws://localhost:3000',
      logLevel: 'none',
      logger,
      retryAttempts: 3,
      retryDelay: 1000,
    });
    updateRouter = new UpdateRouter(apiClient, logger);
  });

  afterEach(async () => {
    if (webhookServer) {
      await webhookServer.stop();
      webhookServer = undefined;
      // Wait for port to be released
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  describe('Constructor', () => {
    test('should create webhook server with provided parameters', () => {
      webhookServer = new WebhookServer(currentPort, testPath, updateRouter, logger);
      expect(webhookServer).toBeDefined();
    });
  });

  describe('start() and handleWebhook()', () => {
    test('should start HTTP server and handle valid update', async () => {
      webhookServer = new WebhookServer(currentPort, testPath, updateRouter, logger);
      await webhookServer.start();

      const validUpdate: Update = {
        updateId: 'test-123',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test message',
        },
      };

      const response = await axios.post(`http://localhost:${currentPort}${testPath}`, validUpdate);

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ ok: true });
    });

    test('should return 400 for payload missing updateId', async () => {
      webhookServer = new WebhookServer(currentPort, testPath, updateRouter, logger);
      await webhookServer.start();

      const invalidUpdate = {
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test message',
        },
      };

      try {
        await axios.post(`http://localhost:${currentPort}${testPath}`, invalidUpdate);
        fail('Should have thrown error');
      } catch (error: any) {
        if (error.response) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toEqual({ error: 'Invalid update payload' });
        } else {
          throw error;
        }
      }
    });

    test('should return 400 for payload missing message', async () => {
      webhookServer = new WebhookServer(currentPort, testPath, updateRouter, logger);
      await webhookServer.start();

      const invalidUpdate = {
        updateId: 'test-123',
      };

      try {
        await axios.post(`http://localhost:${currentPort}${testPath}`, invalidUpdate);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual({ error: 'Invalid update payload' });
      }
    });

    test('should route valid updates to UpdateRouter', async () => {
      webhookServer = new WebhookServer(currentPort, testPath, updateRouter, logger);
      await webhookServer.start();

      let handlerCalled = false;
      let receivedText = '';

      updateRouter.on('message', (ctx) => {
        handlerCalled = true;
        receivedText = ctx.message.text;
      });

      const validUpdate: Update = {
        updateId: 'test-456',
        message: {
          messageId: 'msg-2',
          chat: { id: 'chat-2' },
          from: { id: 'user-2' },
          text: 'hello world',
        },
      };

      await axios.post(`http://localhost:${currentPort}${testPath}`, validUpdate);

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handlerCalled).toBe(true);
      expect(receivedText).toBe('hello world');
    });
  });

  describe('stop()', () => {
    test('should close HTTP server gracefully', async () => {
      webhookServer = new WebhookServer(currentPort, testPath, updateRouter, logger);
      await webhookServer.start();

      // Verify server is running
      const response1 = await axios.post(`http://localhost:${currentPort}${testPath}`, {
        updateId: 'test-123',
        message: {
          messageId: 'msg-1',
          chat: { id: 'chat-1' },
          from: { id: 'user-1' },
          text: 'test',
        },
      });
      expect(response1.status).toBe(200);

      // Stop server
      await webhookServer.stop();
      webhookServer = undefined;

      // Give it a moment to fully close
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify server is stopped
      try {
        await axios.post(`http://localhost:${currentPort}${testPath}`, {
          updateId: 'test-123',
          message: {
            messageId: 'msg-1',
            chat: { id: 'chat-1' },
            from: { id: 'user-1' },
            text: 'test',
          },
        });
        fail('Should have thrown error');
      } catch (error: any) {
        // Either ECONNREFUSED or ECONNRESET is acceptable
        expect(['ECONNREFUSED', 'ECONNRESET']).toContain(error.code);
      }
    });
  });
});
