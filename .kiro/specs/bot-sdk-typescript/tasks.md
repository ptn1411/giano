# Implementation Plan: Bot SDK (TypeScript)

## Overview

Triển khai Bot SDK cho phép developers xây dựng bot bằng TypeScript. SDK hỗ trợ cả WebSocket (realtime) và Webhook modes, với middleware architecture, auto-reconnect, và retry logic.

## Tasks

- [x] 1. Setup project structure and dependencies
  - Create package.json with dependencies (ws, express, axios)
  - Create tsconfig.json for TypeScript configuration
  - Setup jest.config.js for testing with ts-jest
  - Create src/ and tests/ directory structure
  - Install fast-check for property-based testing
  - _Requirements: All_

- [x] 2. Implement core types and error classes
  - [x] 2.1 Create types.ts with all TypeScript interfaces
    - Define Update, Message, Chat, User interfaces
    - Define InlineButton, SendMessageOptions interfaces
    - Define Logger interface and ConsoleLogger implementation
    - Define BotOptions interface
    - _Requirements: 11.2, 11.4, 15.5_

  - [x] 2.2 Create errors.ts with custom error classes
    - Implement BotError, InitializationError, ConnectionError, ValidationError
    - _Requirements: 1.5, 10.1_

  - [ ]* 2.3 Write property test for configuration serialization
    - **Property 17: Configuration Serialization Round-Trip**
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 3. Implement Bot Client class
  - [x] 3.1 Create bot.ts with Bot class constructor
    - Validate token is non-empty
    - Store token and merge options with defaults
    - Initialize ApiClient, UpdateRouter, EventEmitter
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property test for bot initialization
    - **Property 1: Bot Initialization Validates and Stores Configuration**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5**

  - [x] 3.3 Implement start() method for WebSocket mode
    - Create WebSocketManager instance
    - Call connect() and handle ready event
    - Set isRunning flag
    - _Requirements: 2.1_

  - [x] 3.4 Implement startWebhook() method for webhook mode
    - Create WebhookServer instance
    - Start server on specified port and path
    - Set isRunning flag
    - _Requirements: 3.1_

  - [x] 3.5 Implement stop() method for graceful shutdown
    - Stop accepting new updates
    - Disconnect WebSocket or close webhook server
    - Emit "stopped" event
    - _Requirements: 14.1, 14.4, 14.5_

  - [ ]* 3.6 Write property test for graceful shutdown
    - **Property 22: Graceful Shutdown Stops New Updates**
    - **Validates: Requirements 14.1, 14.5**

  - [x] 3.7 Implement handler registration methods (on, command, use)
    - Delegate to UpdateRouter for message/text/command handlers
    - Register event handlers on EventEmitter
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 9.1_

  - [x] 3.8 Implement sendMessage() method
    - Delegate to ApiClient.sendMessage()
    - _Requirements: 7.1_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement API Client with retry logic
  - [x] 5.1 Create api-client.ts with ApiClient class
    - Initialize axios client with baseURL and timeout
    - Store token, retry configuration, and logger
    - _Requirements: 7.1, 13.1_

  - [x] 5.2 Implement sendMessage() method
    - Construct POST request to /bot<TOKEN>/sendMessage
    - Include chat_id, text, reply_to_id, inline_keyboard in payload
    - Call requestWithRetry()
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 5.3 Write property test for message API request construction
    - **Property 12: Message API Request Construction**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

  - [x] 5.4 Implement requestWithRetry() method
    - Handle rate limit errors (429) - wait retry_after seconds
    - Handle client errors (4xx except 429) - reject immediately
    - Handle network/5xx errors - retry with exponential backoff
    - Emit "retry" event before each retry
    - Return last error after exhausting retries
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 5.5 Write property test for exponential backoff retry
    - **Property 18: API Retry with Exponential Backoff**
    - **Validates: Requirements 13.1, 13.5**

  - [ ]* 5.6 Write property test for rate limit handling
    - **Property 19: Rate Limit Handling**
    - **Validates: Requirements 13.2**

  - [ ]* 5.7 Write property test for selective retry
    - **Property 20: Selective Retry for Client Errors**
    - **Validates: Requirements 13.3**

  - [ ]* 5.8 Write property test for final error after retries
    - **Property 21: Final Error After Exhausted Retries**
    - **Validates: Requirements 13.4**

