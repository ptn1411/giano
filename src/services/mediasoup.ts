/**
 * Mediasoup Client Service
 * Handles WebRTC media streaming via mediasoup SFU server
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { Device, types } from 'mediasoup-client';

type DeviceType = Device;
type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;
type RtpCapabilities = types.RtpCapabilities;
type TransportOptions = types.TransportOptions;
type RtpParameters = types.RtpParameters;
type MediaKind = types.MediaKind;
import { getMediasoupUrl } from '@/lib/config';

// Message types matching media-server/src/types.ts
interface ClientMessage {
  type: string;
  roomId?: string;
  oderId?: string;
  transportId?: string;
  dtlsParameters?: unknown;
  kind?: MediaKind;
  rtpParameters?: RtpParameters;
  producerId?: string;
  consumerId?: string;
  appData?: Record<string, unknown>;
}

interface ServerMessage {
  type: string;
  rtpCapabilities?: RtpCapabilities;
  id?: string;
  iceParameters?: TransportOptions['iceParameters'];
  iceCandidates?: TransportOptions['iceCandidates'];
  dtlsParameters?: TransportOptions['dtlsParameters'];
  producerId?: string;
  kind?: string;
  rtpParameters?: RtpParameters;
  oderId?: string;
  message?: string;
  existingProducers?: Array<{ oderId: string; producerId: string; kind: string }>;
}

export interface MediasoupEventHandlers {
  onNewProducer?: (oderId: string, producerId: string, kind: string) => void;
  onProducerRemoved?: (oderId: string, producerId: string, kind: string) => void;
  onParticipantJoined?: (oderId: string) => void;
  onParticipantLeft?: (oderId: string) => void;
  onConnectionStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'failed') => void;
  onError?: (error: Error) => void;
}

export class MediasoupService {
  private ws: WebSocket | null = null;
  private device: DeviceType | null = null;
  private producerTransport: Transport | null = null;
  private consumerTransport: Transport | null = null;
  private producers: Map<string, Producer> = new Map(); // kind -> Producer
  private consumers: Map<string, Consumer> = new Map(); // consumerId -> Consumer
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private requestId = 0;
  private currentRoomId: string | null = null;
  private currentOderId: string | null = null;
  private eventHandlers: MediasoupEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(handlers?: MediasoupEventHandlers) {
    if (handlers) {
      this.eventHandlers = handlers;
    }
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: MediasoupEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Connect to mediasoup signaling server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = getMediasoupUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[Mediasoup] Connected to signaling server');
        this.reconnectAttempts = 0;
        this.eventHandlers.onConnectionStateChange?.('connected');
        resolve();
      };

      this.ws.onclose = () => {
        console.log('[Mediasoup] Disconnected from signaling server');
        this.eventHandlers.onConnectionStateChange?.('disconnected');
        this.handleDisconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[Mediasoup] WebSocket error:', error);
        this.eventHandlers.onError?.(new Error('WebSocket connection error'));
        reject(new Error('Failed to connect to mediasoup server'));
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.eventHandlers.onConnectionStateChange?.('connecting');
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(data);
    } catch {
      console.error('[Mediasoup] Invalid JSON message');
      return;
    }

    // Handle broadcast events
    switch (message.type) {
      case 'newProducer':
        if (message.oderId && message.producerId && message.kind) {
          this.eventHandlers.onNewProducer?.(message.oderId, message.producerId, message.kind);
        }
        return;

      case 'producerRemoved':
        if (message.oderId && message.producerId && message.kind) {
          this.eventHandlers.onProducerRemoved?.(message.oderId, message.producerId, message.kind);
        }
        return;

      case 'participantJoined':
        if (message.oderId) {
          this.eventHandlers.onParticipantJoined?.(message.oderId);
        }
        return;

      case 'participantLeft':
        if (message.oderId) {
          this.eventHandlers.onParticipantLeft?.(message.oderId);
        }
        return;
    }

    // Handle request responses
    const pendingKey = this.getPendingKeyForResponse(message);
    if (pendingKey) {
      const pending = this.pendingRequests.get(pendingKey);
      if (pending) {
        this.pendingRequests.delete(pendingKey);
        if (message.type === 'error') {
          pending.reject(new Error(message.message || 'Unknown error'));
        } else {
          pending.resolve(message);
        }
      }
    }
  }

  /**
   * Get pending request key for a response message
   */
  private getPendingKeyForResponse(message: ServerMessage): string | null {
    const typeMap: Record<string, string> = {
      routerRtpCapabilities: 'getRouterRtpCapabilities',
      producerTransportCreated: 'createProducerTransport',
      consumerTransportCreated: 'createConsumerTransport',
      transportConnected: 'connectTransport',
      produced: 'produce',
      consumed: 'consume',
      consumerResumed: 'resumeConsumer',
      producerPaused: 'pauseProducer',
      producerResumed: 'resumeProducer',
      producerClosed: 'closeProducer',
      roomJoined: 'joinRoom',
      error: 'error',
    };

    const requestType = typeMap[message.type];
    if (!requestType) return null;

    // Find matching pending request
    for (const key of this.pendingRequests.keys()) {
      if (key.startsWith(requestType) || message.type === 'error') {
        return key;
      }
    }
    return null;
  }

  /**
   * Send a message and wait for response
   */
  private async sendRequest<T>(message: ClientMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestKey = `${message.type}_${++this.requestId}`;
      this.pendingRequests.set(requestKey, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestKey)) {
          this.pendingRequests.delete(requestKey);
          reject(new Error(`Request timeout: ${message.type}`));
        }
      }, 10000);

      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(): void {
    // Clear transports and producers/consumers
    this.producerTransport = null;
    this.consumerTransport = null;
    this.producers.clear();
    this.consumers.clear();

    // Attempt reconnection if in a room
    if (this.currentRoomId && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[Mediasoup] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      this.reconnectTimeout = setTimeout(async () => {
        try {
          await this.connect();
          if (this.currentRoomId && this.currentOderId) {
            await this.joinRoom(this.currentRoomId, this.currentOderId);
          }
        } catch (error) {
          console.error('[Mediasoup] Reconnection failed:', error);
          this.eventHandlers.onConnectionStateChange?.('failed');
        }
      }, 2000 * this.reconnectAttempts);
    }
  }

  /**
   * Load device with router RTP capabilities
   */
  async loadDevice(rtpCapabilities: RtpCapabilities): Promise<void> {
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });
    console.log('[Mediasoup] Device loaded');
  }

  /**
   * Get router RTP capabilities
   */
  async getRouterRtpCapabilities(roomId: string): Promise<RtpCapabilities> {
    const response = await this.sendRequest<ServerMessage>({
      type: 'getRouterRtpCapabilities',
      roomId,
    });
    return response.rtpCapabilities!;
  }

  /**
   * Create producer transport for sending media
   */
  async createProducerTransport(roomId: string): Promise<void> {
    if (!this.device) {
      throw new Error('Device not loaded');
    }

    const response = await this.sendRequest<ServerMessage>({
      type: 'createProducerTransport',
      roomId,
    });

    this.producerTransport = this.device.createSendTransport({
      id: response.id!,
      iceParameters: response.iceParameters!,
      iceCandidates: response.iceCandidates!,
      dtlsParameters: response.dtlsParameters!,
    });

    // Handle transport connect event
    this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.sendRequest({
          type: 'connectTransport',
          roomId,
          transportId: this.producerTransport!.id,
          dtlsParameters,
        });
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    // Handle transport produce event
    this.producerTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const response = await this.sendRequest<ServerMessage>({
          type: 'produce',
          roomId,
          transportId: this.producerTransport!.id,
          kind,
          rtpParameters,
          appData,
        });
        callback({ id: response.id! });
      } catch (error) {
        errback(error as Error);
      }
    });

    // Handle connection state changes
    this.producerTransport.on('connectionstatechange', (state) => {
      console.log('[Mediasoup] Producer transport state:', state);
      if (state === 'failed' || state === 'closed') {
        this.eventHandlers.onConnectionStateChange?.('failed');
      }
    });

    console.log('[Mediasoup] Producer transport created');
  }

  /**
   * Create consumer transport for receiving media
   */
  async createConsumerTransport(roomId: string): Promise<void> {
    if (!this.device) {
      throw new Error('Device not loaded');
    }

    const response = await this.sendRequest<ServerMessage>({
      type: 'createConsumerTransport',
      roomId,
    });

    this.consumerTransport = this.device.createRecvTransport({
      id: response.id!,
      iceParameters: response.iceParameters!,
      iceCandidates: response.iceCandidates!,
      dtlsParameters: response.dtlsParameters!,
    });

    // Handle transport connect event
    this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.sendRequest({
          type: 'connectTransport',
          roomId,
          transportId: this.consumerTransport!.id,
          dtlsParameters,
        });
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    // Handle connection state changes
    this.consumerTransport.on('connectionstatechange', (state) => {
      console.log('[Mediasoup] Consumer transport state:', state);
      if (state === 'failed' || state === 'closed') {
        this.eventHandlers.onConnectionStateChange?.('failed');
      }
    });

    console.log('[Mediasoup] Consumer transport created');
  }

  /**
   * Produce (send) a media track
   */
  async produce(track: MediaStreamTrack, kind: 'audio' | 'video'): Promise<Producer> {
    if (!this.producerTransport) {
      throw new Error('Producer transport not created');
    }

    // Close existing producer of same kind
    const existingProducer = this.producers.get(kind);
    if (existingProducer) {
      existingProducer.close();
      this.producers.delete(kind);
    }

    const producer = await this.producerTransport.produce({
      track,
      codecOptions: kind === 'audio' 
        ? { opusStereo: true, opusDtx: true }
        : undefined,
      appData: { kind },
    });

    this.producers.set(kind, producer);

    producer.on('transportclose', () => {
      console.log(`[Mediasoup] ${kind} producer transport closed`);
      this.producers.delete(kind);
    });

    producer.on('trackended', () => {
      console.log(`[Mediasoup] ${kind} track ended`);
      this.closeProducer(kind);
    });

    console.log(`[Mediasoup] ${kind} producer created:`, producer.id);
    return producer;
  }

  /**
   * Consume (receive) a remote producer's media
   */
  async consume(roomId: string, producerId: string): Promise<Consumer> {
    if (!this.consumerTransport || !this.device) {
      throw new Error('Consumer transport not created');
    }

    const response = await this.sendRequest<ServerMessage>({
      type: 'consume',
      roomId,
      producerId,
    });

    const consumer = await this.consumerTransport.consume({
      id: response.id!,
      producerId: response.producerId!,
      kind: response.kind as MediaKind,
      rtpParameters: response.rtpParameters!,
    });

    this.consumers.set(consumer.id, consumer);

    // Resume the consumer (server starts it paused)
    await this.sendRequest({
      type: 'resumeConsumer',
      roomId,
      consumerId: consumer.id,
    });

    consumer.on('transportclose', () => {
      console.log('[Mediasoup] Consumer transport closed');
      this.consumers.delete(consumer.id);
    });

    console.log(`[Mediasoup] Consumer created for producer ${producerId}:`, consumer.id);
    return consumer;
  }

  /**
   * Pause a producer
   */
  async pauseProducer(kind: 'audio' | 'video'): Promise<void> {
    const producer = this.producers.get(kind);
    if (!producer || !this.currentRoomId) {
      return;
    }

    await this.sendRequest({
      type: 'pauseProducer',
      roomId: this.currentRoomId,
      producerId: producer.id,
    });

    producer.pause();
    console.log(`[Mediasoup] ${kind} producer paused`);
  }

  /**
   * Resume a producer
   */
  async resumeProducer(kind: 'audio' | 'video'): Promise<void> {
    const producer = this.producers.get(kind);
    if (!producer || !this.currentRoomId) {
      return;
    }

    await this.sendRequest({
      type: 'resumeProducer',
      roomId: this.currentRoomId,
      producerId: producer.id,
    });

    producer.resume();
    console.log(`[Mediasoup] ${kind} producer resumed`);
  }

  /**
   * Close a producer
   */
  async closeProducer(kind: 'audio' | 'video'): Promise<void> {
    const producer = this.producers.get(kind);
    if (!producer || !this.currentRoomId) {
      return;
    }

    await this.sendRequest({
      type: 'closeProducer',
      roomId: this.currentRoomId,
      producerId: producer.id,
    });

    producer.close();
    this.producers.delete(kind);
    console.log(`[Mediasoup] ${kind} producer closed`);
  }

  /**
   * Join a mediasoup room
   */
  async joinRoom(roomId: string, oderId: string): Promise<Array<{ oderId: string; producerId: string; kind: string }>> {
    this.currentRoomId = roomId;
    this.currentOderId = oderId;

    // Join the room
    const response = await this.sendRequest<ServerMessage>({
      type: 'joinRoom',
      roomId,
      oderId,
    });

    // Get router capabilities and load device
    const rtpCapabilities = await this.getRouterRtpCapabilities(roomId);
    await this.loadDevice(rtpCapabilities);

    // Create transports
    await this.createProducerTransport(roomId);
    await this.createConsumerTransport(roomId);

    console.log('[Mediasoup] Joined room:', roomId);
    return response.existingProducers || [];
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    if (!this.currentRoomId) {
      return;
    }

    // Close all producers
    for (const [kind] of this.producers) {
      await this.closeProducer(kind as 'audio' | 'video');
    }

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    // Send leave room message
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      await this.sendRequest({
        type: 'leaveRoom',
        roomId: this.currentRoomId,
      });
    }

    // Close transports
    this.producerTransport?.close();
    this.consumerTransport?.close();
    this.producerTransport = null;
    this.consumerTransport = null;

    console.log('[Mediasoup] Left room:', this.currentRoomId);
    this.currentRoomId = null;
    this.currentOderId = null;
  }

  /**
   * Close the service and cleanup all resources
   */
  close(): void {
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close all producers
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    // Close transports
    this.producerTransport?.close();
    this.consumerTransport?.close();
    this.producerTransport = null;
    this.consumerTransport = null;

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear state
    this.device = null;
    this.currentRoomId = null;
    this.currentOderId = null;
    this.pendingRequests.clear();

    console.log('[Mediasoup] Service closed');
  }

  // Getters for state inspection
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get roomId(): string | null {
    return this.currentRoomId;
  }

  get hasProducerTransport(): boolean {
    return this.producerTransport !== null;
  }

  get hasConsumerTransport(): boolean {
    return this.consumerTransport !== null;
  }

  getProducer(kind: 'audio' | 'video'): Producer | undefined {
    return this.producers.get(kind);
  }

  getConsumer(consumerId: string): Consumer | undefined {
    return this.consumers.get(consumerId);
  }

  getAllConsumers(): Consumer[] {
    return Array.from(this.consumers.values());
  }
}

// Singleton instance for app-wide use
let mediasoupServiceInstance: MediasoupService | null = null;

export function getMediasoupService(handlers?: MediasoupEventHandlers): MediasoupService {
  if (!mediasoupServiceInstance) {
    mediasoupServiceInstance = new MediasoupService(handlers);
  } else if (handlers) {
    mediasoupServiceInstance.setEventHandlers(handlers);
  }
  return mediasoupServiceInstance;
}

export function resetMediasoupService(): void {
  if (mediasoupServiceInstance) {
    mediasoupServiceInstance.close();
    mediasoupServiceInstance = null;
  }
}

export default MediasoupService;
