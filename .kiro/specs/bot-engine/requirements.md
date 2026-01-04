# Requirements Document

## Introduction

Hệ thống Bot Engine cho phép tạo và quản lý các bot tự động trong ứng dụng chat. Bot hoạt động như một chương trình độc lập với token và webhook, có khả năng nhận và xử lý tin nhắn, phản hồi lệnh, và tương tác với người dùng thông qua API tương tự Telegram Bot API.

## Glossary

- **Bot**: Chương trình tự động được định danh bằng token, có khả năng nhận và gửi tin nhắn trong các chat được phép
- **Bot_Engine**: Hệ thống xử lý trung tâm điều phối việc phân tích lệnh, kiểm tra quyền và gọi webhook
- **Command_Parser**: Module phân tích tin nhắn bắt đầu bằng "/" thành lệnh và tham số
- **Bot_Dispatcher**: Module điều phối gọi webhook đến các bot đã đăng ký
- **Webhook**: URL endpoint mà bot đăng ký để nhận thông báo về tin nhắn mới
- **Bot_Token**: Chuỗi định danh duy nhất để xác thực bot khi gọi API
- **Bot_Scope**: Quyền hạn cụ thể của bot (send_message, ban_user, read_message)
- **Bot_Chat**: Mối quan hệ giữa bot và chat mà bot được phép hoạt động
- **Command_Context**: Thông tin ngữ cảnh của lệnh bao gồm user_id, chat_id, message_id, text

## Requirements

### Requirement 1: Bot Registration and Management

**User Story:** As a developer, I want to create and manage bots, so that I can build automated services for chat users.

#### Acceptance Criteria

1. WHEN a user creates a new bot with a name, THE Bot_Engine SHALL generate a unique token and store the bot in the database
2. WHEN a bot is created, THE Bot_Engine SHALL associate the bot with the owner_id of the creating user
3. WHEN a user requests to deactivate a bot, THE Bot_Engine SHALL set is_active to false and stop processing messages for that bot
4. WHEN a user requests to reactivate a bot, THE Bot_Engine SHALL set is_active to true and resume processing messages
5. WHEN a user requests to delete a bot, THE Bot_Engine SHALL remove the bot and all associated permissions and chat subscriptions

### Requirement 2: Bot Webhook Configuration

**User Story:** As a bot developer, I want to configure a webhook URL for my bot, so that my bot can receive message updates.

#### Acceptance Criteria

1. WHEN a bot owner calls setWebhook API with a valid URL, THE Bot_Engine SHALL store the webhook_url for that bot
2. WHEN a bot owner calls setWebhook API with an empty URL, THE Bot_Engine SHALL clear the webhook_url for that bot
3. IF a webhook URL is invalid or unreachable, THEN THE Bot_Engine SHALL return an error and not update the webhook_url
4. WHEN a webhook is set, THE Bot_Engine SHALL send a test request to verify connectivity

### Requirement 3: Bot Permission Management

**User Story:** As a system administrator, I want to control what actions bots can perform, so that I can maintain security and prevent abuse.

#### Acceptance Criteria

1. WHEN a bot is created, THE Bot_Engine SHALL assign default permissions (send_message only)
2. WHEN an administrator grants a scope to a bot, THE Bot_Engine SHALL add the scope to bot_permissions
3. WHEN an administrator revokes a scope from a bot, THE Bot_Engine SHALL remove the scope from bot_permissions
4. WHEN a bot attempts an action, THE Bot_Engine SHALL verify the bot has the required scope before proceeding
5. IF a bot lacks required permission for an action, THEN THE Bot_Engine SHALL reject the request with a permission error

### Requirement 4: Bot Chat Subscription

**User Story:** As a chat administrator, I want to add or remove bots from my chat, so that I can control which bots operate in my chat.

#### Acceptance Criteria

1. WHEN a chat admin adds a bot to a chat, THE Bot_Engine SHALL create a bot_chats record linking the bot and chat
2. WHEN a chat admin removes a bot from a chat, THE Bot_Engine SHALL delete the bot_chats record
3. WHEN a bot attempts to send a message to a chat, THE Bot_Engine SHALL verify the bot is subscribed to that chat
4. IF a bot is not subscribed to a chat, THEN THE Bot_Engine SHALL reject the message with a subscription error

