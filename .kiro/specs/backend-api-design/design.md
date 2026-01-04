# Backend API Design Document

## Overview

Tài liệu này mô tả thiết kế chi tiết Backend API cho ứng dụng Chat. API được thiết kế theo RESTful principles với JWT authentication và WebSocket cho real-time communication.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer                   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   REST API      │ │  WebSocket      │ │   File Upload   │
│   Server        │ │  Server         │ │   Service       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Auth   │ │   User   │ │   Chat   │ │ Message  │           │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  PostgreSQL  │  │    Redis     │  │     S3       │          │
│  │  (Primary)   │  │   (Cache)    │  │  (Storage)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Base URL & Conventions

- Base URL: `https://api.example.com/v1`
- Content-Type: `application/json`
- Authentication: Bearer Token (JWT)
- Date Format: ISO 8601 (`2024-01-15T10:30:00Z`)


---

## API Endpoints

### 1. Authentication APIs

#### 1.1 POST /auth/register
Đăng ký tài khoản mới.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "session": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=John"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": 1705312200000
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 400 | INVALID_EMAIL | Email format không hợp lệ |
| 400 | WEAK_PASSWORD | Password phải >= 6 ký tự |
| 400 | MISSING_NAME | Name là bắt buộc |
| 409 | EMAIL_EXISTS | Email đã được đăng ký |

---

#### 1.2 POST /auth/login
Đăng nhập vào hệ thống.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "session": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "https://...",
      "phone": "+1234567890"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": 1705312200000
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 401 | INVALID_CREDENTIALS | Email hoặc password không đúng |

---

#### 1.3 POST /auth/logout
Đăng xuất khỏi hệ thống.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### 1.4 GET /auth/session
Lấy thông tin session hiện tại.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "session": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "https://...",
      "phone": "+1234567890"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": 1705312200000
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 401 | TOKEN_EXPIRED | Token đã hết hạn |
| 401 | INVALID_TOKEN | Token không hợp lệ |


---

### 2. User APIs

#### 2.1 GET /users
Lấy danh sách tất cả users.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "user-1",
      "name": "John Doe",
      "avatar": "https://...",
      "status": "online",
      "lastSeen": null,
      "isBot": false
    },
    {
      "id": "user-2",
      "name": "Alice Johnson",
      "avatar": "https://...",
      "status": "offline",
      "lastSeen": "2024-01-15T10:30:00Z",
      "isBot": false
    },
    {
      "id": "bot-1",
      "name": "Assistant Bot",
      "avatar": "https://...",
      "status": "online",
      "isBot": true
    }
  ]
}
```

---

#### 2.2 GET /users/:userId
Lấy thông tin chi tiết của một user.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "user": {
    "id": "user-2",
    "name": "Alice Johnson",
    "avatar": "https://...",
    "status": "online",
    "lastSeen": null,
    "isBot": false
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 404 | USER_NOT_FOUND | User không tồn tại |

---

### 3. Chat APIs

#### 3.1 GET /chats
Lấy danh sách tất cả chats của user hiện tại.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| search | string | Tìm kiếm theo tên chat hoặc nội dung tin nhắn |

**Response (200 OK):**
```json
{
  "chats": [
    {
      "id": "chat-1",
      "type": "private",
      "name": "Alice Johnson",
      "avatar": "https://...",
      "participants": ["user-1", "user-2"],
      "lastMessage": {
        "id": "msg-123",
        "chatId": "chat-1",
        "senderId": "user-2",
        "text": "Hello!",
        "timestamp": "2024-01-15T10:30:00Z",
        "isRead": false,
        "deliveryStatus": "delivered"
      },
      "unreadCount": 2,
      "isTyping": false,
      "isBot": false
    },
    {
      "id": "chat-2",
      "type": "group",
      "name": "Project Team",
      "avatar": "https://...",
      "participants": ["user-1", "user-2", "user-3"],
      "lastMessage": {...},
      "unreadCount": 5,
      "isTyping": true,
      "typingUser": "Bob"
    },
    {
      "id": "bot-chat-1",
      "type": "bot",
      "name": "Assistant Bot",
      "avatar": "https://...",
      "participants": ["user-1", "bot-1"],
      "lastMessage": {...},
      "unreadCount": 1,
      "isBot": true
    }
  ]
}
```


---

#### 3.2 GET /chats/:chatId
Lấy thông tin chi tiết của một chat.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "chat": {
    "id": "chat-1",
    "type": "private",
    "name": "Alice Johnson",
    "avatar": "https://...",
    "participants": ["user-1", "user-2"],
    "unreadCount": 2,
    "isTyping": false,
    "isBot": false
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 404 | CHAT_NOT_FOUND | Chat không tồn tại |
| 403 | ACCESS_DENIED | User không phải participant |

---

#### 3.3 POST /chats/group
Tạo group chat mới.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "New Group",
  "participantIds": ["user-2", "user-3", "user-4"]
}
```

