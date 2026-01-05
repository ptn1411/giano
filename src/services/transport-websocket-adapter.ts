/**
 * Transport WebSocket Adapter
 * Adapts TransportManager to work with existing WebSocket client interface
 * Requirement 5.4: Maintain backward compatibility while using TransportManager
 */

import {
  TransportManager,
  TransportType,
  DEFAULT_TRANSPORT_CONFIG,
  ConnectionState as TransportConnectionState,
  PerformanceMetrics,
} from './transport-manager';
import type { ConnectionState, WebSocketEventType, WebSocketEventData, WebSocketEventHandler } from './websocket';

// ============================================
// Transport-Enabled WebSocket Client
// ============================================

/**
 * WebSocket client that uses TransportManager under the hood
 * Provides the same interface as the original WebSocketClient for backward compatibility
 */
class TransportEnabledWebSocketClient {
  private transportManager: TransportManager | null = null;
  private token: string | null = null;
  private connectionState: ConnectionState = 'disconnected';

  // Event handlers registry
  private handlers: Map<string, Set<WebSocketEventHandler>> = new Map();

  // Connection state change listeners
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Connect to server using TransportManager
   * Requirement 5.2: Attempt QUIC connection first if supported
   * Requirement 5.3: Fall back to WebSocket on failure
   */
  connect(token: string): void {
    if (this.transportManager?.isConnected()) {
      console.log('[TransportEnabledWS] Already connected');
      return;
    }

    this.token = token;
    this.setConnectionState('connecting');

    // Create TransportManager with token in WebSocket URL
    const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
    const wsUrl = wsBaseUrl.replace(/^http/, 'ws');
    const websocketUrl = `${wsUrl}?token=${token}`;

    const config = {
      ...DEFAULT_TRANSPORT_CONFIG,
      websocketUrl,
    };

    this.transportManager = new TransportManager(config);

    // Set up event handlers
    this.transportManager.on('connected', (type) => {
      console.log(`[TransportEnabledWS] Connected via ${type}`);
      this.setConnectionState('connected');
    });

    this.transportManager.on('disconnected', (reason) => {
      console.log(`[TransportEnabledWS] Disconnected: ${reason}`);
      this.setConnectionState('disconnected');
      
      // Attempt reconnect if we still have a token
      if (this.token) {
        this.attemptReconnect();
      }
    });

    this.transportManager.on('message', (data) => {
      this.handleMessage(data);
    });

    this.transportManager.on('error', (error) => {
      console.error('[TransportEnabledWS] Error:', error);
    });

    this.transportManager.on('stateChange', (state) => {
      this.handleStateChange(state);
    });

    // Connect
    this.transportManager.connect().catch((error) => {
      console.error('[TransportEnabledWS] Connection failed:', error);
      this.setConnectionState('disconnected');
      this.attemptReconnect();
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.token = null;

    if (this.transportManager) {
      this.transportManager.disconnect().catch(console.error);
      this.transportManager = null;
    }

    this.setConnectionState('disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.transportManager?.isConnected() === true;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current transport type
   */
  getTransportType(): TransportType {
    return this.transportManager?.getTransportType() ?? TransportType.Unknown;
  }

  /**
   * Get performance metrics
   * Requirement 5.5: Monitor transport performance metrics
   */
  getMetrics(): PerformanceMetrics | null {
    return this.transportManager?.getMetrics() ?? null;
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
          console.error(
            `[TransportEnabledWS] Error in handler for event "${event}":`,
            error
          );
        }
      });
    }
  }

  // ============================================
  // Sending Messages
  // ============================================

  /**
   * Send a message through the transport
   */
  send(event: string, data: unknown): boolean {
    if (!this.transportManager || !this.isConnected()) {
      console.warn('[TransportEnabledWS] Cannot send message: not connected');
      return false;
    }

    try {
      const message = JSON.stringify({ event, data });
      const encoder = new TextEncoder();
      const arrayBuffer = encoder.encode(message).buffer;
      
      this.transportManager.send(arrayBuffer).catch((error) => {
        console.error('[TransportEnabledWS] Error sending message:', error);
      });
      
      return true;
    } catch (error) {
      console.error('[TransportEnabledWS] Error sending message:', error);
      return false;
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(chatId: string, isTyping: boolean): boolean {
    const event = isTyping ? 'start_typing' : 'stop_typing';
    return this.send(event, { chatId });
  }

  // ============================================
  // Call Event Send Functions
  // ============================================

  /**
   * Send initiate call signal
   */
  sendInitiateCall(
    targetUserId: string,
    chatId: string,
    callType: string
  ): boolean {
    const payload = {
      targetUserId,
      chatId,
      callType,
    };
    console.log('[TransportEnabledWS] Sending initiate_call:', payload);
    return this.send('initiate_call', payload);
  }

  /**
   * Send accept call signal
   */
  sendAcceptCall(callId: string): boolean {
    return this.send('accept_call', { callId });
  }

  /**
   * Send decline call signal
   */
  sendDeclineCall(callId: string): boolean {
    return this.send('decline_call', { callId });
  }

  /**
   * Send end call signal
   */
  sendEndCall(callId: string): boolean {
    return this.send('end_call', { callId });
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Handle incoming message from transport
   */
  private handleMessage(data: ArrayBuffer): void {
    try {
      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      const parsed = JSON.parse(text);
      const { event: eventType, data: eventData } = parsed;

      if (eventType && eventData) {
        this.emit(eventType, eventData);
      }
    } catch (error) {
      console.error('[TransportEnabledWS] Error parsing message:', error);
    }
  }

  /**
   * Handle transport state changes
   */
  private handleStateChange(state: TransportConnectionState): void {
    // Map transport state to WebSocket connection state
    let wsState: ConnectionState;
    
    switch (state) {
      case 'connecting':
        wsState = 'connecting';
        break;
      case 'connected':
        wsState = 'connected';
        break;
      case 'reconnecting':
        wsState = 'reconnecting';
        break;
      case 'disconnected':
      case 'failed':
        wsState = 'disconnected';
        break;
      default:
        wsState = 'disconnected';
    }

    this.setConnectionState(wsState);
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
          console.error('[TransportEnabledWS] Error in state listener:', error);
        }
      });
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (!this.token) {
      console.log('[TransportEnabledWS] No token available for reconnection');
      return;
    }

    this.setConnectionState('reconnecting');

    // TransportManager handles reconnection internally
    // We just need to ensure we have a valid token
    if (this.transportManager) {
      this.transportManager.connect().catch((error) => {
        console.error('[TransportEnabledWS] Reconnection failed:', error);
      });
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const transportEnabledWsClient = new TransportEnabledWebSocketClient();
