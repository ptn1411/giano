# Requirements Document

## Introduction

Bot SDK là thư viện TypeScript cho phép developers dễ dàng xây dựng bot cho hệ thống chat. SDK cung cấp API đơn giản để nhận và xử lý tin nhắn, gửi phản hồi, và quản lý bot state. SDK hỗ trợ cả WebSocket (realtime) và Webhook modes.

## Glossary

- **Bot_SDK**: Thư viện TypeScript cung cấp API để xây dựng bot
- **Bot_Client**: Class chính của SDK quản lý kết nối và message handling
- **Message_Handler**: Function callback xử lý tin nhắn đến
- **Command_Handler**: Function callback xử lý lệnh cụ thể
- **Context**: Object chứa thông tin về message và các helper methods
- **Middleware**: Function xử lý message trước khi đến handler
- **Bot_Token**: Token xác thực bot với backend API
- **Update**: Thông báo về message mới từ server
- **Reply_Keyboard**: Bàn phím tùy chỉnh hiển thị cho user
- **Inline_Keyboard**: Buttons inline trong message

## Requirements

### Requirement 1: Bot Client Initialization

**User Story:** As a bot developer, I want to initialize a bot client with my token, so that I can start building my bot.

#### Acceptance Criteria

1. WHEN a developer creates a Bot instance with a valid token, THE Bot_SDK SHALL store the token for authentication
2. WHEN a developer creates a Bot instance with connection options, THE Bot_SDK SHALL store the API base URL and WebSocket URL
3. WHEN a developer creates a Bot instance without specifying connection mode, THE Bot_SDK SHALL default to WebSocket mode
4. THE Bot_SDK SHALL validate that the token is a non-empty string
5. IF the token is empty or invalid format, THEN THE Bot_SDK SHALL throw an initialization error

### Requirement 2: WebSocket Connection Management

**User Story:** As a bot developer, I want my bot to connect via WebSocket, so that I can receive messages in real-time.

#### Acceptance Criteria

1. WHEN a developer calls bot.start() in WebSocket mode, THE Bot_SDK SHALL establish a WebSocket connection to the server
2. WHEN the WebSocket connection is established, THE Bot_SDK SHALL authenticate using the bot token
3. WHEN authentication succeeds, THE Bot_SDK SHALL emit a "ready" event
4. IF authentication fails, THEN THE Bot_SDK SHALL emit an "error" event and close the connection
5. WHEN the WebSocket connection drops, THE Bot_SDK SHALL automatically attempt to reconnect with exponential backoff
6. WHEN reconnecting, THE Bot_SDK SHALL resume from the last processed update_id

### Requirement 3: Webhook Server Setup

**User Story:** As a bot developer, I want to run my bot in webhook mode, so that I can deploy it on serverless platforms.

#### Acceptance Criteria

1. WHEN a developer calls bot.startWebhook() with a port and path, THE Bot_SDK SHALL start an HTTP server listening on that port
2. WHEN the webhook server receives a POST request to the specified path, THE Bot_SDK SHALL parse the update payload
3. WHEN the webhook server receives a valid update, THE Bot_SDK SHALL process it through registered handlers
4. WHEN the webhook server receives an invalid payload, THE Bot_SDK SHALL return HTTP 400 error
5. THE Bot_SDK SHALL respond with HTTP 200 after successfully processing an update

### Requirement 4: Message Handler Registration

**User Story:** As a bot developer, I want to register handlers for different message types, so that I can respond to user messages.

#### Acceptance Criteria

1. WHEN a developer calls bot.on('message', handler), THE Bot_SDK SHALL register the handler for all messages
2. WHEN a developer calls bot.on('text', handler), THE Bot_SDK SHALL register the handler for text messages only
3. WHEN a developer calls bot.on('command', handler), THE Bot_SDK SHALL register the handler for all command messages
4. WHEN multiple handlers are registered for the same event, THE Bot_SDK SHALL call them in registration order
5. WHEN a handler throws an error, THE Bot_SDK SHALL catch it and emit an "error" event without stopping other handlers

### Requirement 5: Command Handler Registration

**User Story:** As a bot developer, I want to register handlers for specific commands, so that I can implement bot commands easily.

#### Acceptance Criteria

1. WHEN a developer calls bot.command('start', handler), THE Bot_SDK SHALL register the handler for /start command
2. WHEN a command message is received, THE Bot_SDK SHALL extract the command name and match it to registered handlers
3. WHEN a command matches, THE Bot_SDK SHALL call the handler with a context containing command and args
4. THE Bot_SDK SHALL match commands case-insensitively (e.g., /START matches 'start' handler)
5. WHEN no handler matches a command, THE Bot_SDK SHALL not call any command handler but still call general message handlers

### Requirement 6: Context Object

**User Story:** As a bot developer, I want a context object with message info and helper methods, so that I can easily respond to messages.

#### Acceptance Criteria

1. WHEN a handler is called, THE Bot_SDK SHALL provide a Context object as the first parameter
2. THE Context object SHALL include message.id, message.text, message.chat.id, and message.from.id
3. THE Context object SHALL include a reply() method that sends a message to the same chat
4. THE Context object SHALL include a replyWithKeyboard() method that sends a message with a custom keyboard
5. THE Context object SHALL include parsed command and args when handling a command

### Requirement 7: Sending Messages

**User Story:** As a bot developer, I want to send messages to chats, so that my bot can respond to users.

#### Acceptance Criteria

