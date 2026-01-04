# Implementation Plan: Backend API (Rust)

## Overview

Triển khai Backend API cho ứng dụng Chat sử dụng Rust với Axum framework, PostgreSQL database, và Redis cache. Code sẽ được đặt trong thư mục `backend/` mới.

## Technology Stack

- **Language**: Rust
- **Web Framework**: Axum
- **Database**: PostgreSQL với SQLx
- **Cache**: Redis
- **Authentication**: JWT (jsonwebtoken crate)
- **WebSocket**: tokio-tungstenite
- **Testing**: cargo test với property-based testing (proptest)

## Tasks

- [x] 1. Project Setup và Core Infrastructure
  - [x] 1.1 Tạo thư mục backend và khởi tạo Rust project
    - Tạo `backend/` directory
    - Khởi tạo Cargo.toml với dependencies
    - Cấu trúc thư mục: src/main.rs, src/lib.rs, src/config/, src/routes/, src/services/, src/models/, src/db/
    - _Requirements: 1.1-1.7, 2.1-2.4_

  - [x] 1.2 Cấu hình database và migrations
    - Setup SQLx với PostgreSQL
    - Tạo migration files cho tất cả tables (users, chats, messages, etc.)
    - Implement connection pool
    - _Requirements: Database Schema từ design.md_

  - [x] 1.3 Implement error handling và response types
    - Tạo custom error types
    - Implement API response format chuẩn
    - Setup logging với tracing
    - _Requirements: Error Response Format từ design.md_

- [x] 2. Authentication Module
  - [x] 2.1 Implement User model và repository
    - Tạo User struct với SQLx
    - Implement CRUD operations
    - Password hashing với argon2
    - _Requirements: 1.1, 1.2, 2.1-2.4_

  - [x] 2.2 Implement JWT authentication
    - Token generation và validation
    - Middleware cho protected routes
    - Session management
    - _Requirements: 1.3, 1.6, 1.7_

  - [ ]* 2.3 Write property test cho JWT token validity
    - **Property 1: Authentication Token Validity**
    - **Validates: Requirements 1.3, 1.6, 1.7**

  - [x] 2.4 Implement Auth routes
    - POST /auth/register
    - POST /auth/login
    - POST /auth/logout
    - GET /auth/session
    - _Requirements: 1.1-1.7_

- [ ] 3. Checkpoint - Auth Module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. User Management Module
  - [x] 4.1 Implement User service
    - Get all users
    - Get user by ID
    - Update user profile
    - Track online/offline status
    - _Requirements: 2.1-2.4_

  - [x] 4.2 Implement User routes
    - GET /users
    - GET /users/:userId
    - _Requirements: 2.1, 2.2_

- [x] 5. Chat Management Module
  - [x] 5.1 Implement Chat và ChatParticipant models
    - Chat struct với type (private, group, bot)
    - ChatParticipant struct
    - Repository methods
    - _Requirements: 3.1-3.6_

  - [x] 5.2 Implement Chat service
    - Get user's chats với last message
    - Search chats
    - Create group chat
    - Get chat details
    - Mark chat as read
    - _Requirements: 3.1-3.6_

  - [ ]* 5.3 Write property test cho Chat Participant Access Control
    - **Property 3: Chat Participant Access Control**
    - **Validates: Requirements 3.4, 4.1, 4.2**

  - [x] 5.4 Implement Chat routes
    - GET /chats
    - GET /chats/:chatId
    - POST /chats/group
    - POST /chats/:chatId/read
    - _Requirements: 3.1-3.5_

- [ ] 6. Checkpoint - Chat Module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Message Management Module
  - [x] 7.1 Implement Message, Attachment, Reaction models
    - Message struct với delivery status
    - Attachment struct
    - Reaction struct
    - ReadReceipt struct
    - _Requirements: 4.1-4.10_

  - [x] 7.2 Implement Message service
    - Send message với attachments
    - Get messages với pagination
    - Edit message
    - Delete message
    - Toggle reaction
    - Pin/unpin message
    - _Requirements: 4.1-4.10_

  - [ ]* 7.3 Write property test cho Message Edit/Delete Authorization
    - **Property 4: Message Edit/Delete Authorization**
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 7.4 Write property test cho Reaction Toggle Idempotence
    - **Property 5: Reaction Toggle Idempotence**
    - **Validates: Requirements 4.5**

  - [x] 7.5 Implement Message routes
    - GET /chats/:chatId/messages
    - POST /chats/:chatId/messages
    - PUT /chats/:chatId/messages/:messageId
    - DELETE /chats/:chatId/messages/:messageId
    - POST /chats/:chatId/messages/:messageId/reactions
    - POST /chats/:chatId/messages/:messageId/pin
    - DELETE /chats/:chatId/messages/:messageId/pin
    - _Requirements: 4.1-4.7_

- [ ] 8. Checkpoint - Message Module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. WebSocket Real-time Module
  - [x] 9.1 Implement WebSocket server
    - Connection handling với JWT auth
    - Room/channel management
    - _Requirements: 5.1-5.4_

  - [x] 9.2 Implement WebSocket events
    - new_message broadcast
    - typing indicator
    - user_status updates
    - message_status updates
    - _Requirements: 5.1-5.4_

  - [ ]* 9.3 Write property test cho Message Delivery Consistency
    - **Property 2: Message Delivery Consistency**
    - **Validates: Requirements 4.1, 5.1**

- [x] 10. Settings Module
  - [x] 10.1 Implement UserSettings model
    - Privacy settings
    - Notification settings
    - Chat settings
    - Data storage settings
    - Appearance settings
    - _Requirements: 6.1-6.10_

  - [x] 10.2 Implement Settings service và routes
    - GET/PUT /settings/profile
    - GET/PUT /settings/privacy
    - GET/PUT /settings/notifications
    - GET/PUT /settings/chat
    - GET/PUT /settings/data-storage
    - POST /settings/clear-cache
    - GET/PUT /settings/appearance
    - _Requirements: 6.1-6.10_

- [x] 11. Device/Session Management Module
  - [x] 11.1 Implement Session model và service
    - Track devices
    - Terminate sessions
    - _Requirements: 7.1-7.4_

  - [ ]* 11.2 Write property test cho Session Termination Completeness
    - **Property 6: Session Termination Completeness**
    - **Validates: Requirements 7.2, 7.3**

  - [x] 11.3 Implement Device routes
    - GET /settings/devices
    - DELETE /settings/devices/:deviceId
    - DELETE /settings/devices
    - _Requirements: 7.1-7.3_

- [x] 12. Bot Integration Module
  - [x] 12.1 Implement Bot service
    - Process bot messages
    - Handle inline keyboard callbacks
    - _Requirements: 8.1-8.3_

  - [x] 12.2 Implement Bot routes
    - POST /bots/:botId/callback
    - _Requirements: 8.2_

- [x] 13. File Upload Module
  - [x] 13.1 Implement file upload service
    - Handle multipart uploads
    - Validate file types và sizes
    - Store files (local hoặc S3)
    - _Requirements: 4.8_

  - [x] 13.2 Implement Upload route
    - POST /upload
    - _Requirements: 4.8_

- [ ] 14. Final Integration và Testing
  - [ ] 14.1 Integration testing
    - Test full API flows
    - Test WebSocket integration
    - _Requirements: All_

  - [ ] 14.2 Documentation
    - API documentation
    - Setup instructions
    - _Requirements: All_

- [ ] 15. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests
- Mỗi task reference specific requirements để đảm bảo traceability
- Checkpoints đảm bảo validation incremental
- Property tests validate universal correctness properties