**Response (201 Created):**
```json
{
  "chat": {
    "id": "chat-new-123",
    "type": "group",
    "name": "New Group",
    "avatar": "https://api.dicebear.com/7.x/shapes/svg?seed=NewGroup",
    "participants": ["user-1", "user-2", "user-3", "user-4"],
    "unreadCount": 0
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 400 | INVALID_PARTICIPANTS | Cần ít nhất 1 participant khác |
| 400 | MISSING_NAME | Tên group là bắt buộc |

---

#### 3.4 POST /chats/:chatId/read
Đánh dấu chat đã đọc.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": "Chat marked as read"
}
```

---

### 4. Message APIs

#### 4.1 GET /chats/:chatId/messages
Lấy danh sách messages của một chat.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 50 | Số lượng messages tối đa |
| before | string | - | Message ID để pagination |

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "msg-1",
      "chatId": "chat-1",
      "senderId": "user-2",
      "text": "Hey! How's it going?",
      "timestamp": "2024-01-15T10:00:00Z",
      "isRead": true,
      "isEdited": false,
      "isPinned": false,
      "reactions": [
        { "emoji": "👍", "userId": "user-1" }
      ],
      "attachments": [],
      "replyTo": null,
      "deliveryStatus": "read",
      "readBy": [
        { "userId": "user-1", "readAt": "2024-01-15T10:01:00Z" }
      ]
    },
    {
      "id": "msg-2",
      "chatId": "chat-1",
      "senderId": "user-1",
      "text": "I'm doing great!",
      "timestamp": "2024-01-15T10:05:00Z",
      "isRead": true,
      "reactions": [],
      "attachments": [
        {
          "id": "att-1",
          "type": "image",
          "name": "photo.jpg",
          "size": 1024000,
          "url": "https://storage.example.com/...",
          "mimeType": "image/jpeg"
        }
      ],
      "replyTo": {
        "id": "msg-1",
        "text": "Hey! How's it going?",
        "senderId": "user-2",
        "senderName": "Alice Johnson"
      },
      "deliveryStatus": "delivered"
    }
  ],
  "hasMore": true
}
```


---

#### 4.2 POST /chats/:chatId/messages
Gửi message mới.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "text": "Hello everyone!",
  "attachments": [
    {
      "id": "temp-att-1",
      "type": "image",
      "name": "photo.jpg",
      "size": 1024000,
      "url": "https://storage.example.com/uploads/...",
      "mimeType": "image/jpeg"
    }
  ],
  "replyTo": {
    "id": "msg-1",
    "text": "Previous message",
    "senderId": "user-2",
    "senderName": "Alice"
  }
}
```

**Response (201 Created):**
```json
{
  "message": {
    "id": "msg-new-123",
    "chatId": "chat-1",
    "senderId": "user-1",
    "text": "Hello everyone!",
    "timestamp": "2024-01-15T10:30:00Z",
    "isRead": false,
    "reactions": [],
    "attachments": [...],
    "replyTo": {...},
    "deliveryStatus": "sent"
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 400 | EMPTY_MESSAGE | Message phải có text hoặc attachments |
| 403 | ACCESS_DENIED | User không phải participant |

---

#### 4.3 PUT /chats/:chatId/messages/:messageId
Chỉnh sửa message.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "text": "Updated message text"
}
```

