# Implementation Plan: Bot Engine

## Overview

Implementation plan cho Bot Engine system với Rust backend. Tasks được chia thành các phases: database setup, core models, services, API routes, WebSocket integration, và testing.

## Tasks

- [x] 1. Database Migration và Bot Models
  - [x] 1.1 Create database migration for bot tables
    - Create migration file với bots, bot_permissions, bot_chats tables
    - Add indexes cho token và owner_id
    - _Requirements: 1.1, 3.1, 4.1_

  - [x] 1.2 Implement Bot model và related structs
    - Create `backend/src/models/bot.rs` với Bot, BotPermission, BotChat structs
    - Add request/response types (CreateBotRequest, BotResponse, etc.)
    - Export từ `backend/src/models/mod.rs`
    - _Requirements: 1.1, 1.2_

  - [ ]* 1.3 Write property test for Bot serialization round-trip
    - **Property 17: Message Serialization Round-Trip**
    - **Validates: Requirements 10.3**

- [x] 2. Command Parser
  - [x] 2.1 Implement Command Parser module
    - Create `backend/src/services/bot_engine/command_parser.rs`
    - Implement ParsedCommand struct và parse() function
    - Add shell_words dependency cho argument parsing
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.2 Write property test for Command Parsing
    - **Property 9: Command Parsing**
    - Test slash prefix detection, lowercase conversion, argument parsing
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Permission và Subscription Services
  - [x] 4.1 Implement Permission Checker
    - Create `backend/src/services/bot_engine/permission.rs`
    - Implement check_scope() và check_chat_subscription()
    - Define scope constants (SCOPE_SEND_MESSAGE, etc.)
    - _Requirements: 3.4, 3.5, 4.3, 4.4_

  - [x]* 4.2 Write property test for Permission Enforcement
    - **Property 6: Permission Enforcement**
    - **Validates: Requirements 3.4, 3.5**

  - [x]* 4.3 Write property test for Subscription Enforcement
    - **Property 8: Subscription Enforcement**
    - **Validates: Requirements 4.3, 4.4, 7.6**

- [x] 5. Rate Limiter
  - [x] 5.1 Implement Rate Limiter với Redis
    - Create `backend/src/services/bot_engine/rate_limiter.rs`
    - Implement check_rate_limit() với Redis counter
    - Return RateLimitResult với remaining hoặc retry_after
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 5.2 Write property test for Rate Limiting
    - **Property 14: Rate Limiting**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [-] 6. Bot Service Core
  - [x] 6.1 Implement Bot CRUD operations
    - Create `backend/src/services/bot_engine/bot_service.rs`
    - Implement create_bot() với token generation
    - Implement get_bot_by_token(), update_bot(), delete_bot()
    - Implement activate/deactivate functions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 6.2 Write property test for Bot Creation
    - **Property 1: Bot Creation Produces Valid Bot**
    - **Validates: Requirements 1.1, 1.2, 3.1**

  - [ ]* 6.3 Write property test for Bot Activation Round-Trip
    - **Property 2: Bot Activation Round-Trip**
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 6.4 Write property test for Bot Deletion Cascade
    - **Property 3: Bot Deletion Cascades**
    - **Validates: Requirements 1.5**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Permission và Subscription Management
  - [x] 8.1 Implement permission management functions
    - Add grant_permission(), revoke_permission() to bot_service
    - Add get_bot_permissions()
    - _Requirements: 3.2, 3.3_

  - [x] 8.2 Implement chat subscription management
    - Add add_bot_to_chat(), remove_bot_from_chat()
    - Add get_bot_chats(), get_chat_bots()
    - _Requirements: 4.1, 4.2_

  - [ ]* 8.3 Write property test for Permission Grant/Revoke
    - **Property 5: Permission Grant and Revoke**
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 8.4 Write property test for Chat Subscription Management
    - **Property 7: Chat Subscription Management**
    - **Validates: Requirements 4.1, 4.2**

