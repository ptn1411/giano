# Requirements Document

## Introduction

Tính năng gọi điện âm thanh và video cho phép người dùng thực hiện cuộc gọi real-time với nhau thông qua WebRTC. Hệ thống sử dụng WebSocket hiện có để signaling và thiết lập kết nối peer-to-peer giữa các client.

## Glossary

- **WebRTC_Service**: Service quản lý kết nối WebRTC, xử lý media streams và ICE candidates
- **Call_Manager**: Module quản lý trạng thái cuộc gọi, xử lý incoming/outgoing calls
- **Signaling_Server**: Backend WebSocket server xử lý trao đổi SDP và ICE candidates
- **Call_UI**: Giao diện người dùng hiển thị cuộc gọi, controls và video streams
- **Media_Handler**: Module xử lý camera, microphone và screen sharing

## Requirements

### Requirement 1: Khởi tạo cuộc gọi đi

**User Story:** As a user, I want to initiate voice or video calls to my contacts, so that I can communicate in real-time.

#### Acceptance Criteria

1. WHEN a user clicks the voice call button, THE Call_Manager SHALL create an outgoing voice call request and send it via Signaling_Server
2. WHEN a user clicks the video call button, THE Call_Manager SHALL create an outgoing video call request with camera access and send it via Signaling_Server
3. WHEN initiating a call, THE WebRTC_Service SHALL request appropriate media permissions (microphone for voice, microphone + camera for video)
4. IF media permission is denied, THEN THE Call_UI SHALL display an error message and cancel the call
5. WHEN a call is initiated, THE Call_UI SHALL display the calling state with contact information and a cancel button

### Requirement 2: Nhận cuộc gọi đến

**User Story:** As a user, I want to receive incoming calls with notification, so that I can accept or decline calls from contacts.

#### Acceptance Criteria

1. WHEN an incoming call signal is received, THE Call_UI SHALL display an incoming call modal with caller information
2. WHEN an incoming call is received, THE Call_UI SHALL show accept and decline buttons
3. WHEN a user accepts an incoming call, THE WebRTC_Service SHALL establish the peer connection and start media streaming
4. WHEN a user declines an incoming call, THE Call_Manager SHALL send a decline signal to the caller
5. IF an incoming call is not answered within 30 seconds, THEN THE Call_Manager SHALL automatically decline the call

### Requirement 3: Thiết lập kết nối WebRTC

**User Story:** As a system, I want to establish peer-to-peer connections using WebRTC, so that users can communicate directly with low latency.

#### Acceptance Criteria

1. WHEN a call is accepted, THE WebRTC_Service SHALL create an RTCPeerConnection with STUN/TURN server configuration
2. WHEN creating an offer, THE WebRTC_Service SHALL generate SDP offer and send it via Signaling_Server
3. WHEN receiving an SDP offer, THE WebRTC_Service SHALL create an SDP answer and send it back via Signaling_Server
4. WHEN ICE candidates are generated, THE WebRTC_Service SHALL send them to the remote peer via Signaling_Server
5. WHEN receiving ICE candidates, THE WebRTC_Service SHALL add them to the peer connection
6. WHEN the peer connection state changes to "connected", THE Call_UI SHALL update to show the connected call state

### Requirement 4: Điều khiển trong cuộc gọi

**User Story:** As a user, I want to control my audio and video during a call, so that I can manage my privacy and communication.

#### Acceptance Criteria

1. WHEN a user toggles the mute button, THE Media_Handler SHALL enable or disable the local audio track
2. WHEN a user toggles the video button during a video call, THE Media_Handler SHALL enable or disable the local video track
3. WHEN a user toggles the speaker button, THE Media_Handler SHALL switch audio output between speaker and earpiece
4. WHEN a user clicks the screen share button, THE Media_Handler SHALL request screen capture permission and replace video track
5. WHEN screen sharing is active, THE Call_UI SHALL display an indicator showing screen share status

### Requirement 5: Kết thúc cuộc gọi

**User Story:** As a user, I want to end calls cleanly, so that resources are properly released.

#### Acceptance Criteria

1. WHEN a user clicks the end call button, THE Call_Manager SHALL send an end call signal and close the peer connection
2. WHEN an end call signal is received, THE WebRTC_Service SHALL close the peer connection and stop all media tracks
3. WHEN a call ends, THE Call_UI SHALL display call duration and close the modal
4. IF the peer connection is unexpectedly closed, THEN THE Call_Manager SHALL detect disconnection and end the call gracefully

### Requirement 6: Signaling qua WebSocket

**User Story:** As a system, I want to exchange signaling data through WebSocket, so that WebRTC connections can be established.

#### Acceptance Criteria

1. WHEN a call offer is created, THE Signaling_Server SHALL route the offer to the target user's WebSocket connection
2. WHEN a call answer is created, THE Signaling_Server SHALL route the answer back to the caller
3. WHEN ICE candidates are generated, THE Signaling_Server SHALL relay them between peers
4. WHEN a call signal is received for an offline user, THE Signaling_Server SHALL return an error indicating user unavailable
5. THE Signaling_Server SHALL validate that call signals are only sent between users who have an existing chat

### Requirement 7: Hiển thị video streams

**User Story:** As a user, I want to see video streams during video calls, so that I can have face-to-face communication.

#### Acceptance Criteria

1. WHEN a video call is connected, THE Call_UI SHALL display the remote video stream in the main view
2. WHEN a video call is connected, THE Call_UI SHALL display the local video stream in a small preview
3. WHEN the remote user turns off their video, THE Call_UI SHALL display their avatar instead of video
4. WHEN in fullscreen mode, THE Call_UI SHALL maximize the video display and show controls overlay
5. WHEN the local video is disabled, THE Call_UI SHALL hide the local video preview

### Requirement 8: Xử lý lỗi và edge cases

**User Story:** As a user, I want the system to handle errors gracefully, so that I have a reliable calling experience.

#### Acceptance Criteria

1. IF WebRTC connection fails, THEN THE Call_UI SHALL display an error message and offer to retry
2. IF network connection is lost during a call, THEN THE Call_Manager SHALL attempt to reconnect for 10 seconds before ending the call
3. IF the remote peer's media stream is interrupted, THEN THE Call_UI SHALL display a "reconnecting" indicator
4. IF STUN/TURN servers are unreachable, THEN THE WebRTC_Service SHALL fall back to available servers or display connection error