### Requirement 5: Command Parsing

**User Story:** As a user, I want to send commands to bots using "/" prefix, so that I can interact with bot functionality.

#### Acceptance Criteria

1. WHEN a message starts with "/", THE Command_Parser SHALL extract the command name (first word after "/")
2. WHEN a message contains arguments after the command, THE Command_Parser SHALL parse arguments respecting shell-style quoting
3. WHEN a message does not start with "/", THE Command_Parser SHALL return None indicating no command
4. THE Command_Parser SHALL convert command names to lowercase for case-insensitive matching
5. WHEN parsing a command, THE Command_Parser SHALL create a ParsedCommand with command and args fields

### Requirement 6: Message Processing and Bot Dispatch

**User Story:** As a user, I want my command messages to be delivered to relevant bots, so that bots can respond to my requests.

#### Acceptance Criteria

1. WHEN a new message is saved to the database, THE Bot_Engine SHALL check if it contains a command
2. WHEN a command is detected, THE Bot_Engine SHALL find all active bots subscribed to that chat
3. WHEN dispatching to bots, THE Bot_Dispatcher SHALL skip inactive bots
4. WHEN dispatching to a bot with a webhook, THE Bot_Dispatcher SHALL call the webhook with the message payload
5. THE webhook payload SHALL include update_id, message.chat.id, message.from.id, and message.text fields

### Requirement 7: Bot HTTP API - Send Message

**User Story:** As a bot, I want to send messages to chats via API, so that I can respond to users and provide information.

#### Acceptance Criteria

1. WHEN a bot calls POST /bot<TOKEN>/sendMessage with chat_id and text, THE Bot_Engine SHALL create a message from the bot
2. THE Bot_Engine SHALL identify the bot by extracting and validating the token from the URL
3. WHEN the message is created, THE Bot_Engine SHALL mark the sender as Bot(bot_id)
4. WHEN the message is created, THE Bot_Engine SHALL push the message to the chat via WebSocket
5. IF the token is invalid, THEN THE Bot_Engine SHALL return an authentication error
6. IF the bot is not subscribed to the chat, THEN THE Bot_Engine SHALL return a forbidden error

### Requirement 8: Rate Limiting

**User Story:** As a system operator, I want to limit bot API calls, so that I can prevent abuse and ensure fair resource usage.

#### Acceptance Criteria

1. THE Bot_Engine SHALL track API call counts per bot per time window
2. WHEN a bot exceeds the rate limit, THE Bot_Engine SHALL reject requests with a rate limit error
3. THE rate limit error SHALL include retry_after indicating when the bot can retry
4. WHEN the time window resets, THE Bot_Engine SHALL allow the bot to make requests again

### Requirement 9: Bot WebSocket Connection

**User Story:** As a bot developer, I want my bot to connect via WebSocket, so that I can receive real-time updates without polling or webhook setup.

#### Acceptance Criteria

1. WHEN a bot connects to WebSocket with a valid token, THE Bot_Engine SHALL authenticate and establish the connection
2. WHEN a bot is connected via WebSocket, THE Bot_Engine SHALL push message updates directly to the bot's WebSocket
3. WHEN a command message is sent in a chat where the bot is subscribed, THE Bot_Engine SHALL deliver the update via WebSocket
4. IF a bot has both webhook and WebSocket configured, THEN THE Bot_Engine SHALL prefer WebSocket delivery
5. WHEN a bot disconnects from WebSocket, THE Bot_Engine SHALL fall back to webhook delivery if configured
6. THE WebSocket update payload SHALL match the webhook payload format (update_id, message.chat.id, message.from.id, message.text)
7. WHEN a bot reconnects, THE Bot_Engine SHALL resume delivering updates from the last acknowledged update_id

### Requirement 10: Bot Message Serialization

**User Story:** As a developer, I want bot messages to be properly serialized for storage and transmission, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN storing a bot message, THE Bot_Engine SHALL serialize the message to JSON format
2. WHEN retrieving a bot message, THE Bot_Engine SHALL deserialize the JSON back to the message structure
3. FOR ALL valid bot messages, serializing then deserializing SHALL produce an equivalent message object (round-trip property)
