/**
 * QUIC Transport Client
 * Implements WebTransport API for QUIC connections
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { TransportInterface, TransportType } from './transport-manager';

// ============================================
// Types and Interfaces
// ============================================

export enum StreamType {
  Control = 'control',
  ChatMessage = 'chat',
  FileTransfer = 'file',
  BotCommand = 'bot',
}

interface StreamInfo {
  type: StreamType;
  stream: WebTransportBidirectionalStream;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  writer: WritableStreamDefaultWriter<Uint8Array>;
}

// ============================================
// Client Stream Allocator
// ============================================

/**
 * Allocates streams for different message types
 * Requirement 3.1: Assign different message types to separate streams
 */
export class ClientStreamAllocator {
  private nextStreamId: number = 0;
  private streamTypes: Map<number, StreamType> = new Map();

  /**
   * Allocate a stream ID for a given message type
   */
  allocate(messageType: StreamType): number {
    const streamId = this.nextStreamId++;
    this.streamTypes.set(streamId, messageType);
    return streamId;
  }

  /**
   * Get the stream type for a given stream ID
   */
  getType(streamId: number): StreamType | undefined {
    return this.streamTypes.get(streamId);
  }

  /**
   * Release a stream ID
   */
  release(streamId: number): void {
    this.streamTypes.delete(streamId);
  }

  /**
   * Get stream range for a message type
   * Stream 0: Control messages
   * Stream 1-99: Chat messages
   * Stream 100-199: File transfers
   * Stream 200+: Bot commands
   */
  getStreamRange(messageType: StreamType): { start: number; end: number } {
    switch (messageType) {
      case StreamType.Control:
        return { start: 0, end: 0 };
      case StreamType.ChatMessage:
        return { start: 1, end: 99 };
      case StreamType.FileTransfer:
        return { start: 100, end: 199 };
      case StreamType.BotCommand:
        return { start: 200, end: Number.MAX_SAFE_INTEGER };
    }
  }
}

// ============================================
// QUIC Transport Class
// ============================================