**Response (200 OK):**
```json
{
  "message": {
    "id": "msg-123",
    "text": "Updated message text",
    "isEdited": true,
    ...
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 403 | NOT_MESSAGE_OWNER | Chỉ người gửi mới được sửa |
| 404 | MESSAGE_NOT_FOUND | Message không tồn tại |

---

#### 4.4 DELETE /chats/:chatId/messages/:messageId
Xóa message.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": "Message deleted successfully"
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 403 | NOT_MESSAGE_OWNER | Chỉ người gửi mới được xóa |
| 404 | MESSAGE_NOT_FOUND | Message không tồn tại |

---

#### 4.5 POST /chats/:chatId/messages/:messageId/reactions
Thêm/xóa reaction cho message.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "emoji": "👍"
}
```

**Response (200 OK):**
```json
{
  "message": {
    "id": "msg-123",
    "reactions": [
      { "emoji": "👍", "userId": "user-1" },
      { "emoji": "❤️", "userId": "user-2" }
    ]
  }
}
```

---

#### 4.6 POST /chats/:chatId/messages/:messageId/pin
Ghim message.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": {
    "id": "msg-123",
    "isPinned": true
  }
}
```

---

#### 4.7 DELETE /chats/:chatId/messages/:messageId/pin
Bỏ ghim message.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": {
    "id": "msg-123",
    "isPinned": false
  }
}
```


---

### 5. Bot APIs

#### 5.1 POST /bots/:botId/callback
Xử lý inline button callback từ bot.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "chatId": "bot-chat-1",
  "messageId": "msg-123",
  "callbackData": "stats"
}
```

**Response (200 OK):**
```json
{
  "message": {
    "id": "msg-new-456",
    "chatId": "bot-chat-1",
    "senderId": "bot-1",
    "text": "📊 Your Statistics\n\n📈 Messages: 142\n...",
    "timestamp": "2024-01-15T10:30:00Z",
    "inlineKeyboard": [
      [
        { "text": "📅 Daily", "callbackData": "daily" },
        { "text": "📆 Weekly", "callbackData": "weekly" }
      ],
      [{ "text": "🔄 Refresh", "callbackData": "refresh" }]
    ]
  }
}
```

---

### 6. Settings APIs

#### 6.1 GET /settings/profile
Lấy thông tin profile của user.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "profile": {
    "id": "user-1",
    "name": "John Doe",
    "username": "johndoe",
    "bio": "Hey there! I am using this chat app.",
    "phone": "+1 (555) 123-4567",
    "email": "john.doe@email.com",
    "avatar": "https://..."
  }
}
```

---

#### 6.2 PUT /settings/profile
Cập nhật profile.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "John Updated",
  "username": "johnupdated",
  "bio": "New bio",
  "phone": "+1234567890",
  "email": "new@email.com"
}
```

**Response (200 OK):**
```json
{
  "profile": {
    "id": "user-1",
    "name": "John Updated",
    ...
  }
}
```

---

#### 6.3 GET /settings/privacy
Lấy cài đặt privacy.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "privacy": {
    "lastSeen": "everyone",
    "profilePhoto": "contacts",
    "calls": "contacts",
    "groups": "everyone",
    "forwards": true,
    "readReceipts": true,
    "twoFactorAuth": false
  }
}
```

---

#### 6.4 PUT /settings/privacy
Cập nhật cài đặt privacy.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "lastSeen": "contacts",
  "readReceipts": false
}
```

**Response (200 OK):**
```json
{
  "privacy": {
    "lastSeen": "contacts",
    "readReceipts": false,
    ...
  }
}
```


---

#### 6.5 GET /settings/notifications
Lấy cài đặt notifications.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "notifications": {
    "messageNotifications": true,
    "groupNotifications": true,
    "channelNotifications": true,
    "inAppSounds": true,
    "inAppVibrate": true,
    "inAppPreview": true,
    "contactJoined": false
  }
}
```