- [x] 9. Webhook Management
  - [x] 9.1 Implement Webhook configuration
    - Add set_webhook(), clear_webhook() to bot_service
    - Implement URL validation
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 9.2 Write property test for Webhook URL Management
    - **Property 4: Webhook URL Management**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 10. Bot Dispatcher
  - [x] 10.1 Implement Bot Dispatcher
    - Create `backend/src/services/bot_engine/dispatcher.rs`
    - Implement dispatch() với WebSocket preference
    - Implement send_via_websocket() và send_via_webhook()
    - Create WebhookPayload struct
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 9.4_

  - [ ]* 10.2 Write property test for Active Bot Filtering
    - **Property 10: Active Bot Filtering for Dispatch**
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 10.3 Write property test for Webhook Payload Structure
    - **Property 11: Webhook Payload Structure**
    - **Validates: Requirements 6.5**

  - [ ]* 10.4 Write property test for WebSocket Delivery Preference
    - **Property 15: WebSocket Delivery Preference**
    - **Validates: Requirements 9.4**

  - [ ]* 10.5 Write property test for Payload Format Consistency
    - **Property 16: Payload Format Consistency**
    - **Validates: Requirements 9.6**

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Bot HTTP API Routes
  - [x] 12.1 Create Bot API routes module
    - Create `backend/src/routes/bot_api.rs`
    - Implement token extraction middleware
    - _Requirements: 7.2_

  - [x] 12.2 Implement sendMessage endpoint
    - POST /bot:token/sendMessage
    - Validate token, check rate limit, check subscription, check permission
    - Create message với Bot sender type
    - Broadcast via WebSocket
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6_

  - [x] 12.3 Implement setWebhook endpoint
    - POST /bot:token/setWebhook
    - Validate URL và update bot
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 12.4 Implement getMe endpoint
    - GET /bot:token/getMe
    - Return bot info
    - _Requirements: 7.2_

  - [ ]* 12.5 Write property test for Bot Token Authentication
    - **Property 12: Bot Token Authentication**
    - **Validates: Requirements 7.2, 7.5**

  - [ ]* 12.6 Write property test for Bot Message Sender Type
    - **Property 13: Bot Message Sender Type**
    - **Validates: Requirements 7.3**

- [x] 13. Bot WebSocket Integration
  - [x] 13.1 Add Bot WebSocket events
    - Add BotUpdate, BotConnected events to ws/events.rs
    - Create BotUpdateMessage, BotUpdateChat, BotUpdateUser structs
    - _Requirements: 9.1, 9.2, 9.6_

  - [x] 13.2 Implement Bot WebSocket handler
    - Add bot authentication via token in ws/handler.rs
    - Track bot connections in WsManager
    - _Requirements: 9.1, 9.3_

  - [x] 13.3 Implement Bot WebSocket delivery
    - Add send_to_bot() method in WsManager
    - Implement fallback to webhook on disconnect
    - _Requirements: 9.2, 9.4, 9.5_

- [x] 14. Message Processing Integration
  - [x] 14.1 Integrate Bot Engine with Message Service
    - Hook into message creation flow
    - Call Command Parser on new messages
    - Dispatch to bots when command detected
    - _Requirements: 6.1, 6.2_

  - [x] 14.2 Update Message model for Bot sender
    - Add MessageSender enum (User, Bot)
    - Update message creation to support bot sender
    - _Requirements: 7.3_

- [x] 15. Bot Management API (User-facing)
  - [x] 15.1 Create Bot management routes
    - POST /api/v1/bots - Create bot
    - GET /api/v1/bots - List user's bots
    - GET /api/v1/bots/:id - Get bot details
    - DELETE /api/v1/bots/:id - Delete bot
    - _Requirements: 1.1, 1.5_

  - [x] 15.2 Create Bot-Chat management routes
    - POST /api/v1/chats/:chat_id/bots - Add bot to chat
    - DELETE /api/v1/chats/:chat_id/bots/:bot_id - Remove bot from chat
    - GET /api/v1/chats/:chat_id/bots - List bots in chat
    - _Requirements: 4.1, 4.2_

- [x] 16. Wire everything together
  - [x] 16.1 Register Bot API routes in main router
    - Add bot_api_routes() to lib.rs
    - Add bot management routes to api_routes()
    - _Requirements: All_

  - [x] 16.2 Update AppState với Bot Engine components
    - Add rate limiter to AppState
    - Initialize bot dispatcher
    - _Requirements: All_

- [ ] 17. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `proptest` crate (already in Cargo.toml)
- Rate limiter requires Redis connection (already configured)
