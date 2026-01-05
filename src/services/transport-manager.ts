/**
 * Transport Manager
 * Manages QUIC and WebSocket transports with automatic selection and fallback
 * Requirements: 5.1, 5.2, 5.3, 5.4, 10.3
 */

// ============================================
// Types and Interfaces
// ============================================

export enum TransportType {
  Unknown = 'unknown',
  Quic = 'quic',
  WebSocket = 'websocket',
}

export interface TransportConfig {
  quicUrl: string;
  websocketUrl: string;
  quicTimeout: number; // Timeout for QUIC connection attempt in ms
  maxReconnectAttempts: number;
  reconnectDelay: number;
  cachePreference: boolean; // Whether to cache transport preference
  cacheDuration: number; // How long to cache preference in ms
  retryQuicInterval: number; // How often to retry QUIC when using cached WebSocket preference
}

export interface TransportEvents {
  connected: (type: TransportType) => void;
  disconnected: (reason: string) => void;
  message: (data: ArrayBuffer) => void;
  error: (error: Error) => void;
  stateChange: (state: ConnectionState) => void;
  metricsUpdate: (metrics: PerformanceMetrics) => void;
}

// ============================================
// Performance Metrics Types
// ============================================

export interface PerformanceMetrics {
  // Connection info
  transportType: TransportType;
  connectionState: ConnectionState;
  connectedAt: number | null;
  connectionDuration: number; // milliseconds
  
  // Throughput metrics
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  messagesPerSecond: number;
  bytesPerSecond: number;
  
  // Latency metrics
  averageLatency: number; // milliseconds
  minLatency: number; // milliseconds
  maxLatency: number; // milliseconds
  lastLatency: number; // milliseconds
  
  // Connection quality
  reconnectCount: number;
  errorCount: number;
  lastError: string | null;
  
  // Transport-specific
  fallbackCount: number; // Number of times fallen back from QUIC to WebSocket
  migrationCount: number; // Number of connection migrations (QUIC)
}

interface LatencySample {
  timestamp: number;
  latency: number;
}

interface PendingMessage {
  id: string;
  sentAt: number;
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface TransportInterface {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: ArrayBuffer): Promise<void>;
  isConnected(): boolean;
  getType(): TransportType;
  onMessage(callback: (data: ArrayBuffer) => void): void;
  onClose(callback: (reason: string) => void): void;
  onError(callback: (error: Error) => void): void;
}

// ============================================
// Transport Preference Cache
// ============================================

interface CachedPreference {
  type: TransportType;
  timestamp: number;
  reason: string;
}

const CACHE_KEY = 'transport_preference';

class TransportPreferenceCache {
  private cacheDuration: number;

  constructor(cacheDuration: number) {
    this.cacheDuration = cacheDuration;
  }

  /**
   * Get cached transport preference if valid
   * Requirement 10.3: Cache transport preference to avoid repeated QUIC attempts
   */
  get(): TransportType | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const preference: CachedPreference = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - preference.timestamp < this.cacheDuration) {
        console.log(
          `[TransportManager] Using cached preference: ${preference.type} (reason: ${preference.reason})`
        );
        return preference.type;
      }

      // Cache expired
      this.clear();
      return null;
    } catch (error) {
      console.error('[TransportManager] Error reading cache:', error);
      return null;
    }
  }

  /**
   * Set transport preference in cache
   */
  set(type: TransportType, reason: string): void {
    try {
      const preference: CachedPreference = {
        type,
        timestamp: Date.now(),
        reason,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(preference));
      console.log(`[TransportManager] Cached preference: ${type} (reason: ${reason})`);
    } catch (error) {
      console.error('[TransportManager] Error writing cache:', error);
    }
  }

  /**
   * Clear cached preference
   */
  clear(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
      console.log('[TransportManager] Cleared cached preference');
    } catch (error) {
      console.error('[TransportManager] Error clearing cache:', error);
    }
  }
}

// ============================================
// Transport Manager Class
// ============================================

export class TransportManager {
  private transport: TransportInterface | null = null;
  private transportType: TransportType = TransportType.Unknown;
  private config: TransportConfig;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private preferenceCache: TransportPreferenceCache;
  private retryQuicTimeout: ReturnType<typeof setTimeout> | null = null;

  // Performance metrics tracking
  private metrics: PerformanceMetrics;
  private connectedAt: number | null = null;
  private latencySamples: LatencySample[] = [];
  private maxLatencySamples: number = 100; // Keep last 100 samples
  private pendingMessages: Map<string, PendingMessage> = new Map();
  private metricsUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private metricsUpdateFrequency: number = 5000; // Update every 5 seconds
  private lastMetricsUpdate: number = 0;
  private lastBytesSent: number = 0;
  private lastBytesReceived: number = 0;
  private lastMessagesSent: number = 0;
  private lastMessagesReceived: number = 0;

