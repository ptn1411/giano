/**
 * WebSocket Client
 * Handles real-time communication with the backend
 * Requirements: 6.1, 6.6, 6.7, 6.8
 */

import {
  Message,
  DeliveryStatus,
  UserStatus,
  NewMessageEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  MessagePinnedEvent,
  ReactionUpdatedEvent,
  TypingEvent,
  UserStatusEvent,
  MessageStatusEvent,
  MessageReadEvent,
} from '@/services/api/types';
import {
  useCallStore,
  injectWebSocketFunctions,
  IncomingCallEvent,
  CallAcceptedEvent,
  CallDeclinedEvent,
  CallEndedEvent,
  UserBusyEvent,
} from '@/stores/callStore';
import type { CallType } from '@/services/mediaHandler';

// ============================================
// Types
// ============================================

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type WebSocketEventType =
  | 'new_message'
  | 'message_updated'
  | 'message_deleted'
  | 'message_pinned'
  | 'reaction_updated'
  | 'typing'
  | 'user_status'
  | 'message_status'
  | 'message_read'
  | 'incoming_call'
  | 'call_accepted'
  | 'call_declined'
  | 'call_ended'
  | 'user_busy'
  | 'error';

// Server error event
export interface ServerErrorEvent {
  code: string;
  message: string;
}

export type WebSocketEventData =
  | NewMessageEvent
  | MessageUpdatedEvent
  | MessageDeletedEvent
  | MessagePinnedEvent
  | ReactionUpdatedEvent
  | TypingEvent
  | UserStatusEvent
  | MessageStatusEvent
  | MessageReadEvent
  | IncomingCallEvent
  | CallAcceptedEvent
  | CallDeclinedEvent
  | CallEndedEvent
  | UserBusyEvent
  | ServerErrorEvent;

export interface WebSocketEventHandler<T = WebSocketEventData> {
  (data: T): void;
}

export interface OutgoingTypingEvent {
  chatId: string;
  isTyping: boolean;
}

// ============================================
// Constants
// ============================================

const DEFAULT_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

// ============================================
// WebSocket Client Class
// ============================================

class WebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private reconnectDelay = DEFAULT_RECONNECT_DELAY;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectionState: ConnectionState = 'disconnected';
  
  // Event handlers registry
  private handlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  
  // Connection state change listeners
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Connect to WebSocket server
   * Requirement 6.1: Connect to wss://api/ws?token=jwt when user is authenticated
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.token = token;
    this.setConnectionState('connecting');

    const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
    // Convert http(s) to ws(s) if needed
    const wsUrl = wsBaseUrl.replace(/^http/, 'ws');
    const fullUrl = `${wsUrl}?token=${token}`;

    try {
      this.ws = new WebSocket(fullUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.setConnectionState('disconnected');
      this.attemptReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimeout();
    this.reconnectAttempts = 0;
    this.reconnectDelay = DEFAULT_RECONNECT_DELAY;
    this.token = null;

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnection attempt
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionState('disconnected');
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Register an event handler
   * Returns an unsubscribe function
   */
  on<T extends WebSocketEventData>(
    event: WebSocketEventType,
    handler: WebSocketEventHandler<T>
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as WebSocketEventHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler as WebSocketEventHandler);
    };
  }

  /**
   * Register a connection state change listener
   * Returns an unsubscribe function
   */
  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit(event: string, data: WebSocketEventData): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocket] Error in handler for event "${event}":`, error);
        }
      });
    }
  }

  // ============================================
  // Sending Messages
  // ============================================

  /**
   * Send a message through WebSocket
   */
  send(event: string, data: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send message: not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify({ event, data }));
      return true;
    } catch (error) {
      console.error('[WebSocket] Error sending message:', error);
      return false;
    }
  }

  /**
   * Send typing indicator
   * Requirement 6.6: Send start_typing when user starts typing
   * Requirement 6.7: Send stop_typing when user stops typing
   */
  sendTyping(chatId: string, isTyping: boolean): boolean {
    const event = isTyping ? 'start_typing' : 'stop_typing';
    return this.send(event, { chatId });
  }

  // ============================================
  // Call Event Send Functions
  // Requirements: 1.1, 1.2, 2.4, 5.1
  // ============================================

  /**
   * Send initiate call signal
   * Requirement 1.1: Voice call initiation
   * Requirement 1.2: Video call initiation
   */
  sendInitiateCall(targetUserId: string, chatId: string, callType: CallType): boolean {
    return this.send('initiate_call', {
      targetUserId,
      chatId,
      callType,
    });
  }

  /**
   * Send accept call signal
   * Requirement 2.3: Accept incoming call
   */
  sendAcceptCall(callId: string): boolean {
    return this.send('accept_call', { callId });
  }

  /**
   * Send decline call signal
   * Requirement 2.4: Decline incoming call
   */
  sendDeclineCall(callId: string): boolean {
    return this.send('decline_call', { callId });
  }

  /**
   * Send end call signal
   * Requirement 5.1: End ongoing call
   */
  sendEndCall(callId: string): boolean {
    return this.send('end_call', { callId });
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = DEFAULT_RECONNECT_DELAY;
      this.setConnectionState('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const { event: eventType, data } = parsed;
        
        if (eventType && data) {
          this.emit(eventType, data);
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected:', event.code, event.reason);
      this.ws = null;
      
      // Only attempt reconnect if we have a token (user is still authenticated)
      if (this.token) {
        this.attemptReconnect();
      } else {
        this.setConnectionState('disconnected');
      }
    };
  }

  /**
   * Attempt to reconnect with exponential backoff
   * Requirement 6.8: Reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[WebSocket] Max reconnection attempts reached');
      this.setConnectionState('disconnected');
      return;
    }

    if (!this.token) {
      console.log('[WebSocket] No token available for reconnection');
      this.setConnectionState('disconnected');
      return;
    }

    this.setConnectionState('reconnecting');
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff: delay = initialDelay * 2^(attempt-1)
    const delay = Math.min(
      DEFAULT_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );
    this.reconnectDelay = delay;

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    this.reconnectTimeout = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.stateListeners.forEach((listener) => {
        try {
          listener(state);
        } catch (error) {
          console.error('[WebSocket] Error in state listener:', error);
        }
      });
    }
  }

  // ============================================
  // Utility Methods for Testing
  // ============================================

  /**
   * Get current reconnect delay (for testing)
   */
  getReconnectDelay(): number {
    return this.reconnectDelay;
  }

  /**
   * Get current reconnect attempts (for testing)
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Reset reconnect state (for testing)
   */
  resetReconnectState(): void {
    this.reconnectAttempts = 0;
    this.reconnectDelay = DEFAULT_RECONNECT_DELAY;
    this.clearReconnectTimeout();
  }
}

// ============================================
// Singleton Export
// ============================================

export const wsClient = new WebSocketClient();

// Inject WebSocket functions into callStore to avoid circular dependency
injectWebSocketFunctions({
  sendInitiateCall: (targetUserId: string, chatId: string, callType: CallType) => 
    wsClient.sendInitiateCall(targetUserId, chatId, callType),
  sendAcceptCall: (callId: string) => wsClient.sendAcceptCall(callId),
  sendDeclineCall: (callId: string) => wsClient.sendDeclineCall(callId),
  sendEndCall: (callId: string) => wsClient.sendEndCall(callId),
});

// ============================================
// Call Event Handlers Setup
// Requirements: 2.1, 5.2
// ============================================

/**
 * Setup call event handlers that integrate with callStore
 * Should be called once when WebSocket connects
 * Requirement 2.1: Handle incoming call notifications
 * Requirement 5.2: Handle call end events
 */
export function setupCallEventHandlers(): () => void {
  // Handle incoming call notification
  const unsubIncoming = wsClient.on<IncomingCallEvent>('incoming_call', (data) => {
    console.log('[WebSocket] Incoming call event:', data);
    useCallStore.getState().handleIncomingCall(data);
  });

  // Handle call accepted
  const unsubAccepted = wsClient.on<CallAcceptedEvent>('call_accepted', (data) => {
    console.log('[WebSocket] Call accepted event:', data);
    useCallStore.getState().handleCallAccepted(data);
  });

  // Handle call declined
  const unsubDeclined = wsClient.on<CallDeclinedEvent>('call_declined', (data) => {
    console.log('[WebSocket] Call declined event:', data);
    useCallStore.getState().handleCallDeclined(data);
  });

  // Handle call ended
  const unsubEnded = wsClient.on<CallEndedEvent>('call_ended', (data) => {
    console.log('[WebSocket] Call ended event:', data);
    useCallStore.getState().handleCallEnded(data);
  });

  // Handle user busy
  const unsubBusy = wsClient.on<UserBusyEvent>('user_busy', (data) => {
    console.log('[WebSocket] User busy event:', data);
    useCallStore.getState().handleUserBusy(data);
  });

  // Handle error events from server (e.g., NOT_CHAT_PARTICIPANT)
  const unsubError = wsClient.on<ServerErrorEvent>('error', (data) => {
    console.log('[WebSocket] Error event:', data);
    const callState = useCallStore.getState().callState;
    
    // Only handle call-related errors when in a call state
    if (callState !== 'idle') {
      if (data.code === 'NOT_CHAT_PARTICIPANT') {
        useCallStore.getState()._setErrorFromType('not_chat_participant', data.message);
        useCallStore.getState()._cleanup();
      } else if (data.code === 'USER_OFFLINE') {
        useCallStore.getState()._setErrorFromType('user_offline', data.message);
        useCallStore.getState()._cleanup();
      }
      // Other call-related errors can be added here
    }
  });

  // Return cleanup function
  return () => {
    unsubIncoming();
    unsubAccepted();
    unsubDeclined();
    unsubEnded();
    unsubBusy();
    unsubError();
  };
}

// ============================================
// Typing Indicator Helper
// ============================================

/**
 * Creates a debounced typing indicator sender
 * Automatically sends stop_typing after a delay
 */
export function createTypingIndicator(chatId: string, debounceMs = 2000) {
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let isCurrentlyTyping = false;

  return {
    /**
     * Call this when user types
     */
    onType: () => {
      // Send start_typing if not already typing
      if (!isCurrentlyTyping) {
        isCurrentlyTyping = true;
        wsClient.sendTyping(chatId, true);
      }

      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Set timeout to send stop_typing
      typingTimeout = setTimeout(() => {
        isCurrentlyTyping = false;
        wsClient.sendTyping(chatId, false);
        typingTimeout = null;
      }, debounceMs);
    },

    /**
     * Call this when user sends message or leaves chat
     */
    stop: () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
      if (isCurrentlyTyping) {
        isCurrentlyTyping = false;
        wsClient.sendTyping(chatId, false);
      }
    },

    /**
     * Check if currently typing
     */
    isTyping: () => isCurrentlyTyping,
  };
}

// ============================================
// Type Exports
// ============================================

export type {
  Message,
  DeliveryStatus,
  UserStatus,
  NewMessageEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  MessagePinnedEvent,
  ReactionUpdatedEvent,
  TypingEvent,
  UserStatusEvent,
  MessageStatusEvent,
  MessageReadEvent,
  IncomingCallEvent,
  CallAcceptedEvent,
  CallDeclinedEvent,
  CallEndedEvent,
  UserBusyEvent,
};
