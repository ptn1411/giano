# Implementation Plan: Frontend API Integration

## Overview

Triển khai tích hợp Backend API (Rust/Axum) vào Frontend React. Thay thế mock data bằng real API calls, thêm WebSocket cho real-time updates, và cập nhật Zustand stores.

## Technology Stack

- **HTTP Client**: Axios
- **State Management**: Zustand (existing)
- **WebSocket**: Native WebSocket API
- **Testing**: Vitest + fast-check (property-based testing)
- **API Mocking**: MSW (Mock Service Worker)

## Tasks

- [x] 1. API Client Setup
  - [x] 1.1 Tạo API client với Axios
    - Tạo `src/services/api/client.ts`
    - Cấu hình base URL từ environment variables
    - Implement request interceptor để add JWT token
    - Implement response interceptor để handle 401 errors
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.2 Tạo types và interfaces
    - Tạo `src/services/api/types.ts`
    - Define API response types matching backend
    - Define error types
    - _Requirements: 1.1-1.5_

  - [ ]* 1.3 Write property test cho JWT Token Inclusion
    - **Property 1: JWT Token Inclusion**
    - **Validates: Requirements 1.1**

- [x] 2. Authentication Integration
  - [x] 2.1 Tạo Auth API service
    - Tạo `src/services/api/auth.ts`
    - Implement login, register, logout, getSession methods
    - _Requirements: 2.1-2.6_

  - [x] 2.2 Cập nhật authStore để sử dụng real API
    - Update `src/stores/authStore.ts`
    - Replace mock authApi với real API calls
    - Persist token trong localStorage
    - Handle API errors và display messages
    - _Requirements: 2.1-2.6_

  - [x] 2.3 Cập nhật Auth page
    - Update `src/pages/Auth.tsx` nếu cần
    - Ensure error messages hiển thị đúng
    - _Requirements: 2.6_

- [ ] 3. Checkpoint - Auth Integration
  - Ensure authentication flow works end-to-end
  - Test register, login, logout, session restore

- [x] 4. User Data Integration
  - [x] 4.1 Tạo Users API service
    - Tạo `src/services/api/users.ts`
    - Implement getUsers, getUser methods
    - _Requirements: 3.1, 3.2_

  - [x] 4.2 Cập nhật usersStore để sử dụng real API
    - Update `src/stores/usersStore.ts`
    - Add caching logic (5 minute TTL)
    - _Requirements: 3.1-3.4_

  - [ ]* 4.3 Write property test cho User Data Caching
    - **Property 3: User Data Caching**
    - **Validates: Requirements 3.4**

- [x] 5. Chat Integration
  - [x] 5.1 Tạo Chats API service
    - Tạo `src/services/api/chats.ts`
    - Implement getChats, getChat, createGroup, markAsRead methods
    - _Requirements: 4.1-4.5_

  - [x] 5.2 Cập nhật chatsStore để sử dụng real API
    - Update `src/stores/chatsStore.ts`
    - Replace mock chatApi với real API calls
    - _Requirements: 4.1-4.6_

- [-] 6. Message Integration
  - [x] 6.1 Tạo Messages API service
    - Tạo `src/services/api/messages.ts`
    - Implement getMessages, sendMessage, editMessage, deleteMessage
    - Implement addReaction, pinMessage, unpinMessage
    - _Requirements: 5.1-5.6_

  - [x] 6.2 Cập nhật messagesStore để sử dụng real API
    - Update `src/stores/messagesStore.ts`
    - Replace mock chatApi với real API calls
    - Implement pagination với "before" parameter
    - Implement optimistic updates với rollback
    - _Requirements: 5.1-5.8_

  - [ ]* 6.3 Write property test cho Message Pagination Consistency
    - **Property 4: Message Pagination Consistency**
    - **Validates: Requirements 5.7**

  - [ ]* 6.4 Write property test cho Optimistic Update Consistency
    - **Property 6: Optimistic Update Consistency**
    - **Validates: Requirements 9.4, 9.5**

- [ ] 7. Checkpoint - Core Data Integration
  - Ensure chats và messages load correctly
  - Test send, edit, delete messages
  - Test reactions và pinning