  // Event handlers
  private eventHandlers: Map<keyof TransportEvents, Set<(...args: unknown[]) => void>> = new Map();

  constructor(config: TransportConfig) {
    this.config = config;
    this.preferenceCache = new TransportPreferenceCache(config.cacheDuration);
    this.metrics = this.initializeMetrics();
  }

  // ============================================
  // Feature Detection
  // ============================================

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      transportType: TransportType.Unknown,
      connectionState: 'disconnected',
      connectedAt: null,
      connectionDuration: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      messagesPerSecond: 0,
      bytesPerSecond: 0,
      averageLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      lastLatency: 0,
      reconnectCount: 0,
      errorCount: 0,
      lastError: null,
      fallbackCount: 0,
      migrationCount: 0,
    };
  }

  /**
   * Start metrics collection
   * Requirement 5.5: Monitor transport performance metrics
   */
  private startMetricsCollection(): void {
    this.stopMetricsCollection();

    this.lastMetricsUpdate = Date.now();
    this.lastBytesSent = this.metrics.bytesSent;
    this.lastBytesReceived = this.metrics.bytesReceived;
    this.lastMessagesSent = this.metrics.messagesSent;
    this.lastMessagesReceived = this.metrics.messagesReceived;

    this.metricsUpdateInterval = setInterval(() => {
      this.updateMetrics();
    }, this.metricsUpdateFrequency);

    console.log('[TransportManager] Metrics collection started');
  }

  /**
   * Stop metrics collection
   */
  private stopMetricsCollection(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
      console.log('[TransportManager] Metrics collection stopped');
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeDelta = (now - this.lastMetricsUpdate) / 1000; // seconds

    // Update connection duration
    if (this.connectedAt) {
      this.metrics.connectionDuration = now - this.connectedAt;
    }

    // Calculate throughput (per second)
    if (timeDelta > 0) {
      const bytesSentDelta = this.metrics.bytesSent - this.lastBytesSent;
      const bytesReceivedDelta = this.metrics.bytesReceived - this.lastBytesReceived;
      const messagesSentDelta = this.metrics.messagesSent - this.lastMessagesSent;
      const messagesReceivedDelta = this.metrics.messagesReceived - this.lastMessagesReceived;

      this.metrics.bytesPerSecond = bytesSentDelta / timeDelta;
      this.metrics.messagesPerSecond = (messagesSentDelta + messagesReceivedDelta) / timeDelta;
    }

    // Calculate latency statistics
    if (this.latencySamples.length > 0) {
      const latencies = this.latencySamples.map(s => s.latency);
      this.metrics.averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      this.metrics.minLatency = Math.min(...latencies);
      this.metrics.maxLatency = Math.max(...latencies);
      this.metrics.lastLatency = latencies[latencies.length - 1];
    }

    // Update current state
    this.metrics.transportType = this.transportType;
    this.metrics.connectionState = this.connectionState;
    this.metrics.connectedAt = this.connectedAt;

    // Update last values for next calculation
    this.lastMetricsUpdate = now;
    this.lastBytesSent = this.metrics.bytesSent;
    this.lastBytesReceived = this.metrics.bytesReceived;
    this.lastMessagesSent = this.metrics.messagesSent;
    this.lastMessagesReceived = this.metrics.messagesReceived;

    // Emit metrics update event
    this.emit('metricsUpdate', this.metrics);
  }

  /**
   * Record latency sample
   */
  private recordLatency(latency: number): void {
    const sample: LatencySample = {
      timestamp: Date.now(),
      latency,
    };

    this.latencySamples.push(sample);

    // Keep only the most recent samples
    if (this.latencySamples.length > this.maxLatencySamples) {
      this.latencySamples.shift();
    }
  }

  /**
   * Track message sent
   */
  private trackMessageSent(messageId: string, data: ArrayBuffer): void {
    this.metrics.messagesSent++;
    this.metrics.bytesSent += data.byteLength;

    // Store pending message for latency tracking
    this.pendingMessages.set(messageId, {
      id: messageId,
      sentAt: Date.now(),
    });

    // Clean up old pending messages (older than 60 seconds)
    const now = Date.now();
    for (const [id, msg] of this.pendingMessages.entries()) {
      if (now - msg.sentAt > 60000) {
        this.pendingMessages.delete(id);
      }
    }
  }

  /**
   * Track message received
   */
  private trackMessageReceived(messageId: string | null, data: ArrayBuffer): void {
    this.metrics.messagesReceived++;
    this.metrics.bytesReceived += data.byteLength;

    // Calculate latency if this is a response to a sent message
    if (messageId && this.pendingMessages.has(messageId)) {
      const pending = this.pendingMessages.get(messageId)!;
      const latency = Date.now() - pending.sentAt;
      this.recordLatency(latency);
      this.pendingMessages.delete(messageId);
    }
  }

  /**
   * Track error
   */
  private trackError(error: Error): void {
    this.metrics.errorCount++;
    this.metrics.lastError = error.message;
  }

  /**
   * Track fallback from QUIC to WebSocket
   */
  private trackFallback(): void {
    this.metrics.fallbackCount++;
    console.log(`[TransportManager] Fallback count: ${this.metrics.fallbackCount}`);
  }

  /**
   * Get current performance metrics
   * Requirement 5.5: Monitor transport performance metrics
   */
  getMetrics(): PerformanceMetrics {
    // Return a copy to prevent external modification
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.latencySamples = [];
    this.pendingMessages.clear();
    this.connectedAt = null;
    console.log('[TransportManager] Metrics reset');
  }

  // ============================================
  // Feature Detection
  // ============================================

  /**
   * Detect if WebTransport (QUIC) is supported in the browser
   * Requirement 5.1: Detect QUIC support in browser/environment
   */
  private isWebTransportSupported(): boolean {
    // Check if WebTransport API is available
    const supported = typeof WebTransport !== 'undefined';
    console.log(`[TransportManager] WebTransport supported: ${supported}`);
    return supported;
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Connect using the best available transport
   * Requirement 5.2: Attempt QUIC connection first if supported
   * Requirement 5.3: Fall back to WebSocket on failure
   * Requirement 10.3: Use cached preference to avoid repeated attempts
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      console.log('[TransportManager] Already connecting or connected');
      return;
    }

    this.setConnectionState('connecting');
    this.reconnectAttempts = 0;

    try {
      // Check for cached preference
      const cachedPreference = this.config.cachePreference
        ? this.preferenceCache.get()
        : null;

      if (cachedPreference === TransportType.WebSocket) {
        // Use cached WebSocket preference
        console.log('[TransportManager] Using cached WebSocket preference');
        await this.connectWebSocket();
        
        // Schedule periodic QUIC retry
        this.scheduleQuicRetry();
        return;
      }

      // Try QUIC first if supported
      if (this.isWebTransportSupported()) {
        console.log('[TransportManager] Attempting QUIC connection...');
        const quicSuccess = await this.attemptQuicConnection();
        
        if (quicSuccess) {
          // QUIC succeeded, clear any cached WebSocket preference
          if (this.config.cachePreference) {
            this.preferenceCache.clear();
          }
          return;
        }
        
        // Track fallback
        this.trackFallback();
      } else {
        console.log('[TransportManager] WebTransport not supported, using WebSocket');
      }

      // Fall back to WebSocket
      console.log('[TransportManager] Falling back to WebSocket');
      await this.connectWebSocket();

      // Cache WebSocket preference if QUIC failed
      if (this.config.cachePreference && this.isWebTransportSupported()) {
        this.preferenceCache.set(TransportType.WebSocket, 'QUIC connection failed');
      }
    } catch (error) {
      console.error('[TransportManager] Connection failed:', error);
      this.trackError(error as Error);
      this.setConnectionState('failed');
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Attempt QUIC connection with timeout
   * Returns true if successful, false if failed or timed out
   */
  private async attemptQuicConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[TransportManager] QUIC connection timeout');
        if (this.transport) {
          this.transport.disconnect().catch(console.error);
          this.transport = null;
        }
        resolve(false);
      }, this.config.quicTimeout);

      // Use IIFE to handle async operations
      (async () => {
        try {
          // Import QuicTransport dynamically to avoid issues if WebTransport is not available
          const { QuicTransport } = await import('./quic-transport');
          
          const quicTransport = new QuicTransport(this.config.quicUrl);
          
          // Set up event handlers
          quicTransport.onMessage((data) => {
            this.trackMessageReceived(null, data);
            this.emit('message', data);
          });
          
          quicTransport.onClose((reason) => {
            console.log('[TransportManager] QUIC transport closed:', reason);
            this.emit('disconnected', reason);
            this.attemptReconnect();
          });
          
          quicTransport.onError((error) => {
            console.error('[TransportManager] QUIC transport error:', error);
            this.trackError(error);
            this.emit('error', error);
          });
          
          // Attempt connection
          await quicTransport.connect();
          
          clearTimeout(timeout);
          this.transport = quicTransport;
          this.transportType = TransportType.Quic;
          this.connectedAt = Date.now();
          this.setConnectionState('connected');
          this.emit('connected', TransportType.Quic);
          
          // Start metrics collection
          this.startMetricsCollection();
          
          console.log('[TransportManager] QUIC connection successful');
          resolve(true);
        } catch (error) {
          console.error('[TransportManager] QUIC connection failed:', error);
          clearTimeout(timeout);
          if (this.transport) {
            this.transport.disconnect().catch(console.error);
            this.transport = null;
          }
          resolve(false);
        }
      })();
    });
  }

  /**
   * Connect using WebSocket transport
   */
  private async connectWebSocket(): Promise<void> {
    try {
      console.log('[TransportManager] Connecting via WebSocket...');
      
      // Import WebSocketTransport dynamically
      const { WebSocketTransport } = await import('./websocket');
      
      const wsTransport = new WebSocketTransport(this.config.websocketUrl);
      
      // Set up event handlers
      wsTransport.onMessage((data) => {
        this.trackMessageReceived(null, data);
        this.emit('message', data);
      });
      
      wsTransport.onClose((reason) => {
        console.log('[TransportManager] WebSocket transport closed:', reason);
        this.emit('disconnected', reason);
        this.attemptReconnect();
      });
      
      wsTransport.onError((error) => {
        console.error('[TransportManager] WebSocket transport error:', error);
        this.trackError(error);
        this.emit('error', error);
      });
      
      // Attempt connection
      await wsTransport.connect();
      
      this.transport = wsTransport;
      this.transportType = TransportType.WebSocket;
      this.connectedAt = Date.now();
      this.setConnectionState('connected');
      this.emit('connected', TransportType.WebSocket);
      
      // Start metrics collection
      this.startMetricsCollection();
      
      console.log('[TransportManager] WebSocket connection successful');
    } catch (error) {
      console.error('[TransportManager] WebSocket connection failed:', error);
      throw error;
    }
  }

  /**
   * Schedule periodic QUIC retry when using cached WebSocket preference
   * Requirement 10.4: Periodically retry QUIC to detect if it becomes available
   */
  private scheduleQuicRetry(): void {
    if (!this.config.cachePreference || !this.isWebTransportSupported()) {
      return;
    }

    // Clear any existing retry timeout
    if (this.retryQuicTimeout) {
      clearTimeout(this.retryQuicTimeout);
    }

    this.retryQuicTimeout = setTimeout(async () => {
      console.log('[TransportManager] Attempting periodic QUIC retry...');
      
      const quicSuccess = await this.attemptQuicConnection();
      
      if (quicSuccess) {
        console.log('[TransportManager] QUIC now available, switching transport');
        // Disconnect WebSocket and connect via QUIC
        await this.disconnect();
        await this.connect();
      } else {
        // Schedule next retry
        this.scheduleQuicRetry();
      }
    }, this.config.retryQuicInterval);
  }

  /**
   * Disconnect from current transport
   */
  async disconnect(): Promise<void> {
    // Stop metrics collection
    this.stopMetricsCollection();

    // Clear retry timeout
    if (this.retryQuicTimeout) {
      clearTimeout(this.retryQuicTimeout);
      this.retryQuicTimeout = null;
    }

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }

    this.transportType = TransportType.Unknown;
    this.reconnectAttempts = 0;
    this.connectedAt = null;
    this.setConnectionState('disconnected');
    this.emit('disconnected', 'Manual disconnect');
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.transport?.isConnected() === true;
  }

  /**
   * Get current transport type
   */
  getTransportType(): TransportType {
    return this.transportType;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // ============================================
  // Unified Message Interface
  // ============================================

  /**
   * Send data through current transport
   * Requirement 5.4: Provide unified message interface
   */
  async send(data: ArrayBuffer, messageId?: string): Promise<void> {
    if (!this.transport || !this.isConnected()) {
      throw new Error('Not connected');
    }

    // Generate message ID if not provided
    const msgId = messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Track message sent
    this.trackMessageSent(msgId, data);

    await this.transport.send(data);
  }

  // ============================================
  // Event Management
  // ============================================

  /**
   * Register an event handler
   * Returns an unsubscribe function
   */
  on<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Remove an event handler
   */
  off<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit<K extends keyof TransportEvents>(
    event: K,
    ...args: Parameters<TransportEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[TransportManager] Error in ${event} handler:`, error);
        }
      });
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      console.log(`[TransportManager] State changed: ${state}`);
      this.emit('stateChange', state);
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('[TransportManager] Max reconnection attempts reached');
      this.setConnectionState('failed');
      return;
    }

    this.setConnectionState('reconnecting');
    this.reconnectAttempts++;
    this.metrics.reconnectCount++;

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(
      `[TransportManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('[TransportManager] Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, delay);
  }
}

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  quicUrl: import.meta.env.VITE_QUIC_URL || 'https://localhost:4433',
  websocketUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws',
  quicTimeout: 5000, // 5 seconds
  maxReconnectAttempts: Infinity,
  reconnectDelay: 1000, // 1 second
  cachePreference: true,
  cacheDuration: 3600000, // 1 hour
  retryQuicInterval: 300000, // 5 minutes
};
