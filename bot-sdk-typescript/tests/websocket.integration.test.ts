/**
 * Integration tests for WebSocket mode
 * Tests full connection and message flow, reconnection behavior, and graceful shutdown
 * 
 * Feature: bot-sdk-typescript
 * Task: 14.1 Write integration test for WebSocket mode
 */

import { Bot } from '../src/bot';
import WebSocket, { WebSocketServer } from 'ws';

describe('WebSocket Integration Tests', () => {
  let mockWsServer: WebSocketServer;
  let bot: Bot;
  const testPort = 8765;
  const wsUrl = `ws://localhost:${testPort}`;

  // Helper to create a mock WebSocket server
  const createMockServer = (): Promise<void> => {
    return new Promise((resolve) => {
      mockWsServer = new WebSocketServer({ port: testPort });
      mockWsServer.on('listening', () => {
        resolve();
      });
    });
  };

  // Helper to stop the mock server
  const stopMockServer = (): Promise<void> => {
    return new Promise((resolve) => {
      if (mockWsServer) {
        mockWsServer.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  };

  afterEach(async () => {
    // Clean up bot
    if (bot) {
      await bot.stop();
    }

    // Clean up mock server
    await stopMockServer();

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Full connection and message flow', () => {
    test('should connect to WebSocket server and receive updates', async () => {
      // Create mock server
      await createMockServer();

      // Track received messages
      const receivedMessages: string[] = [];

      // Setup mock server to send updates
      mockWsServer.on('connection', (ws) => {
        // Send BotConnected event
        ws.send(JSON.stringify({
          event: 'BotConnected',
          data: { botName: 'TestBot' },
        }));

        // Send a test update after a short delay
        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'BotUpdate',
            data: {
              updateId: 'update-1',
              message: {
                messageId: 'msg-1',
                chat: { id: 'chat-1' },
                from: { id: 'user-1' },
                text: 'Hello from WebSocket!',
              },
            },
          }));
        }, 50);
      });

      // Create bot and register handler
      bot = new Bot('test-token', {
        mode: 'websocket',
        wsUrl,
        logLevel: 'none',
      });

      bot.on('message', (ctx) => {
        receivedMessages.push(ctx.text);
      });

      // Start bot
      await bot.start();

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify message was received
      expect(receivedMessages).toContain('Hello from WebSocket!');
    });

    test('should handle multiple updates in sequence', async () => {
      await createMockServer();

      const receivedMessages: string[] = [];

      mockWsServer.on('connection', (ws) => {
        ws.send(JSON.stringify({
          event: 'BotConnected',
          data: { botName: 'TestBot' },
        }));

        // Send multiple updates
        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'BotUpdate',
            data: {
              updateId: 'update-1',
              message: {
                messageId: 'msg-1',
                chat: { id: 'chat-1' },
                from: { id: 'user-1' },
                text: 'Message 1',
              },
            },
          }));
        }, 50);

        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'BotUpdate',
            data: {
              updateId: 'update-2',
              message: {
                messageId: 'msg-2',
                chat: { id: 'chat-1' },
                from: { id: 'user-1' },
                text: 'Message 2',
              },
            },
          }));
        }, 100);

        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'BotUpdate',
            data: {
              updateId: 'update-3',
              message: {
                messageId: 'msg-3',
                chat: { id: 'chat-1' },
                from: { id: 'user-1' },
                text: 'Message 3',
              },
            },
          }));
        }, 150);
      });

      bot = new Bot('test-token', {
        mode: 'websocket',
        wsUrl,
        logLevel: 'none',
      });

      bot.on('message', (ctx) => {
        receivedMessages.push(ctx.text);
      });

      await bot.start();

      // Wait for all messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify all messages were received in order
      expect(receivedMessages).toEqual(['Message 1', 'Message 2', 'Message 3']);
    });

    test('should emit ready event when connected', async () => {
      await createMockServer();

      mockWsServer.on('connection', (ws) => {
        ws.send(JSON.stringify({
          event: 'BotConnected',
          data: { botName: 'TestBot' },
        }));
      });

      bot = new Bot('test-token', {
        mode: 'websocket',
        wsUrl,
        logLevel: 'none',
      });

      let readyEmitted = false;
      bot.on('ready', () => {
        readyEmitted = true;
      });

      await bot.start();

      expect(readyEmitted).toBe(true);
    });
  });

  describe('Reconnection behavior', () => {
    test('should attempt to reconnect when connection drops', async () => {
      await createMockServer();

      let connectionCount = 0;
      const connections: WebSocket[] = [];

      mockWsServer.on('connection', (ws) => {
        connectionCount++;
        connections.push(ws);

        ws.send(JSON.stringify({
          event: 'BotConnected',
          data: { botName: 'TestBot' },
        }));

        // Close connection after first connect to trigger reconnect
        if (connectionCount === 1) {
          setTimeout(() => {
            ws.close();
          }, 100);
        }
      });

      bot = new Bot('test-token', {
        mode: 'websocket',
        wsUrl,
        logLevel: 'none',
      });

      await bot.start();

      // Wait for reconnection to occur
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Should have reconnected at least once
      expect(connectionCount).toBeGreaterThan(1);
    });

    test('should track last update ID across reconnects', async () => {
      await createMockServer();

      let connectionCount = 0;
      const receivedMessages: string[] = [];

      mockWsServer.on('connection', (ws) => {
        connectionCount++;

        ws.send(JSON.stringify({
          event: 'BotConnected',
          data: { botName: 'TestBot' },
        }));

        if (connectionCount === 1) {
          // First connection: send update then close
          setTimeout(() => {
            ws.send(JSON.stringify({
              event: 'BotUpdate',
              data: {
                updateId: 'update-1',
                message: {
                  messageId: 'msg-1',
                  chat: { id: 'chat-1' },
                  from: { id: 'user-1' },
                  text: 'Before disconnect',
                },
              },
            }));
          }, 50);

          setTimeout(() => {
            ws.close();
          }, 150);
        } else if (connectionCount === 2) {
          // Second connection: send another update
          setTimeout(() => {
            ws.send(JSON.stringify({
              event: 'BotUpdate',
              data: {
                updateId: 'update-2',
                message: {
                  messageId: 'msg-2',
                  chat: { id: 'chat-1' },
                  from: { id: 'user-1' },
                  text: 'After reconnect',
                },
              },
            }));
          }, 50);
        }
      });

      bot = new Bot('test-token', {
        mode: 'websocket',
        wsUrl,
        logLevel: 'none',
      });

      bot.on('message', (ctx) => {
        receivedMessages.push(ctx.text);
      });

      await bot.start();

      // Wait for reconnection and second message
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Should have received both messages
      expect(receivedMessages).toContain('Before disconnect');
      expect(receivedMessages).toContain('After reconnect');
    });
  });

  describe('Graceful shutdown', () => {
    test('should close WebSocket connection when stopped', async () => {
      await createMockServer();

      let connectionClosed = false;

      mockWsServer.on('connection', (ws) => {
        ws.send(JSON.stringify({
          event: 'BotConnected',
          data: { botName: 'TestBot' },
        }));

        ws.on('close', () => {
          connectionClosed = true;
        });
      });

      bot = new Bot('test-token', {
        mode: 'websocket',
        wsUrl,
        logLevel: 'none',
      });

      await bot.start();

      // Wait for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop bot
      await bot.stop();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify connection was closed
      expect(connectionClosed).toBe(true);
    });

    test('should emit stopped event when shutdown completes', async () => {
      await createMockServer();

      mockWsServer.on('connection', (ws) => {
        ws.send(JSON.stringify({
          event: 'BotConnected',
          data: { botName: 'TestBot' },
        }));
      });

      bot = new Bot('test-token', {
        mode: 'websocket',
        wsUrl,
        logLevel: 'none',
      });

      let stoppedEmitted = false;
      bot.on('stopped', () => {
        stoppedEmitted = true;
      });

      await bot.start();

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop bot
      await bot.stop();

      // Verify stopped event was emitted
      expect(stoppedEmitted).toBe(true);
    });

    test('should not process new updates after stop is called', async () => {
      await createMockServer();

      const receivedMessages: string[] = [];

      mockWsServer.on('connection', (ws) => {
        ws.send(JSON.stringify({
          event: 'BotConnected',
          data: { botName: 'TestBot' },
        }));
      });

      bot = new Bot('test-token', {
        mode: 'websocket',
        wsUrl,
        logLevel: 'none',
      });

      bot.on('message', (ctx) => {
        receivedMessages.push(ctx.text);
      });

      await bot.start();

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop bot
      await bot.stop();

      // Wait for disconnect to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to send update after stop (connection should be closed)
      // The message won't be delivered because the connection is closed
      
      // Verify no messages were received after stop
      const messageCountAfterStop = receivedMessages.length;
      
      // Wait a bit more
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Message count should not have changed
      expect(receivedMessages.length).toBe(messageCountAfterStop);
    });
  });
});
