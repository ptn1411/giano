# Implementation Plan: Voice & Video Calling (Mediasoup)

## Overview

Implementation plan cho tính năng gọi điện sử dụng mediasoup SFU. Tasks được chia thành: mediasoup server setup, backend signaling, frontend services, UI components.

## Tasks

- [x] 1. Setup Mediasoup Server (Node.js)
  - [x] 1.1 Tạo project `media-server/` với mediasoup dependencies
    - Initialize Node.js project với TypeScript
    - Install mediasoup, mediasoup-client, ws, dotenv
    - Cấu hình TURN server credentials
    - _Requirements: 3.1_

  - [x] 1.2 Implement mediasoup worker và router management
    - Tạo workers pool
    - Implement router (room) creation/deletion
    - Configure media codecs (VP8, opus)
    - _Requirements: 3.1_

  - [x] 1.3 Implement WebSocket signaling cho mediasoup
    - Handle getRouterRtpCapabilities
    - Handle createProducerTransport, createConsumerTransport
    - Handle connectTransport, produce, consume
    - Handle transport close events
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 1.4 Implement room management
    - Create room khi call được accept
    - Add/remove participants
    - Cleanup room khi empty
    - _Requirements: 3.1, 5.2_

- [x] 2. Cập nhật Backend WebSocket Events (Rust)
  - [x] 2.1 Thêm call signaling events vào `backend/src/ws/events.rs`
    - Thêm ServerEvent: IncomingCall, CallAccepted, CallDeclined, CallEnded, UserBusy
    - Thêm ClientEvent: InitiateCall, AcceptCall, DeclineCall, EndCall
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.2 Implement call signaling handler trong `backend/src/services/websocket.rs`
    - Xử lý routing call signals giữa users
    - Validate users có existing chat trước khi cho phép call
    - Generate room ID và mediasoup URL khi call accepted
    - Handle user offline/busy cases
    - _Requirements: 6.4, 6.5_

- [ ] 3. Checkpoint - Backend và Media Server ready
  - Ensure mediasoup server runs và accepts connections
  - Ensure backend routes call signals correctly

- [x] 4. Cập nhật Frontend Configuration
  - [x] 4.1 Thêm mediasoup config vào `src/lib/config.ts`
    - VITE_MEDIASOUP_URL environment variable
    - _Requirements: 3.1_

  - [x] 4.2 Install mediasoup-client package
    - `npm install mediasoup-client`
    - _Requirements: 3.1_

- [x] 5. Implement Mediasoup Client Service
  - [x] 5.1 Tạo `src/services/mediasoup.ts`
    - Device initialization và loadDevice
    - createProducerTransport, createConsumerTransport
    - produce (audio/video tracks)
    - consume (remote streams)
    - pauseProducer, resumeProducer, closeProducer
    - joinRoom, leaveRoom
    - close cleanup
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.2 Write property test cho Mediasoup Service
    - **Property 5: Producer/Consumer pairing**
    - **Property 6: Transport connection state consistency**
    - **Validates: Requirements 3.2, 3.3, 3.6**

- [x] 6. Implement Media Handler
  - [x] 6.1 Tạo `src/services/mediaHandler.ts`
    - getUserMedia với constraints dựa trên call type
    - getDisplayMedia cho screen sharing
    - toggleAudio, toggleVideo functions
    - replaceVideoTrack cho screen share
    - stopAllTracks cleanup
    - _Requirements: 1.3, 4.1, 4.2, 4.4_

  - [ ]* 6.2 Write property test cho Media Handler
    - **Property 2: Media constraints match call type**
    - **Property 7: Media track toggle changes producer state**
    - **Validates: Requirements 1.3, 4.1, 4.2**

- [x] 7. Implement Call Store
  - [x] 7.1 Tạo `src/stores/callStore.ts`
    - Call state management (idle, calling, ringing, joining, producing, connected, reconnecting)
    - initiateCall, acceptCall, declineCall, endCall actions
    - toggleMute, toggleVideo, toggleScreenShare actions
    - Handle incoming call signals
    - Integrate với mediasoup service
    - _Requirements: 1.1, 1.2, 2.3, 2.4, 5.1_

  - [ ]* 7.2 Write property test cho Call Store
    - **Property 1: Call initiation creates correct request based on call type**
    - **Property 3: Accepting call triggers room join**
    - **Property 4: Declining call sends decline signal**
    - **Property 8: Call end triggers cleanup**
    - **Validates: Requirements 1.1, 1.2, 2.3, 2.4, 5.1, 5.2**

- [ ] 8. Checkpoint - Core services work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Cập nhật WebSocket Service
  - [x] 9.1 Thêm call event handlers vào `src/services/websocket.ts`
    - Handle IncomingCall, CallAccepted, CallDeclined, CallEnded events
    - Integrate với callStore
    - _Requirements: 2.1, 5.2_

  - [x] 9.2 Thêm send functions cho call events
    - sendInitiateCall, sendAcceptCall, sendDeclineCall, sendEndCall
    - _Requirements: 1.1, 1.2, 2.4, 5.1_

- [x] 10. Cập nhật Call UI Components
  - [x] 10.1 Refactor `src/components/chat/CallModal.tsx`
    - Integrate với callStore thay vì local state
    - Hiển thị real video streams từ mediasoup consumers
    - Hiển thị local video preview từ local stream
    - Handle remote participant video on/off
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 10.2 Cập nhật `src/components/chat/ChatHeader.tsx`
    - Connect voice/video call buttons với callStore.initiateCall
    - _Requirements: 1.1, 1.2_

  - [x] 10.3 Tạo `src/components/chat/IncomingCallNotification.tsx`
    - Global notification component cho incoming calls
    - Hiển thị caller info, accept/decline buttons
    - Auto-decline sau 30 giây
    - Play ringtone sound
    - _Requirements: 2.1, 2.2, 2.5_

- [x] 11. Integrate Call System vào App
  - [x] 11.1 Cập nhật `src/App.tsx`
    - Thêm IncomingCallNotification component
    - Initialize call event listeners khi WebSocket connected
    - _Requirements: 2.1_

- [ ] 12. Checkpoint - Full integration works
  - Ensure all tests pass, ask the user if questions arise.

- [-] 13. Error Handling và Edge Cases
  - [x] 13.1 Implement error handling trong callStore
    - Handle media permission denied
    - Handle mediasoup connection failures
    - Handle transport disconnection và reconnection
    - _Requirements: 1.4, 8.1, 8.2, 8.4_

  - [ ]* 13.2 Write unit tests cho error scenarios
    - Test permission denied handling
    - Test connection failure handling
    - Test timeout behavior (30s incoming call)
    - _Requirements: 1.4, 2.5, 5.4, 8.1, 8.2_

- [ ] 14. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Mediasoup server (Task 1) cần được deploy riêng biệt với backend Rust
- TURN server credentials cần được cấu hình trên cả mediasoup server và client
- Property tests sử dụng fast-check library cho TypeScript
- Mediasoup server cần public IP hoặc domain với SSL cho production