- [x] 8. WebSocket Integration
  - [x] 8.1 Tạo WebSocket client
    - Tạo `src/services/websocket.ts`
    - Implement connect, disconnect, send methods
    - Implement event handlers registration
    - Implement reconnection với exponential backoff
    - _Requirements: 6.1, 6.8_

  - [x] 8.2 Tích hợp WebSocket với stores
    - Connect WebSocket khi user authenticated
    - Handle new_message event → update messagesStore
    - Handle typing event → update chatsStore
    - Handle user_status event → update usersStore
    - Handle message_status event → update messagesStore
    - _Requirements: 6.2-6.5_

  - [x] 8.3 Implement typing indicators
    - Send start_typing khi user bắt đầu gõ
    - Send stop_typing khi user ngừng gõ (debounce)
    - Update UI để hiển thị typing indicator
    - _Requirements: 6.6, 6.7_

  - [ ]* 8.4 Write property test cho WebSocket Event Store Updates
    - **Property 2: WebSocket Event Store Updates**
    - **Validates: Requirements 3.3, 4.6, 5.8, 6.2, 6.3, 6.4, 6.5**

  - [ ]* 8.5 Write property test cho WebSocket Reconnection Backoff
    - **Property 5: WebSocket Reconnection Backoff**
    - **Validates: Requirements 6.8**

- [ ] 9. Checkpoint - Real-time Integration
  - Test WebSocket connection và reconnection
  - Test real-time message delivery
  - Test typing indicators

- [x] 10. File Upload Integration
  - [x] 10.1 Tạo Upload API service
    - Tạo `src/services/api/upload.ts`
    - Implement uploadFile với progress tracking
    - _Requirements: 8.1-8.3_

  - [x] 10.2 Cập nhật MessageInput component
    - Update attachment handling để sử dụng real upload
    - Show upload progress
    - Handle upload errors
    - _Requirements: 8.1-8.5_

- [x] 11. Settings Integration
  - [x] 11.1 Tạo Settings API service
    - Tạo `src/services/api/settings.ts`
    - Implement all settings endpoints (profile, privacy, notifications, etc.)
    - _Requirements: 7.1-7.8_

  - [x] 11.2 Tạo settingsStore
    - Tạo `src/stores/settingsStore.ts`
    - Implement fetch và update methods cho all settings
    - _Requirements: 7.1-7.8_

  - [x] 11.3 Cập nhật Settings page
    - Update `src/pages/Settings.tsx`
    - Connect với settingsStore
    - Handle loading và error states
    - _Requirements: 7.1-7.8_

- [x] 12. Bot Integration
  - [x] 12.1 Tạo Bot API service
    - Tạo `src/services/api/bots.ts`
    - Implement handleCallback method
    - _Requirements: Backend 8.1-8.3_

  - [x] 12.2 Cập nhật BotReplyKeyboard component
    - Update để call real API khi click inline button
    - Handle bot responses
    - _Requirements: Backend 8.1-8.3_

- [x] 13. Error Handling và Loading States
  - [x] 13.1 Tạo error handling utilities
    - Tạo `src/services/api/errors.ts`
    - Implement error parsing và user-friendly messages
    - _Requirements: 9.2_

  - [x] 13.2 Cập nhật components với loading states
    - Ensure all data-fetching components show skeletons
    - Add error boundaries where needed
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 14. Environment Configuration
  - [x] 14.1 Setup environment variables
    - Tạo `.env.example` với required variables
    - Update `.env.local` cho development
    - Document environment setup
    - _Requirements: 1.4_

- [x] 15. Cleanup và Documentation
  - [x] 15.1 Remove mock data (optional)
    - Có thể giữ mock data cho testing/demo mode
    - Add flag để switch giữa mock và real API
    - _Requirements: All_

  - [x] 15.2 Update README
    - Document API integration
    - Document environment setup
    - Document WebSocket events
    - _Requirements: All_

- [ ] 16. Final Checkpoint
  - Ensure all features work với real backend
  - Test full user flow: register → login → chat → logout
  - Verify WebSocket real-time updates

## Notes

- Tasks marked with `*` are optional property-based tests
- Mỗi task reference specific requirements để đảm bảo traceability
- Checkpoints đảm bảo validation incremental
- Có thể giữ mock data như fallback cho demo/testing
