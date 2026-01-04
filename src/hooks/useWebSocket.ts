/**
 * WebSocket Integration Hook
 * Connects WebSocket events to Zustand stores
 * Requirements: 6.2-6.5
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { wsClient, ConnectionState } from '@/services/websocket';
import { useAuthStore } from '@/stores/authStore';
import { useMessagesStore } from '@/stores/messagesStore';
import { useChatsStore } from '@/stores/chatsStore';
import { useUsersStore } from '@/stores/usersStore';
import {
  NewMessageEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  MessagePinnedEvent,
  ReactionUpdatedEvent,
  TypingEvent,
  UserStatusEvent,
  MessageStatusEvent,
} from '@/services/api/types';

// ============================================
// Hook: useWebSocket
// ============================================

/**
 * Hook to manage WebSocket connection and event handling
 * Automatically connects when user is authenticated and disconnects on logout
 */
export function useWebSocket() {
  const session = useAuthStore((state) => state.session);
  const token = session?.token;
  
  // Track if we've set up handlers to avoid duplicates
  const handlersSetup = useRef(false);

  // Get store actions
  const addMessage = useMessagesStore((state) => state.addMessage);
  const updateMessageStatus = useMessagesStore((state) => state.updateMessageStatus);
  const setTyping = useChatsStore((state) => state.setTyping);
  const updateChat = useChatsStore((state) => state.updateChat);
  const updateUserStatus = useUsersStore((state) => state.updateUserStatus);

  // Get messages state for updates
  const messagesState = useMessagesStore.getState();

  /**
   * Handle new_message event
   * Requirement 6.2: Add message to appropriate chat
   */
  const handleNewMessage = useCallback(
    (data: NewMessageEvent) => {
      const { message } = data;
      
      // Add message to messages store
      addMessage(message);

      // Update chat's last message and increment unread count
      updateChat(message.chatId, {
        lastMessage: message,
        // Only increment unread if message is from another user
        // The current user's ID check would need to be added here
      });
    },
    [addMessage, updateChat]
  );

  /**
   * Handle message_updated event (edit)
   */
  const handleMessageUpdated = useCallback(
    (data: MessageUpdatedEvent) => {
      const { message } = data;
      const state = useMessagesStore.getState();
      const chatMessages = state.messages[message.chatId] || [];
      
      // Update message in store
      useMessagesStore.setState({
        messages: {
          ...state.messages,
          [message.chatId]: chatMessages.map(m => 
            m.id === message.id ? message : m
          ),
        },
      });
    },
    []
  );

  /**
   * Handle message_deleted event
   */
  const handleMessageDeleted = useCallback(
    (data: MessageDeletedEvent) => {
      const { chatId, messageId } = data;
      const state = useMessagesStore.getState();
      const chatMessages = state.messages[chatId] || [];
      
      // Remove message from store
      useMessagesStore.setState({
        messages: {
          ...state.messages,
          [chatId]: chatMessages.filter(m => m.id !== messageId),
        },
      });
    },
    []
  );

  /**
   * Handle message_pinned event
   */
  const handleMessagePinned = useCallback(
    (data: MessagePinnedEvent) => {
      const { chatId, messageId, isPinned } = data;
      const state = useMessagesStore.getState();
      const chatMessages = state.messages[chatId] || [];
      
      // Update message pin status
      useMessagesStore.setState({
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map(m => 
            m.id === messageId ? { ...m, isPinned } : m
          ),
        },
      });
    },
    []
  );

  /**
   * Handle reaction_updated event
   */
  const handleReactionUpdated = useCallback(
    (data: ReactionUpdatedEvent) => {
      const { message } = data;
      const state = useMessagesStore.getState();
      const chatMessages = state.messages[message.chatId] || [];
      
      // Update message reactions
      useMessagesStore.setState({
        messages: {
          ...state.messages,
          [message.chatId]: chatMessages.map(m => 
            m.id === message.id ? { ...m, reactions: message.reactions } : m
          ),
        },
      });
    },
    []
  );

  /**
   * Handle typing event
   * Requirement 6.3: Update typing indicator for chat
   */
  const handleTyping = useCallback(
    (data: TypingEvent) => {
      const { chatId, isTyping, userName } = data;
      setTyping(chatId, isTyping, userName);
    },
    [setTyping]
  );

  /**
   * Handle user_status event
   * Requirement 6.4: Update user online/offline status
   */
  const handleUserStatus = useCallback(
    (data: UserStatusEvent) => {
      const { userId, status, lastSeen } = data;
      updateUserStatus(userId, status, lastSeen);
    },
    [updateUserStatus]
  );

  /**
   * Handle message_status event
   * Requirement 6.5: Update delivery status
   */
  const handleMessageStatus = useCallback(
    (data: MessageStatusEvent) => {
      const { chatId, messageId, status } = data;
      updateMessageStatus(chatId, messageId, status);
    },
    [updateMessageStatus]
  );

  // Setup WebSocket connection and event handlers
  useEffect(() => {
    if (!token) {
      // Disconnect if no token (user logged out)
      wsClient.disconnect();
      handlersSetup.current = false;
      return;
    }

    // Connect to WebSocket
    wsClient.connect(token);

    // Setup event handlers only once
    if (!handlersSetup.current) {
      handlersSetup.current = true;
    }

    // Register event handlers
    const unsubNewMessage = wsClient.on<NewMessageEvent>('new_message', handleNewMessage);
    const unsubMessageUpdated = wsClient.on<MessageUpdatedEvent>('message_updated', handleMessageUpdated);
    const unsubMessageDeleted = wsClient.on<MessageDeletedEvent>('message_deleted', handleMessageDeleted);
    const unsubMessagePinned = wsClient.on<MessagePinnedEvent>('message_pinned', handleMessagePinned);
    const unsubReactionUpdated = wsClient.on<ReactionUpdatedEvent>('reaction_updated', handleReactionUpdated);
    const unsubTyping = wsClient.on<TypingEvent>('typing', handleTyping);
    const unsubUserStatus = wsClient.on<UserStatusEvent>('user_status', handleUserStatus);
    const unsubMessageStatus = wsClient.on<MessageStatusEvent>('message_status', handleMessageStatus);

    // Cleanup on unmount or token change
    return () => {
      unsubNewMessage();
      unsubMessageUpdated();
      unsubMessageDeleted();
      unsubMessagePinned();
      unsubReactionUpdated();
      unsubTyping();
      unsubUserStatus();
      unsubMessageStatus();
    };
  }, [token, handleNewMessage, handleMessageUpdated, handleMessageDeleted, handleMessagePinned, handleReactionUpdated, handleTyping, handleUserStatus, handleMessageStatus]);

  return {
    isConnected: wsClient.isConnected(),
    connectionState: wsClient.getConnectionState(),
  };
}

// ============================================
// Hook: useWebSocketState
// ============================================

/**
 * Hook to track WebSocket connection state
 */
export function useWebSocketState() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  useEffect(() => {
    // Set initial state
    setConnectionState(wsClient.getConnectionState());

    // Subscribe to state changes
    const unsubscribe = wsClient.onStateChange(setConnectionState);

    return unsubscribe;
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isReconnecting: connectionState === 'reconnecting',
    isDisconnected: connectionState === 'disconnected',
  };
}