/**
 * QUIC Transport implementation using WebTransport API
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export class QuicTransport implements TransportInterface {
  private transport: WebTransport | null = null;
  private url: string;
  private connected: boolean = false;
  private streams: Map<number, StreamInfo> = new Map();
  private streamAllocator: ClientStreamAllocator;
  private connectionHealthInterval: ReturnType<typeof setInterval> | null = null;
  private lastActivityTime: number = Date.now();
  private healthCheckInterval: number = 10000; // 10 seconds
  private connectionTimeout: number = 30000; // 30 seconds

  // Event callbacks
  private messageCallback: ((data: ArrayBuffer) => void) | null = null;
  private closeCallback: ((reason: string) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.streamAllocator = new ClientStreamAllocator();
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Establish WebTransport connection to server
   * Requirement 2.1: QUIC transport available as connection option
   * Requirement 2.2: Negotiate protocol parameters with server
   */
  async connect(): Promise<void> {
    if (this.connected || this.transport) {
      console.log('[QuicTransport] Already connected or connecting');
      return;
    }

    try {
      console.log(`[QuicTransport] Connecting to ${this.url}...`);

      // Create WebTransport connection
      this.transport = new WebTransport(this.url);

      // Wait for connection to be ready
      await this.transport.ready;

      console.log('[QuicTransport] Connection established');
      this.connected = true;
      this.lastActivityTime = Date.now();

      // Start listening for incoming streams
      this.startIncomingStreamListener();

      // Start connection health monitoring
      this.startHealthMonitoring();
    } catch (error) {
      console.error('[QuicTransport] Connection failed:', error);
      this.connected = false;
      this.transport = null;
      
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    console.log('[QuicTransport] Disconnecting...');

    // Stop health monitoring
    this.stopHealthMonitoring();

    // Close all active streams
    for (const [streamId, streamInfo] of this.streams.entries()) {
      try {
        await streamInfo.reader.cancel();
        await streamInfo.writer.close();
      } catch (error) {
        console.error(`[QuicTransport] Error closing stream ${streamId}:`, error);
      }
      this.streamAllocator.release(streamId);
    }
    this.streams.clear();

    // Close transport
    if (this.transport) {
      try {
        this.transport.close();
      } catch (error) {
        console.error('[QuicTransport] Error closing transport:', error);
      }
      this.transport = null;
    }

    this.connected = false;
    console.log('[QuicTransport] Disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.transport !== null;
  }

  /**
   * Get transport type
   */
  getType(): TransportType {
    return TransportType.Quic;
  }

  // ============================================
  // Message Sending (Subtask 13.2)
  // ============================================

  /**
   * Send data via QUIC stream
   * Requirement 2.3: Serialize messages and transmit via QUIC streams
   */
  async send(data: ArrayBuffer, streamType: StreamType = StreamType.ChatMessage): Promise<void> {
    if (!this.connected || !this.transport) {
      throw new Error('Not connected');
    }

    try {
      // Create a new bidirectional stream
      const stream = await this.transport.createBidirectionalStream();
      const writer = stream.writable.getWriter();

      // Allocate stream ID
      const streamId = this.streamAllocator.allocate(streamType);

      console.log(`[QuicTransport] Sending ${data.byteLength} bytes on stream ${streamId} (${streamType})`);

      // Write data to stream
      const uint8Array = new Uint8Array(data);
      await writer.write(uint8Array);
      await writer.close();

      // Update activity time
      this.lastActivityTime = Date.now();

      // Release stream ID after sending
      this.streamAllocator.release(streamId);
    } catch (error) {
      console.error('[QuicTransport] Error sending data:', error);
      
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
      
      throw error;
    }
  }

  // ============================================
  // Message Receiving (Subtask 13.3)
  // ============================================

  /**
   * Start listening for incoming streams
   * Requirement 2.4: Deserialize JSON messages and emit to application
   */
  private async startIncomingStreamListener(): Promise<void> {
    if (!this.transport) {
      return;
    }

    try {
      const reader = this.transport.incomingBidirectionalStreams.getReader();

      // Listen for incoming streams
      while (this.connected) {
        const { value: stream, done } = await reader.read();

        if (done) {
          console.log('[QuicTransport] Incoming stream reader closed');
          break;
        }

        if (stream) {
          // Handle stream in background
          this.handleIncomingStream(stream).catch((error) => {
            console.error('[QuicTransport] Error handling incoming stream:', error);
          });
        }
      }
    } catch (error) {
      console.error('[QuicTransport] Error in incoming stream listener:', error);
      
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
    }
  }

  /**
   * Handle an incoming bidirectional stream
   */
  private async handleIncomingStream(stream: WebTransportBidirectionalStream): Promise<void> {
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];

    try {
      // Read all chunks from the stream
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        if (value) {
          chunks.push(value);
          this.lastActivityTime = Date.now();
        }
      }

      // Combine chunks into a single ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`[QuicTransport] Received ${combined.byteLength} bytes`);

      // Emit message event
      if (this.messageCallback && combined.byteLength > 0) {
        this.messageCallback(combined.buffer);
      }
    } catch (error) {
      console.error('[QuicTransport] Error reading from stream:', error);
      
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ============================================
  // Connection Health Monitoring (Subtask 13.5)
  // ============================================

  /**
   * Start connection health monitoring
   * Requirement 2.5: Monitor connection health and detect failures
   */
  private startHealthMonitoring(): void {
    this.stopHealthMonitoring();

    this.connectionHealthInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, this.healthCheckInterval);

    console.log('[QuicTransport] Health monitoring started');
  }

  /**
   * Stop connection health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.connectionHealthInterval) {
      clearInterval(this.connectionHealthInterval);
      this.connectionHealthInterval = null;
      console.log('[QuicTransport] Health monitoring stopped');
    }
  }

  /**
   * Check connection health
   * Detects failures and timeouts
   */
  private checkConnectionHealth(): void {
    if (!this.connected || !this.transport) {
      return;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;

    // Check if connection has timed out
    if (timeSinceLastActivity > this.connectionTimeout) {
      console.warn('[QuicTransport] Connection timeout detected');
      
      const error = new Error('Connection timeout: no activity detected');
      
      if (this.errorCallback) {
        this.errorCallback(error);
      }

      // Trigger close callback
      if (this.closeCallback) {
        this.closeCallback('Connection timeout');
      }

      // Disconnect
      this.disconnect().catch((err) => {
        console.error('[QuicTransport] Error during timeout disconnect:', err);
      });
    }

    // Check transport state
    if (this.transport.closed) {
      this.transport.closed
        .then(() => {
          console.log('[QuicTransport] Transport closed gracefully');
          
          if (this.closeCallback) {
            this.closeCallback('Transport closed');
          }
        })
        .catch((error) => {
          console.error('[QuicTransport] Transport closed with error:', error);
          
          if (this.errorCallback) {
            this.errorCallback(error);
          }
          
          if (this.closeCallback) {
            this.closeCallback(`Transport error: ${error.message}`);
          }
        });
    }
  }

  // ============================================
  // Event Callbacks
  // ============================================

  /**
   * Register message callback
   */
  onMessage(callback: (data: ArrayBuffer) => void): void {
    this.messageCallback = callback;
  }

  /**
   * Register close callback
   */
  onClose(callback: (reason: string) => void): void {
    this.closeCallback = callback;
  }

  /**
   * Register error callback
   */
  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get last activity time (for testing)
   */
  getLastActivityTime(): number {
    return this.lastActivityTime;
  }

  /**
   * Get active stream count (for testing)
   */
  getActiveStreamCount(): number {
    return this.streams.size;
  }

  /**
   * Set health check interval (for testing)
   */
  setHealthCheckInterval(interval: number): void {
    this.healthCheckInterval = interval;
    
    if (this.connectionHealthInterval) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Set connection timeout (for testing)
   */
  setConnectionTimeout(timeout: number): void {
    this.connectionTimeout = timeout;
  }
}
