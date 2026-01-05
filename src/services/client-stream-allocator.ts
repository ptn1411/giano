/**
 * Client-Side Stream Allocator
 * Manages stream allocation for different message types on QUIC connections
 * Requirements: 3.1
 */

// ============================================
// Types and Enums
// ============================================

/**
 * Message types that determine stream allocation
 * Requirement 3.1: Assign different message types to separate streams
 */
export enum MessageType {
  /** Control messages (authentication, presence, typing indicators) */
  Control = 'control',
  /** Chat messages */
  ChatMessage = 'chat',
  /** File transfers and media */
  FileTransfer = 'file',
  /** Bot commands and responses */
  BotCommand = 'bot',
}

/**
 * Range of stream IDs for a message type
 */
export interface StreamRange {
  /** Start of the range (inclusive) */
  start: number;
  /** End of the range (inclusive) */
  end: number;
}

/**
 * Stream type classification
 */
export enum StreamType {
  Control = 'control',
  ChatMessage = 'chat',
  FileTransfer = 'file',
  BotCommand = 'bot',
}

// ============================================
// Stream Allocator Errors
// ============================================

export class StreamAllocatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamAllocatorError';
  }
}

export class NoAvailableStreamsError extends StreamAllocatorError {
  constructor(messageType: MessageType) {
    super(`No available streams in range for message type: ${messageType}`);
    this.name = 'NoAvailableStreamsError';
  }
}

export class InvalidStreamIdError extends StreamAllocatorError {
  constructor(streamId: number) {
    super(`Invalid stream ID: ${streamId}`);
    this.name = 'InvalidStreamIdError';
  }
}