---

#### 6.6 PUT /settings/notifications
Cập nhật cài đặt notifications.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "messageNotifications": false,
  "inAppSounds": false
}
```

---

#### 6.7 GET /settings/chat
Lấy cài đặt chat.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "chatSettings": {
    "sendByEnter": true,
    "mediaAutoDownload": "wifi",
    "saveToGallery": false,
    "autoPlayGifs": true,
    "autoPlayVideos": true,
    "raiseToSpeak": false
  }
}
```

---

#### 6.8 PUT /settings/chat
Cập nhật cài đặt chat.

---

#### 6.9 GET /settings/data-storage
Lấy thông tin data storage.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "dataStorage": {
    "storageUsed": 1250,
    "cacheSize": 456,
    "keepMedia": "1month",
    "autoDownloadPhotos": true,
    "autoDownloadVideos": false,
    "autoDownloadFiles": false,
    "dataSaver": false
  }
}
```

---

#### 6.10 PUT /settings/data-storage
Cập nhật cài đặt data storage.

---

#### 6.11 POST /settings/clear-cache
Xóa cache.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": "Cache cleared successfully",
  "dataStorage": {
    "cacheSize": 0,
    ...
  }
}
```

---

#### 6.12 GET /settings/appearance
Lấy cài đặt appearance.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "appearance": {
    "theme": "system",
    "accentColor": "#6366f1",
    "fontSize": "medium",
    "chatBackground": "default",
    "bubbleStyle": "rounded",
    "animationsEnabled": true
  }
}
```

---

#### 6.13 PUT /settings/appearance
Cập nhật cài đặt appearance.

---

#### 6.14 GET /settings/devices
Lấy danh sách devices/sessions.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "devices": [
    {
      "id": "device-1",
      "name": "Chrome on MacBook Pro",
      "type": "web",
      "location": "San Francisco, USA",
      "lastActive": "2024-01-15T10:30:00Z",
      "isCurrent": true
    },
    {
      "id": "device-2",
      "name": "iPhone 15 Pro",
      "type": "mobile",
      "location": "San Francisco, USA",
      "lastActive": "2024-01-15T09:30:00Z",
      "isCurrent": false
    }
  ]
}
```

---

#### 6.15 DELETE /settings/devices/:deviceId
Terminate một device session.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": "Device session terminated"
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 400 | CANNOT_TERMINATE_CURRENT | Không thể terminate session hiện tại |

---

