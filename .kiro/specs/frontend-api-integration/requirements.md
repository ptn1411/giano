# Requirements Document

## Introduction

Tài liệu này mô tả các yêu cầu để tích hợp Backend API (Rust) vào Frontend React của ứng dụng Chat. Frontend hiện đang sử dụng mock data và cần được chuyển đổi để sử dụng real API endpoints.

## Glossary

- **API_Client**: Module xử lý HTTP requests từ frontend đến backend
- **Auth_Store**: Zustand store quản lý authentication state
- **Chat_Store**: Zustand store quản lý chat data
- **Message_Store**: Zustand store quản lý messages
- **WebSocket_Client**: Module xử lý real-time communication với backend
- **API_Service**: Layer trung gian giữa components và API endpoints

## Requirements

### Requirement 1: API Client Setup

**User Story:** As a developer, I want a centralized API client, so that all API calls are consistent and handle authentication automatically.

#### Acceptance Criteria

1. THE API_Client SHALL include JWT token in Authorization header for all authenticated requests
2. WHEN a request returns 401 Unauthorized THEN THE API_Client SHALL redirect user to login page
3. THE API_Client SHALL handle network errors and display appropriate error messages
4. THE API_Client SHALL use environment variables for API base URL configuration
5. THE API_Client SHALL support request/response interceptors for logging and error handling

### Requirement 2: Authentication Integration

**User Story:** As a user, I want to register, login, and logout using the real backend, so that my account is persisted.

#### Acceptance Criteria

1. WHEN a user submits the registration form THEN THE Auth_Store SHALL call POST /auth/register and store the session
2. WHEN a user submits the login form THEN THE Auth_Store SHALL call POST /auth/login and store the session
3. WHEN a user clicks logout THEN THE Auth_Store SHALL call POST /auth/logout and clear local session
4. WHEN the app loads THEN THE Auth_Store SHALL call GET /auth/session to restore session if token exists
5. THE Auth_Store SHALL persist JWT token in localStorage for session persistence
6. WHEN authentication fails THEN THE Auth_Store SHALL display error messages from API response

### Requirement 3: User Data Integration

**User Story:** As a user, I want to see real user data from the backend, so that I can interact with actual users.

#### Acceptance Criteria

1. WHEN the app loads THEN THE User_Store SHALL fetch users from GET /users
2. WHEN viewing a user profile THEN THE User_Store SHALL fetch details from GET /users/:userId
3. THE User_Store SHALL update user online/offline status from WebSocket events
4. THE User_Store SHALL cache user data to minimize API calls

### Requirement 4: Chat Integration

**User Story:** As a user, I want to see my real chats from the backend, so that my conversations are persisted.

#### Acceptance Criteria

1. WHEN the app loads THEN THE Chat_Store SHALL fetch chats from GET /chats
2. WHEN searching for chats THEN THE Chat_Store SHALL call GET /chats?search=query
3. WHEN creating a group chat THEN THE Chat_Store SHALL call POST /chats/group
4. WHEN selecting a chat THEN THE Chat_Store SHALL fetch details from GET /chats/:chatId
5. WHEN marking a chat as read THEN THE Chat_Store SHALL call POST /chats/:chatId/read
6. THE Chat_Store SHALL update chat data from WebSocket events (new messages, typing indicators)

### Requirement 5: Message Integration

**User Story:** As a user, I want to send and receive real messages, so that my conversations are persisted and delivered.

#### Acceptance Criteria

1. WHEN opening a chat THEN THE Message_Store SHALL fetch messages from GET /chats/:chatId/messages
2. WHEN sending a message THEN THE Message_Store SHALL call POST /chats/:chatId/messages
3. WHEN editing a message THEN THE Message_Store SHALL call PUT /chats/:chatId/messages/:messageId
4. WHEN deleting a message THEN THE Message_Store SHALL call DELETE /chats/:chatId/messages/:messageId
5. WHEN adding a reaction THEN THE Message_Store SHALL call POST /chats/:chatId/messages/:messageId/reactions
6. WHEN pinning a message THEN THE Message_Store SHALL call POST /chats/:chatId/messages/:messageId/pin
7. THE Message_Store SHALL support pagination with "before" parameter for loading older messages
8. THE Message_Store SHALL receive new messages via WebSocket and update UI immediately

### Requirement 6: WebSocket Integration

**User Story:** As a user, I want to receive real-time updates, so that I see new messages and status changes immediately.

#### Acceptance Criteria

1. WHEN user is authenticated THEN THE WebSocket_Client SHALL connect to wss://api/ws?token=jwt
2. WHEN receiving "new_message" event THEN THE Message_Store SHALL add message to appropriate chat
3. WHEN receiving "typing" event THEN THE Chat_Store SHALL update typing indicator for chat
4. WHEN receiving "user_status" event THEN THE User_Store SHALL update user online/offline status
5. WHEN receiving "message_status" event THEN THE Message_Store SHALL update delivery status
6. WHEN user starts typing THEN THE WebSocket_Client SHALL send "start_typing" event
7. WHEN user stops typing THEN THE WebSocket_Client SHALL send "stop_typing" event
8. WHEN WebSocket disconnects THEN THE WebSocket_Client SHALL attempt reconnection with exponential backoff

### Requirement 7: Settings Integration

**User Story:** As a user, I want my settings to be persisted on the backend, so that they sync across devices.

#### Acceptance Criteria

1. WHEN opening settings page THEN THE Settings_Store SHALL fetch all settings from respective endpoints
2. WHEN updating profile THEN THE Settings_Store SHALL call PUT /settings/profile
3. WHEN updating privacy settings THEN THE Settings_Store SHALL call PUT /settings/privacy
4. WHEN updating notification settings THEN THE Settings_Store SHALL call PUT /settings/notifications
5. WHEN updating appearance settings THEN THE Settings_Store SHALL call PUT /settings/appearance
6. WHEN clearing cache THEN THE Settings_Store SHALL call POST /settings/clear-cache
7. WHEN viewing devices THEN THE Settings_Store SHALL fetch from GET /settings/devices
8. WHEN terminating a device THEN THE Settings_Store SHALL call DELETE /settings/devices/:deviceId

### Requirement 8: File Upload Integration

**User Story:** As a user, I want to upload images and files, so that I can share media in chats.

#### Acceptance Criteria

1. WHEN user selects a file to upload THEN THE API_Client SHALL call POST /upload with multipart/form-data
2. WHEN upload succeeds THEN THE API_Client SHALL return attachment object with URL
3. WHEN sending message with attachment THEN THE Message_Store SHALL include attachment data from upload response
4. THE API_Client SHALL show upload progress indicator
5. WHEN upload fails THEN THE API_Client SHALL display error message with reason

### Requirement 9: Error Handling and Loading States

**User Story:** As a user, I want to see loading states and error messages, so that I know what's happening.

#### Acceptance Criteria

1. WHILE data is loading THEN THE UI SHALL display appropriate loading skeletons
2. WHEN an API error occurs THEN THE UI SHALL display user-friendly error message
3. WHEN network is offline THEN THE UI SHALL display offline indicator
4. THE UI SHALL support optimistic updates for better perceived performance
5. WHEN optimistic update fails THEN THE UI SHALL rollback and show error