- [x] 6. Implement Context class
  - [x] 6.1 Create context.ts with Context class
    - Store update, message, and apiClient
    - Implement reply() method - calls sendMessage with replyToId
    - Implement replyWithButtons() method - includes inline_keyboard
    - Implement send() method - calls sendMessage without replyToId
    - Add convenience getters: chatId, userId, text
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.2 Write property test for context fields and methods
    - **Property 11: Context Provides Required Fields and Methods**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [x] 6.3 Implement button validation in replyWithButtons()
    - Validate each button has either callback_data or url (not both)
    - Throw ValidationError if invalid
    - _Requirements: 8.5_

  - [ ]* 6.4 Write property test for inline keyboard formatting
    - **Property 13: Inline Keyboard Formatting**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Update Router
  - [x] 8.1 Create update-router.ts with UpdateRouter class
    - Initialize handler arrays and maps
    - Store apiClient and logger references
    - _Requirements: 4.1, 4.2, 4.3, 5.1_

  - [x] 8.2 Implement on() method for handler registration
    - Store handlers in appropriate arrays (message, text, command)
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 8.3 Write property test for handler registration order
    - **Property 6: Handler Registration and Invocation Order**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 8.3 Implement command() method
    - Normalize command to lowercase
    - Store handler in commandHandlers map
    - _Requirements: 5.1_

  - [ ]* 8.4 Write property test for command case-insensitive matching
    - **Property 8: Command Registration and Case-Insensitive Matching**
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [x] 8.5 Implement use() method for middleware registration
    - Add middleware to middlewares array
    - _Requirements: 9.1_

  - [x] 8.6 Implement route() method
    - Create Context from update
    - Run middleware chain with next() support
    - Call runHandlers() after middleware completes
    - Catch and handle errors
    - _Requirements: 6.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 8.7 Write property test for middleware execution order
    - **Property 14: Middleware Execution Order and Control Flow**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

  - [x] 8.8 Implement runHandlers() method
    - Always call message handlers
    - Parse command if message starts with "/"
    - Call specific command handlers if command matches
    - Call general command handlers for all commands
    - Call text handlers for non-command text messages
    - Catch handler errors and call handleError()
    - _Requirements: 4.4, 5.2, 5.3, 5.5_

  - [ ]* 8.9 Write property test for command context construction
    - **Property 9: Command Context Construction**
    - **Validates: Requirements 5.3, 6.5**

  - [ ]* 8.10 Write property test for unmatched command fallback
    - **Property 10: Unmatched Command Fallback**
    - **Validates: Requirements 5.5**

  - [x] 8.11 Implement parseCommand() method
    - Check if text starts with "/"
    - Extract command name (lowercase) and arguments
    - Return null if not a command
    - _Requirements: 5.2_

  - [x] 8.12 Implement handleError() method
    - Call registered error handlers with error and context
    - Log to console.error if no handlers registered
    - Catch errors in error handlers
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 8.13 Write property test for error isolation
    - **Property 7: Error Isolation in Handlers**
    - **Validates: Requirements 4.5, 10.1**

  - [ ]* 8.14 Write property test for error handler invocation
    - **Property 15: Error Handler Invocation**
    - **Validates: Requirements 10.2, 10.3, 10.4**

  - [ ]* 8.15 Write property test for bot resilience
    - **Property 16: Bot Resilience After Errors**
    - **Validates: Requirements 10.5**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement WebSocket Manager
  - [x] 10.1 Create websocket-manager.ts with WebSocketManager class
    - Store token, wsUrl, updateRouter, logger
    - Initialize reconnection state variables
    - _Requirements: 2.1_

  - [x] 10.2 Implement connect() method
    - Create WebSocket connection with token in URL
    - Setup event handlers: open, message, close, error
    - Return promise that resolves on open
    - _Requirements: 2.1, 2.2_

  - [x] 10.3 Implement handleMessage() method
    - Parse JSON event data
    - Handle BotUpdate events - route to UpdateRouter
    - Handle BotConnected events - log authentication success
    - Track lastUpdateId for reconnection
    - _Requirements: 2.6, 9.6_

  - [ ]* 10.4 Write property test for update ID tracking
    - **Property 3: Update ID Tracking Across Reconnects**
    - **Validates: Requirements 2.6**

  - [x] 10.5 Implement scheduleReconnect() method
    - Check max reconnect attempts
    - Calculate exponential backoff delay
    - Schedule reconnect with setTimeout
    - _Requirements: 2.5_

  - [ ]* 10.6 Write property test for exponential backoff reconnection
    - **Property 2: Exponential Backoff for Reconnection**
    - **Validates: Requirements 2.5**

  - [x] 10.7 Implement disconnect() method
    - Set shouldReconnect to false
    - Close WebSocket connection
    - _Requirements: 14.2_