#### 6.16 DELETE /settings/devices
Terminate tất cả sessions khác.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": "All other sessions terminated"
}
```


---

### 7. File Upload API

#### 7.1 POST /upload
Upload file (image, document).

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request:**
```
file: <binary>
type: "image" | "file"
```

**Response (200 OK):**
```json
{
  "attachment": {
    "id": "att-123",
    "type": "image",
    "name": "photo.jpg",
    "size": 1024000,
    "url": "https://storage.example.com/uploads/att-123.jpg",
    "mimeType": "image/jpeg"
  }
}
```

**Error Responses:**
| Code | Error | Description |
|------|-------|-------------|
| 400 | FILE_TOO_LARGE | File vượt quá giới hạn (10MB) |
| 400 | INVALID_FILE_TYPE | Loại file không được hỗ trợ |

---

## WebSocket Events

### Connection
```javascript
// Connect with authentication
const ws = new WebSocket('wss://api.example.com/ws?token=<jwt_token>');
```

### Events từ Server

#### new_message
```json
{
  "event": "new_message",
  "data": {
    "message": {
      "id": "msg-123",
      "chatId": "chat-1",
      "senderId": "user-2",
      "text": "Hello!",
      ...
    }
  }
}
```

#### typing
```json
{
  "event": "typing",
  "data": {
    "chatId": "chat-1",
    "userId": "user-2",
    "userName": "Alice",
    "isTyping": true
  }
}
```

#### user_status
```json
{
  "event": "user_status",
  "data": {
    "userId": "user-2",
    "status": "online",
    "lastSeen": null
  }
}
```

#### message_status
```json
{
  "event": "message_status",
  "data": {
    "chatId": "chat-1",
    "messageId": "msg-123",
    "status": "delivered"
  }
}
```

#### message_read
```json
{
  "event": "message_read",
  "data": {
    "chatId": "chat-1",
    "messageId": "msg-123",
    "readBy": {
      "userId": "user-2",
      "readAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Events từ Client

#### start_typing
```json
{
  "event": "start_typing",
  "data": {
    "chatId": "chat-1"
  }
}
```

#### stop_typing
```json
{
  "event": "stop_typing",
  "data": {
    "chatId": "chat-1"
  }
}
```

---

## Error Response Format

Tất cả error responses tuân theo format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional additional details
  }
}
```

### Common Error Codes

| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| 400 | BAD_REQUEST | Request không hợp lệ |
| 401 | UNAUTHORIZED | Chưa xác thực |
| 401 | TOKEN_EXPIRED | Token hết hạn |
| 401 | INVALID_TOKEN | Token không hợp lệ |
| 403 | FORBIDDEN | Không có quyền truy cập |
| 404 | NOT_FOUND | Resource không tồn tại |
| 409 | CONFLICT | Xung đột dữ liệu |
| 422 | VALIDATION_ERROR | Dữ liệu không hợp lệ |
| 429 | RATE_LIMITED | Quá nhiều requests |
| 500 | INTERNAL_ERROR | Lỗi server |


---

## Database Schema

### ERD Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │     │     chats       │     │   messages      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ email           │     │ type            │     │ chat_id (FK)    │
│ password_hash   │     │ name            │     │ sender_id (FK)  │
│ name            │     │ avatar          │     │ text            │
│ username        │     │ created_at      │     │ timestamp       │
│ avatar          │     │ updated_at      │     │ is_read         │
│ bio             │     └────────┬────────┘     │ is_edited       │
│ phone           │              │              │ is_pinned       │
│ status          │              │              │ reply_to_id     │
│ last_seen       │     ┌────────┴────────┐     │ delivery_status │
│ is_bot          │     │ chat_participants│     │ created_at      │
│ created_at      │     ├─────────────────┤     │ updated_at      │
│ updated_at      │     │ chat_id (FK)    │     └────────┬────────┘
└────────┬────────┘     │ user_id (FK)    │              │
         │              │ joined_at       │     ┌────────┴────────┐
         │              │ role            │     │   attachments   │
         │              └─────────────────┘     ├─────────────────┤
         │                                      │ id (PK)         │
         │                                      │ message_id (FK) │
         │                                      │ type            │
         │                                      │ name            │
         │                                      │ size            │
         │                                      │ url             │
         │                                      │ mime_type       │
         │                                      └─────────────────┘
         │
┌────────┴────────┐     ┌─────────────────┐     ┌─────────────────┐
│    sessions     │     │   reactions     │     │   read_receipts │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ user_id (FK)    │     │ message_id (FK) │     │ message_id (FK) │
│ token           │     │ user_id (FK)    │     │ user_id (FK)    │
│ device_name     │     │ emoji           │     │ read_at         │
│ device_type     │     │ created_at      │     └─────────────────┘
│ location        │     └─────────────────┘
│ expires_at      │
│ created_at      │
│ last_active     │
└─────────────────┘
```

### Table Definitions

#### 1. users
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    username        VARCHAR(50) UNIQUE,
    avatar          TEXT,
    bio             TEXT,
    phone           VARCHAR(20),
    status          VARCHAR(20) DEFAULT 'offline', -- online, offline, away
    last_seen       TIMESTAMP WITH TIME ZONE,
    is_bot          BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
```

#### 2. chats
```sql
CREATE TABLE chats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(20) NOT NULL, -- private, group, bot
    name            VARCHAR(100),
    avatar          TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chats_type ON chats(type);
CREATE INDEX idx_chats_created_by ON chats(created_by);
```

#### 3. chat_participants
```sql
CREATE TABLE chat_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'member', -- admin, member
    unread_count    INTEGER DEFAULT 0,
    joined_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_chat_participants_chat ON chat_participants(chat_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);
```


#### 4. messages
```sql
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    text            TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    is_edited       BOOLEAN DEFAULT FALSE,
    is_pinned       BOOLEAN DEFAULT FALSE,
    reply_to_id     UUID REFERENCES messages(id),
    delivery_status VARCHAR(20) DEFAULT 'sent', -- sending, sent, delivered, read, failed
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_pinned ON messages(chat_id, is_pinned) WHERE is_pinned = TRUE;
```

#### 5. attachments
```sql
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL, -- image, file, voice
    name            VARCHAR(255) NOT NULL,
    size            BIGINT NOT NULL,
    url             TEXT NOT NULL,
    mime_type       VARCHAR(100),
    duration        INTEGER, -- for voice messages, in seconds
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON attachments(message_id);
```

#### 6. reactions
```sql
CREATE TABLE reactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji           VARCHAR(10) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON reactions(message_id);
```

#### 7. read_receipts
```sql
CREATE TABLE read_receipts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_read_receipts_message ON read_receipts(message_id);
```

#### 8. sessions
```sql
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(500) UNIQUE NOT NULL,
    device_name     VARCHAR(100),
    device_type     VARCHAR(20), -- desktop, mobile, tablet, web
    location        VARCHAR(100),
    ip_address      INET,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

#### 9. user_settings
```sql
CREATE TABLE user_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Privacy Settings
    last_seen_visibility    VARCHAR(20) DEFAULT 'everyone', -- everyone, contacts, nobody
    profile_photo_visibility VARCHAR(20) DEFAULT 'everyone',
    calls_visibility        VARCHAR(20) DEFAULT 'contacts',
    groups_visibility       VARCHAR(20) DEFAULT 'contacts',
    forwards_enabled        BOOLEAN DEFAULT TRUE,
    read_receipts_enabled   BOOLEAN DEFAULT TRUE,
    two_factor_enabled      BOOLEAN DEFAULT FALSE,
    
    -- Notification Settings
    message_notifications   BOOLEAN DEFAULT TRUE,
    group_notifications     BOOLEAN DEFAULT TRUE,
    channel_notifications   BOOLEAN DEFAULT TRUE,
    in_app_sounds          BOOLEAN DEFAULT TRUE,
    in_app_vibrate         BOOLEAN DEFAULT TRUE,
    in_app_preview         BOOLEAN DEFAULT TRUE,
    contact_joined_notify  BOOLEAN DEFAULT FALSE,
    
    -- Chat Settings
    send_by_enter          BOOLEAN DEFAULT TRUE,
    media_auto_download    VARCHAR(20) DEFAULT 'wifi', -- wifi, always, never
    save_to_gallery        BOOLEAN DEFAULT FALSE,
    auto_play_gifs         BOOLEAN DEFAULT TRUE,
    auto_play_videos       BOOLEAN DEFAULT TRUE,
    raise_to_speak         BOOLEAN DEFAULT FALSE,
    
    -- Data Storage Settings
    keep_media             VARCHAR(20) DEFAULT '1month', -- 1week, 1month, 3months, forever
    auto_download_photos   BOOLEAN DEFAULT TRUE,
    auto_download_videos   BOOLEAN DEFAULT FALSE,
    auto_download_files    BOOLEAN DEFAULT FALSE,
    data_saver             BOOLEAN DEFAULT FALSE,
    
    -- Appearance Settings
    theme                  VARCHAR(20) DEFAULT 'system', -- light, dark, system
    accent_color           VARCHAR(20) DEFAULT '#6366f1',
    font_size              VARCHAR(20) DEFAULT 'medium', -- small, medium, large
    chat_background        VARCHAR(50) DEFAULT 'default',
    bubble_style           VARCHAR(20) DEFAULT 'rounded', -- rounded, square
    animations_enabled     BOOLEAN DEFAULT TRUE,
    
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);
```

#### 10. inline_keyboards (for bot messages)
```sql
CREATE TABLE inline_keyboards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    row_index       INTEGER NOT NULL,
    button_index    INTEGER NOT NULL,
    text            VARCHAR(100) NOT NULL,
    callback_data   VARCHAR(100),
    url             TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inline_keyboards_message ON inline_keyboards(message_id);
```


---

## Data Models Summary

### TypeScript Interfaces (Backend)

```typescript
// User
interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  username?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: Date;
  isBot: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Chat
interface Chat {
  id: string;
  type: 'private' | 'group' | 'bot';
  name?: string;
  avatar?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Message
interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text?: string;
  isRead: boolean;
  isEdited: boolean;
  isPinned: boolean;
  replyToId?: string;
  deliveryStatus: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

// Attachment
interface Attachment {
  id: string;
  messageId: string;
  type: 'image' | 'file' | 'voice';
  name: string;
  size: number;
  url: string;
  mimeType?: string;
  duration?: number;
  createdAt: Date;
}

// Session
interface Session {
  id: string;
  userId: string;
  token: string;
  deviceName?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'web';
  location?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
  lastActive: Date;
}
```

---

## Authentication & Authorization

### JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-123",           // User ID
    "email": "user@example.com",
    "name": "John Doe",
    "iat": 1705225800,           // Issued at
    "exp": 1705830600,           // Expires at (7 days)
    "jti": "session-456"         // Session ID
  }
}
```

### Permission Matrix

| Resource | Action | Owner | Participant | Admin | Public |
|----------|--------|-------|-------------|-------|--------|
| Message | Create | - | ✓ | ✓ | - |
| Message | Read | - | ✓ | ✓ | - |
| Message | Edit | ✓ | - | - | - |
| Message | Delete | ✓ | - | ✓ | - |
| Message | Pin | - | - | ✓ | - |
| Chat | Read | - | ✓ | ✓ | - |
| Chat | Update | - | - | ✓ | - |
| Chat | Delete | - | - | ✓ | - |
| User Profile | Read | ✓ | ✓ | ✓ | Based on privacy |
| User Profile | Update | ✓ | - | - | - |
| Settings | Read/Update | ✓ | - | - | - |

---

## Rate Limiting

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|--------|
| Authentication | 5 requests | 1 minute |
| Messages (send) | 30 requests | 1 minute |
| Messages (read) | 100 requests | 1 minute |
| File Upload | 10 requests | 1 minute |
| General API | 60 requests | 1 minute |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Authentication Token Validity
*For any* valid JWT token, decoding and verifying the token SHALL return the correct user information and the token SHALL not be expired.
**Validates: Requirements 1.3, 1.6, 1.7**

### Property 2: Message Delivery Consistency
*For any* message sent to a chat, all participants of that chat SHALL eventually receive the message via WebSocket or API polling.
**Validates: Requirements 4.1, 5.1**

### Property 3: Chat Participant Access Control
*For any* chat operation (read messages, send messages), only users who are participants of that chat SHALL be authorized to perform the operation.
**Validates: Requirements 3.4, 4.1, 4.2**

### Property 4: Message Edit/Delete Authorization
*For any* message edit or delete operation, only the original sender of the message SHALL be authorized to perform the operation.
**Validates: Requirements 4.3, 4.4**

### Property 5: Reaction Toggle Idempotence
*For any* user adding the same reaction to the same message twice, the second operation SHALL remove the reaction (toggle behavior).
**Validates: Requirements 4.5**

### Property 6: Session Termination Completeness
*For any* session termination request, the terminated session's token SHALL become invalid for all subsequent API requests.
**Validates: Requirements 7.2, 7.3**

---

## Testing Strategy

### Unit Tests
- Test individual service methods
- Test validation logic
- Test authorization checks

### Integration Tests
- Test API endpoints with database
- Test WebSocket connections
- Test file upload flow

### Property-Based Tests
- Test authentication token round-trip
- Test message delivery to all participants
- Test reaction toggle behavior
- Test session invalidation

---

## Error Handling

All errors follow consistent format and include:
- HTTP status code
- Error code for programmatic handling
- Human-readable message
- Optional details for debugging

Errors are logged with correlation IDs for tracing.