1. WHEN a developer calls bot.sendMessage(chatId, text), THE Bot_SDK SHALL send a POST request to /bot<TOKEN>/sendMessage
2. WHEN sending a message, THE Bot_SDK SHALL include chat_id and text in the request body
3. WHEN sending a message with reply_to, THE Bot_SDK SHALL include reply_to_id in the request body
4. WHEN the API returns success, THE Bot_SDK SHALL resolve the promise with the message object
5. IF the API returns an error, THEN THE Bot_SDK SHALL reject the promise with the error details

### Requirement 8: Inline Keyboards

**User Story:** As a bot developer, I want to send messages with inline buttons, so that users can interact with my bot through buttons.

#### Acceptance Criteria

1. WHEN a developer calls ctx.replyWithButtons(text, buttons), THE Bot_SDK SHALL send a message with inline_keyboard
2. THE Bot_SDK SHALL format buttons as an array of rows, where each row is an array of button objects
3. WHEN a button has callback_data, THE Bot_SDK SHALL include it in the button object
4. WHEN a button has url, THE Bot_SDK SHALL include it in the button object
5. THE Bot_SDK SHALL validate that each button has either callback_data or url (not both)

### Requirement 9: Middleware Support

**User Story:** As a bot developer, I want to use middleware functions, so that I can add logging, authentication, or other cross-cutting concerns.

#### Acceptance Criteria

1. WHEN a developer calls bot.use(middleware), THE Bot_SDK SHALL register the middleware function
2. WHEN an update is received, THE Bot_SDK SHALL call all middleware functions in registration order before handlers
3. WHEN a middleware calls next(), THE Bot_SDK SHALL proceed to the next middleware or handler
4. WHEN a middleware does not call next(), THE Bot_SDK SHALL stop processing the update
5. WHEN a middleware throws an error, THE Bot_SDK SHALL emit an "error" event and stop processing

### Requirement 10: Error Handling

**User Story:** As a bot developer, I want to handle errors gracefully, so that my bot doesn't crash on unexpected errors.

#### Acceptance Criteria

1. WHEN any handler or middleware throws an error, THE Bot_SDK SHALL catch it and emit an "error" event
2. WHEN a developer registers an error handler with bot.on('error', handler), THE Bot_SDK SHALL call it with the error
3. WHEN an API request fails, THE Bot_SDK SHALL emit an "error" event with the API error details
4. WHEN no error handler is registered, THE Bot_SDK SHALL log the error to console.error
5. THE Bot_SDK SHALL continue running after handling an error (not crash)

### Requirement 11: TypeScript Type Definitions

**User Story:** As a bot developer using TypeScript, I want full type definitions, so that I get autocomplete and type checking.

#### Acceptance Criteria

1. THE Bot_SDK SHALL export TypeScript type definitions for all public APIs
2. THE Bot_SDK SHALL define types for Context, Message, Update, and all API request/response objects
3. THE Bot_SDK SHALL use generic types for handler functions to ensure type safety
4. THE Bot_SDK SHALL export types for keyboard buttons and inline keyboards
5. WHEN a developer imports the SDK in TypeScript, they SHALL get full IntelliSense support

### Requirement 12: Configuration Serialization

**User Story:** As a developer, I want bot configuration to be properly serialized, so that I can save and restore bot settings.

#### Acceptance Criteria

1. WHEN serializing bot configuration to JSON, THE Bot_SDK SHALL include all connection settings
2. WHEN deserializing bot configuration from JSON, THE Bot_SDK SHALL restore all settings correctly
3. FOR ALL valid bot configurations, serializing then deserializing SHALL produce an equivalent configuration object (round-trip property)

### Requirement 13: API Client with Retry Logic

**User Story:** As a bot developer, I want automatic retry for failed API requests, so that temporary network issues don't break my bot.

#### Acceptance Criteria

1. WHEN an API request fails with a network error, THE Bot_SDK SHALL retry up to 3 times with exponential backoff
2. WHEN an API request fails with a rate limit error (429), THE Bot_SDK SHALL wait for retry_after seconds before retrying
3. WHEN an API request fails with a client error (4xx except 429), THE Bot_SDK SHALL not retry and reject immediately
4. WHEN all retries are exhausted, THE Bot_SDK SHALL reject the promise with the last error
5. THE Bot_SDK SHALL emit a "retry" event before each retry attempt

### Requirement 14: Graceful Shutdown

**User Story:** As a bot developer, I want to gracefully shutdown my bot, so that I can stop it cleanly without losing messages.

#### Acceptance Criteria

1. WHEN a developer calls bot.stop(), THE Bot_SDK SHALL stop accepting new updates
2. WHEN stopping in WebSocket mode, THE Bot_SDK SHALL close the WebSocket connection gracefully
3. WHEN stopping in webhook mode, THE Bot_SDK SHALL close the HTTP server and wait for pending requests
4. WHEN all pending handlers complete, THE Bot_SDK SHALL emit a "stopped" event
5. THE Bot_SDK SHALL resolve the stop() promise after cleanup is complete

### Requirement 15: Logging and Debugging

**User Story:** As a bot developer, I want configurable logging, so that I can debug issues in development and reduce noise in production.

#### Acceptance Criteria

1. WHEN a developer sets logLevel to 'debug', THE Bot_SDK SHALL log all events including raw updates
2. WHEN a developer sets logLevel to 'info', THE Bot_SDK SHALL log connection events and errors only
3. WHEN a developer sets logLevel to 'error', THE Bot_SDK SHALL log errors only
4. WHEN a developer sets logLevel to 'none', THE Bot_SDK SHALL not log anything
5. THE Bot_SDK SHALL allow custom logger injection for integration with existing logging systems