export class StreamAlreadyAllocatedError extends StreamAllocatorError {
  constructor(streamId: number) {
    super(`Stream already allocated: ${streamId}`);
    this.name = 'StreamAlreadyAllocatedError';
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the stream range for a message type
 * 
 * Stream allocation strategy from design:
 * - Stream 0: Control messages
 * - Stream 1-99: Chat messages
 * - Stream 100-199: File transfers and media
 * - Stream 200+: Bot commands and responses
 */
export function getStreamRange(messageType: MessageType): StreamRange {
  switch (messageType) {
    case MessageType.Control:
      return { start: 0, end: 0 };
    case MessageType.ChatMessage:
      return { start: 1, end: 99 };
    case MessageType.FileTransfer:
      return { start: 100, end: 199 };
    case MessageType.BotCommand:
      return { start: 200, end: 299 };
  }
}

/**
 * Determine message type from stream ID
 */
export function getMessageTypeFromStreamId(streamId: number): MessageType {
  if (streamId === 0) {
    return MessageType.Control;
  } else if (streamId >= 1 && streamId <= 99) {
    return MessageType.ChatMessage;
  } else if (streamId >= 100 && streamId <= 199) {
    return MessageType.FileTransfer;
  } else if (streamId >= 200 && streamId <= 299) {
    return MessageType.BotCommand;
  } else {
    throw new InvalidStreamIdError(streamId);
  }
}

/**
 * Check if a stream ID is within a range
 */
export function isStreamIdInRange(streamId: number, range: StreamRange): boolean {
  return streamId >= range.start && streamId <= range.end;
}

/**
 * Get the size of a stream range
 */
export function getStreamRangeSize(range: StreamRange): number {
  return range.end - range.start + 1;
}

// ============================================
// Client Stream Allocator
// ============================================

/**
 * Manages stream allocation for QUIC connections on the client side
 * 
 * Requirements:
 * - 3.1: Assign different message types to separate streams
 * - Track active streams
 * - Handle stream lifecycle (open, close)
 */
export class ClientStreamAllocator {
  /** Map of stream ID to message type */
  private activeStreams: Map<number, MessageType> = new Map();
  
  /** Next stream ID to allocate for each message type */
  private nextStreamId: Map<MessageType, number> = new Map();

  constructor() {
    // Initialize next stream IDs to the start of each range
    this.nextStreamId.set(MessageType.Control, 0);
    this.nextStreamId.set(MessageType.ChatMessage, 1);
    this.nextStreamId.set(MessageType.FileTransfer, 100);
    this.nextStreamId.set(MessageType.BotCommand, 200);
  }

  /**
   * Allocate a new stream for the given message type
   * 
   * Requirement 3.1: Assign different message types to separate streams
   * 
   * @param messageType - The type of message that will use this stream
   * @returns The allocated stream ID
   * @throws NoAvailableStreamsError if no streams are available in the range
   */
  allocateStream(messageType: MessageType): number {
    const range = getStreamRange(messageType);
    const nextId = this.nextStreamId.get(messageType) ?? range.start;

    // Find an available stream ID in the range
    let streamId = nextId;
    let attempts = 0;
    const maxAttempts = getStreamRangeSize(range);

    while (attempts < maxAttempts) {
      if (!this.activeStreams.has(streamId)) {
        // Found an available stream
        this.activeStreams.set(streamId, messageType);

        // Update next stream ID (wrap around within range)
        const next = streamId >= range.end ? range.start : streamId + 1;
        this.nextStreamId.set(messageType, next);

        return streamId;
      }

      // Try next stream ID (wrap around within range)
      streamId = streamId >= range.end ? range.start : streamId + 1;
      attempts++;
    }

    // No available streams in the range
    throw new NoAvailableStreamsError(messageType);
  }

  /**
   * Release a stream when it's closed
   * 
   * Requirement 3.1: Handle stream lifecycle
   * 
   * @param streamId - The stream ID to release
   * @throws InvalidStreamIdError if the stream ID is not allocated
   */
  releaseStream(streamId: number): void {
    if (!this.activeStreams.has(streamId)) {
      throw new InvalidStreamIdError(streamId);
    }
    this.activeStreams.delete(streamId);
  }

  /**
   * Get the message type for a stream
   * 
   * @param streamId - The stream ID to query
   * @returns The message type, or undefined if not allocated
   */
  getStreamType(streamId: number): MessageType | undefined {
    return this.activeStreams.get(streamId);
  }

  /**
   * Get all active stream IDs
   * 
   * @returns Array of active stream IDs
   */
  getActiveStreams(): number[] {
    return Array.from(this.activeStreams.keys());
  }

  /**
   * Get the number of active streams
   * 
   * @returns Total number of active streams
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Get the number of active streams for a specific message type
   * 
   * @param messageType - The message type to query
   * @returns Number of active streams for that type
   */
  getActiveStreamCountForType(messageType: MessageType): number {
    let count = 0;
    for (const type of this.activeStreams.values()) {
      if (type === messageType) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if a stream is allocated
   * 
   * @param streamId - The stream ID to check
   * @returns True if the stream is allocated
   */
  isStreamAllocated(streamId: number): boolean {
    return this.activeStreams.has(streamId);
  }

  /**
   * Clear all allocated streams
   * Useful for cleanup when disconnecting
   */
  clearAllStreams(): void {
    this.activeStreams.clear();
  }

  /**
   * Get statistics about stream allocation
   * 
   * @returns Object containing allocation statistics
   */
  getStats(): {
    totalStreams: number;
    controlStreams: number;
    chatStreams: number;
    fileStreams: number;
    botStreams: number;
  } {
    let controlStreams = 0;
    let chatStreams = 0;
    let fileStreams = 0;
    let botStreams = 0;

    for (const type of this.activeStreams.values()) {
      switch (type) {
        case MessageType.Control:
          controlStreams++;
          break;
        case MessageType.ChatMessage:
          chatStreams++;
          break;
        case MessageType.FileTransfer:
          fileStreams++;
          break;
        case MessageType.BotCommand:
          botStreams++;
          break;
      }
    }

    return {
      totalStreams: this.activeStreams.size,
      controlStreams,
      chatStreams,
      fileStreams,
      botStreams,
    };
  }
}