- [x] 11. Implement Webhook Server
  - [x] 11.1 Create webhook-server.ts with WebhookServer class
    - Initialize Express app with JSON middleware
    - Store port, path, updateRouter, logger
    - _Requirements: 3.1_

  - [x] 11.2 Implement start() method
    - Register POST handler for webhook path
    - Start HTTP server on specified port
    - Return promise that resolves when server is listening
    - _Requirements: 3.1_

  - [x] 11.3 Implement handleWebhook() method
    - Validate update payload has updateId and message
    - Route valid updates to UpdateRouter
    - Return HTTP 400 for invalid payloads
    - Return HTTP 200 for successful processing
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 11.4 Write property test for webhook payload parsing
    - **Property 4: Webhook Payload Parsing**
    - **Validates: Requirements 3.2**

  - [ ]* 11.5 Write property test for webhook error responses
    - **Property 5: Webhook Error Responses**
    - **Validates: Requirements 3.4, 3.5**

  - [x] 11.6 Implement stop() method
    - Close HTTP server gracefully
    - Wait for pending requests to complete
    - Return promise that resolves when server is closed
    - _Requirements: 14.3_

- [x] 12. Implement Logger
  - [x] 12.1 Implement ConsoleLogger in types.ts
    - Implement debug(), info(), error() methods
    - Check log level before logging
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ]* 12.2 Write property test for log level control
    - **Property 23: Log Level Controls Output**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4**

  - [ ]* 12.3 Write property test for custom logger injection
    - **Property 24: Custom Logger Injection**
    - **Validates: Requirements 15.5**

- [x] 13. Create public exports and documentation
  - [x] 13.1 Create index.ts with public exports
    - Export Bot class
    - Export all types and interfaces
    - Export error classes
    - _Requirements: 11.1_

  - [x] 13.2 Write README.md with usage examples
    - Quick start guide
    - WebSocket mode example
    - Webhook mode example
    - Command handler examples
    - Middleware examples
    - Error handling examples

  - [x] 13.3 Write API documentation comments (JSDoc)
    - Document all public methods and properties
    - Include parameter descriptions and return types
    - Add usage examples in comments

- [x] 14. Final checkpoint - Integration testing
  - [x] 14.1 Write integration test for WebSocket mode
    - Test full connection and message flow
    - Test reconnection behavior
    - Test graceful shutdown

  - [x] 14.2 Write integration test for webhook mode
    - Test webhook server startup
    - Test update processing
    - Test graceful shutdown

  - [x] 14.3 Write integration test for end-to-end message flow
    - Test sending and receiving messages
    - Test command handling
    - Test middleware execution

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Run all unit tests, property tests, and integration tests
  - Verify test coverage is adequate
  - Fix any remaining issues
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
