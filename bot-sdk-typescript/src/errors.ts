// Custom error classes for Bot SDK

/**
 * Bot API error
 * Thrown when the Bot API returns an error response
 */
export class BotError extends Error {
  /**
   * Create a new BotError
   * @param errorCode - HTTP error code from the API
   * @param description - Human-readable error description
   */
  constructor(
    public errorCode: number,
    public description: string
  ) {
    super(description);
    this.name = 'BotError';
    Object.setPrototypeOf(this, BotError.prototype);
  }
}

/**
 * Initialization error
 * Thrown when bot initialization fails (e.g., invalid token, already running)
 */
export class InitializationError extends Error {
  /**
   * Create a new InitializationError
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'InitializationError';
    Object.setPrototypeOf(this, InitializationError.prototype);
  }
}

/**
 * Connection error
 * Thrown when WebSocket connection fails
 */
export class ConnectionError extends Error {
  /**
   * Create a new ConnectionError
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Validation error
 * Thrown when input validation fails (e.g., invalid button configuration)
 */
export class ValidationError extends Error {
  /**
   * Create a new ValidationError
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
