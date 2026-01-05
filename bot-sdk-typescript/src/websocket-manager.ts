// WebSocket Manager for Bot SDK
// Manages WebSocket connection with auto-reconnect and exponential backoff

import WebSocket from 'ws';
import { Update, Logger } from './types';
import { UpdateRouter } from './update-router';
import { ConnectionError } from './errors';

/**
 * WebSocketManager class
 * Manages WebSocket connection with auto-reconnect functionality
 * (Requirement 2.1)
 */
export class WebSocketManager {
  private ws?: WebSocket;
  private token: string;
  private wsUrl: string;
  private updateRouter: UpdateRouter;
  private logger: Logger;
  
  // Reconnection state variables (Requirement 2.5)
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private isConnected: boolean = false;
  private shouldReconnect: boolean = true;
  
  // Track last update ID for reconnection (Requirement 2.6)
  // This will be used in future enhancement to resume from last processed update
  private lastUpdateId?: string;

  constructor(
    token: string,
    wsUrl: string,
    updateRouter: UpdateRouter,
    logger: Logger
  ) {
    this.token = token;
    this.wsUrl = wsUrl;
    this.updateRouter = updateRouter;
    this.logger = logger;
  }

  /**
   * Get the last processed update ID
   * Used for reconnection to resume from the correct point
   * (Requirement 2.6)
   */
  getLastUpdateId(): string | undefined {
    return this.lastUpdateId;
  }

  /**
   * Connect to WebSocket server
   * Creates WebSocket connection with token in URL
   * Sets up event handlers: open, message, close, error
   * Returns promise that resolves on open
   * (Requirements 2.1, 2.2)
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create WebSocket connection with token in URL (Requirement 2.1)
      const url = `${this.wsUrl}?token=${this.token}`;
      this.ws = new WebSocket(url);

      // Setup event handler: open (Requirement 2.2, 2.3)
      this.ws.on('open', () => {
        this.logger.info('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      // Setup event handler: message (Requirement 2.6)
      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      // Setup event handler: close (Requirement 2.5)
      this.ws.on('close', () => {
        this.logger.info('WebSocket closed');
        this.isConnected = false;
        
        // Automatically attempt to reconnect if shouldReconnect is true
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      // Setup event handler: error (Requirement 2.4)
      this.ws.on('error', (error: Error) => {
        this.logger.error('WebSocket error:', error);
        
        // If not connected yet, reject the promise
        if (!this.isConnected) {
          reject(new ConnectionError(`Failed to connect: ${error.message}`));
        }
      });
    });
  }

  /**
   * Disconnect from WebSocket server
   * Sets shouldReconnect to false and closes WebSocket connection
   * (Requirement 14.2)
   */
  async disconnect(): Promise<void> {
    // Set shouldReconnect to false to prevent auto-reconnect
    this.shouldReconnect = false;
    
    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Handle incoming WebSocket message
   * Parses JSON event data and routes to UpdateRouter
   * Handles BotUpdate and BotConnected events
   * Tracks lastUpdateId for reconnection
   * (Requirements 2.6, 9.6)
   */
  private handleMessage(data: string): void {
    try {
      // Parse JSON event data
      const event = JSON.parse(data);
      
      // Handle BotUpdate events - route to UpdateRouter (Requirement 2.6)
      if (event.event === 'BotUpdate') {
        const update: Update = {
          updateId: event.data.updateId,
          message: event.data.message,
        };
        
        // Track lastUpdateId for reconnection (Requirement 2.6)
        this.lastUpdateId = update.updateId;
        
        // Route to UpdateRouter
        this.updateRouter.route(update);
      } 
      // Handle BotConnected events - log authentication success (Requirement 2.3)
      else if (event.event === 'BotConnected') {
        this.logger.info('Bot authenticated:', event.data.botName);
      }
    } catch (error) {
      this.logger.error('Failed to parse message:', error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * Checks max reconnect attempts and calculates delay
   * Schedules reconnect with setTimeout
   * (Requirement 2.5)
   */
  private scheduleReconnect(): void {
    // Check max reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached');
      return;
    }

    // Calculate exponential backoff delay
    // delay = baseDelay * 2^attemptNumber
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    // Schedule reconnect with setTimeout
    setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error('Reconnect failed:', error);
      });
    }, delay);
  }
}
