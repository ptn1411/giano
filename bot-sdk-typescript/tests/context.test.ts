// Unit tests for Context class
import { Context } from '../src/context';
import { ApiClient } from '../src/api-client';
import { Update, Message, Chat, User, InlineButton } from '../src/types';
import { ValidationError } from '../src/errors';

// Mock ApiClient
jest.mock('../src/api-client');

describe('Context', () => {
  let mockApiClient: jest.Mocked<ApiClient>;
  let testUpdate: Update;
  let testMessage: Message;

  beforeEach(() => {
    // Create mock API client
    mockApiClient = {
      sendMessage: jest.fn(),
    } as unknown as jest.Mocked<ApiClient>;

    // Create test message
    const testChat: Chat = { id: 'chat-123', type: 'private' };
    const testUser: User = { id: 'user-456', username: 'testuser' };
    testMessage = {
      messageId: 'msg-789',
      chat: testChat,
      from: testUser,
      text: 'Hello, bot!',
      timestamp: '2024-01-01T00:00:00Z',
    };

    // Create test update
    testUpdate = {
      updateId: 'update-001',
      message: testMessage,
    };
  });

  describe('Constructor', () => {
    it('should store update, message, and apiClient', () => {
      const ctx = new Context(testUpdate, mockApiClient);

      expect(ctx.updateId).toBe('update-001');
      expect(ctx.message).toBe(testMessage);
      expect(ctx.message.messageId).toBe('msg-789');
    });
  });

  describe('Convenience getters', () => {
    it('should provide chatId getter', () => {
      const ctx = new Context(testUpdate, mockApiClient);
      expect(ctx.chatId).toBe('chat-123');
    });

    it('should provide userId getter', () => {
      const ctx = new Context(testUpdate, mockApiClient);
      expect(ctx.userId).toBe('user-456');
    });

    it('should provide text getter', () => {
      const ctx = new Context(testUpdate, mockApiClient);
      expect(ctx.text).toBe('Hello, bot!');
    });
  });

  describe('reply()', () => {
    it('should call sendMessage with replyToId set', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const mockResponse = { ...testMessage, messageId: 'msg-reply' };
      mockApiClient.sendMessage.mockResolvedValue(mockResponse);

      await ctx.reply('Reply text');

      expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        'Reply text',
        { replyToId: 'msg-789' }
      );
    });

    it('should merge additional options with replyToId', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const mockResponse = { ...testMessage, messageId: 'msg-reply' };
      mockApiClient.sendMessage.mockResolvedValue(mockResponse);

      const buttons: InlineButton[][] = [[{ text: 'Button', callbackData: 'data' }]];
      await ctx.reply('Reply text', { inlineKeyboard: buttons });

      expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        'Reply text',
        { replyToId: 'msg-789', inlineKeyboard: buttons }
      );
    });
  });

  describe('send()', () => {
    it('should call sendMessage without replyToId', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const mockResponse = { ...testMessage, messageId: 'msg-send' };
      mockApiClient.sendMessage.mockResolvedValue(mockResponse);

      await ctx.send('Send text');

      expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        'Send text',
        undefined
      );
    });

    it('should pass options to sendMessage', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const mockResponse = { ...testMessage, messageId: 'msg-send' };
      mockApiClient.sendMessage.mockResolvedValue(mockResponse);

      const buttons: InlineButton[][] = [[{ text: 'Button', url: 'https://example.com' }]];
      await ctx.send('Send text', { inlineKeyboard: buttons });

      expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        'Send text',
        { inlineKeyboard: buttons }
      );
    });
  });

  describe('replyWithButtons()', () => {
    it('should call sendMessage with inline keyboard', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const mockResponse = { ...testMessage, messageId: 'msg-buttons' };
      mockApiClient.sendMessage.mockResolvedValue(mockResponse);

      const buttons: InlineButton[][] = [
        [{ text: 'Button 1', callbackData: 'data1' }],
        [{ text: 'Button 2', url: 'https://example.com' }],
      ];

      await ctx.replyWithButtons('Choose an option', buttons);

      expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        'Choose an option',
        {
          replyToId: 'msg-789',
          inlineKeyboard: buttons,
        }
      );
    });

    it('should validate buttons with callbackData', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const mockResponse = { ...testMessage, messageId: 'msg-callback' };
      mockApiClient.sendMessage.mockResolvedValue(mockResponse);

      const buttons: InlineButton[][] = [[{ text: 'Valid', callbackData: 'data' }]];

      await expect(ctx.replyWithButtons('Text', buttons)).resolves.toBeDefined();
    });

    it('should validate buttons with url', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const mockResponse = { ...testMessage, messageId: 'msg-url' };
      mockApiClient.sendMessage.mockResolvedValue(mockResponse);

      const buttons: InlineButton[][] = [[{ text: 'Valid', url: 'https://example.com' }]];

      await expect(ctx.replyWithButtons('Text', buttons)).resolves.toBeDefined();
    });

    it('should throw ValidationError if button has both callbackData and url', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const buttons: InlineButton[][] = [
        [{ text: 'Invalid', callbackData: 'data', url: 'https://example.com' }],
      ];

      await expect(ctx.replyWithButtons('Text', buttons)).rejects.toThrow(ValidationError);
      await expect(ctx.replyWithButtons('Text', buttons)).rejects.toThrow(
        'Button "Invalid" cannot have both callbackData and url'
      );
    });

    it('should throw ValidationError if button has neither callbackData nor url', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const buttons: InlineButton[][] = [[{ text: 'Invalid' }]];

      await expect(ctx.replyWithButtons('Text', buttons)).rejects.toThrow(ValidationError);
      await expect(ctx.replyWithButtons('Text', buttons)).rejects.toThrow(
        'Button "Invalid" must have either callbackData or url'
      );
    });

    it('should validate all buttons in all rows', async () => {
      const ctx = new Context(testUpdate, mockApiClient);
      const buttons: InlineButton[][] = [
        [{ text: 'Valid 1', callbackData: 'data1' }],
        [{ text: 'Invalid', callbackData: 'data2', url: 'https://example.com' }],
        [{ text: 'Valid 2', url: 'https://example.com' }],
      ];

      await expect(ctx.replyWithButtons('Text', buttons)).rejects.toThrow(ValidationError);
    });
  });

  describe('Command context', () => {
    it('should allow setting command and args', () => {
      const ctx = new Context(testUpdate, mockApiClient);
      
      ctx.command = 'start';
      ctx.args = ['arg1', 'arg2'];

      expect(ctx.command).toBe('start');
      expect(ctx.args).toEqual(['arg1', 'arg2']);
    });
  });
});
