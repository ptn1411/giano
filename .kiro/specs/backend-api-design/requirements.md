# Requirements Document

## Introduction

Tài liệu này mô tả các yêu cầu cho Backend API của ứng dụng Chat (tương tự Telegram). Backend cần cung cấp các API endpoints để hỗ trợ đầy đủ các chức năng của Frontend bao gồm: Authentication, User Management, Chat Management, Message Management, và Settings Management.

## Glossary

- **API_Server**: Hệ thống backend xử lý các HTTP requests từ client
- **Auth_Service**: Module xử lý authentication và authorization
- **Chat_Service**: Module quản lý conversations và chat rooms
- **Message_Service**: Module quản lý messages trong các cuộc hội thoại
- **User_Service**: Module quản lý thông tin người dùng
- **Settings_Service**: Module quản lý cài đặt người dùng
- **JWT_Token**: JSON Web Token dùng để xác thực người dùng
- **WebSocket_Server**: Server xử lý real-time communication

## Requirements

### Requirement 1: Authentication

**User Story:** As a user, I want to register, login, and manage my authentication session, so that I can securely access the chat application.

#### Acceptance Criteria

1. WHEN a user submits valid registration data (email, password, name) THEN THE Auth_Service SHALL create a new user account and return a JWT token
2. WHEN a user submits invalid registration data THEN THE Auth_Service SHALL return appropriate error messages
3. WHEN a user submits valid login credentials THEN THE Auth_Service SHALL authenticate and return a JWT token with user session
4. WHEN a user submits invalid login credentials THEN THE Auth_Service SHALL return an authentication error
5. WHEN a user requests logout THEN THE Auth_Service SHALL invalidate the current session
6. WHEN a user requests their current session THEN THE Auth_Service SHALL return the session details if valid
7. IF the JWT token is expired or invalid THEN THE Auth_Service SHALL return 401 Unauthorized

### Requirement 2: User Management

**User Story:** As a user, I want to view and manage user profiles, so that I can interact with other users in the application.

#### Acceptance Criteria

1. WHEN a user requests the list of users THEN THE User_Service SHALL return all users with their status information
2. WHEN a user requests a specific user profile THEN THE User_Service SHALL return the user details
3. WHEN a user updates their profile THEN THE User_Service SHALL persist the changes and return updated profile
4. THE User_Service SHALL track and return user online/offline status

### Requirement 3: Chat Management

**User Story:** As a user, I want to create and manage chats (private, group, bot), so that I can communicate with others.

#### Acceptance Criteria

1. WHEN a user requests their chat list THEN THE Chat_Service SHALL return all chats with last message and unread count
2. WHEN a user searches for chats THEN THE Chat_Service SHALL return matching chats by name or message content
3. WHEN a user creates a new group chat THEN THE Chat_Service SHALL create the group and return chat details
4. WHEN a user requests a specific chat THEN THE Chat_Service SHALL return chat details with participants
5. WHEN a user marks a chat as read THEN THE Chat_Service SHALL reset the unread count to zero
6. THE Chat_Service SHALL support three chat types: private, group, and bot

### Requirement 4: Message Management

**User Story:** As a user, I want to send, receive, edit, and delete messages, so that I can communicate effectively.

#### Acceptance Criteria

1. WHEN a user sends a message THEN THE Message_Service SHALL create and persist the message with delivery status
2. WHEN a user requests messages for a chat THEN THE Message_Service SHALL return all messages with reactions and attachments
3. WHEN a user edits a message THEN THE Message_Service SHALL update the message and mark it as edited
4. WHEN a user deletes a message THEN THE Message_Service SHALL remove the message from the chat
5. WHEN a user adds a reaction to a message THEN THE Message_Service SHALL toggle the reaction (add/remove)
6. WHEN a user pins a message THEN THE Message_Service SHALL mark the message as pinned
7. WHEN a user unpins a message THEN THE Message_Service SHALL remove the pinned status
8. THE Message_Service SHALL support message attachments (images, files)
9. THE Message_Service SHALL support reply-to functionality
10. THE Message_Service SHALL track delivery status (sending, sent, delivered, read, failed)

### Requirement 5: Real-time Communication

**User Story:** As a user, I want to receive real-time updates, so that I can see new messages and status changes immediately.

#### Acceptance Criteria

1. WHEN a new message is sent THEN THE WebSocket_Server SHALL broadcast to all chat participants
2. WHEN a user starts typing THEN THE WebSocket_Server SHALL notify other participants
3. WHEN a user's online status changes THEN THE WebSocket_Server SHALL broadcast the status update
4. WHEN a message delivery status changes THEN THE WebSocket_Server SHALL notify the sender

### Requirement 6: Settings Management

**User Story:** As a user, I want to manage my privacy, notification, and appearance settings, so that I can customize my experience.

#### Acceptance Criteria

1. WHEN a user requests privacy settings THEN THE Settings_Service SHALL return current privacy configuration
2. WHEN a user updates privacy settings THEN THE Settings_Service SHALL persist and return updated settings
3. WHEN a user requests notification settings THEN THE Settings_Service SHALL return current notification configuration
4. WHEN a user updates notification settings THEN THE Settings_Service SHALL persist and return updated settings
5. WHEN a user requests chat settings THEN THE Settings_Service SHALL return current chat configuration
6. WHEN a user updates chat settings THEN THE Settings_Service SHALL persist and return updated settings
7. WHEN a user requests data storage settings THEN THE Settings_Service SHALL return storage usage and configuration
8. WHEN a user clears cache THEN THE Settings_Service SHALL remove cached data and update storage metrics
9. WHEN a user requests appearance settings THEN THE Settings_Service SHALL return theme and display configuration
10. WHEN a user updates appearance settings THEN THE Settings_Service SHALL persist and return updated settings

### Requirement 7: Device/Session Management

**User Story:** As a user, I want to manage my active sessions across devices, so that I can maintain security.

#### Acceptance Criteria

1. WHEN a user requests active devices THEN THE Settings_Service SHALL return all active sessions
2. WHEN a user terminates a specific device session THEN THE Settings_Service SHALL invalidate that session
3. WHEN a user terminates all other sessions THEN THE Settings_Service SHALL invalidate all sessions except current
4. THE Settings_Service SHALL track device type, location, and last active time

### Requirement 8: Bot Integration

**User Story:** As a user, I want to interact with bots through inline keyboards and commands, so that I can use automated services.

#### Acceptance Criteria

1. WHEN a user sends a message to a bot THEN THE Message_Service SHALL process and generate bot response
2. WHEN a user clicks an inline button THEN THE Message_Service SHALL process the callback and return response
3. THE Message_Service SHALL support inline keyboard buttons with callback data or URLs
