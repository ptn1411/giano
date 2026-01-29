---
title: API Reference
---

# API Reference

GIANO Backend API documentation.

## Base URL

- **Production**: `https://messages-api.bug.edu.vn`
- **Local**: `http://localhost:3000`

## Authentication

Tất cả API (trừ auth) cần header:

```http
Authorization: Bearer <access_token>
```

## Endpoints

### Auth

| Method | Endpoint                | Mô tả         |
| ------ | ----------------------- | ------------- |
| POST   | `/api/v1/auth/register` | Đăng ký       |
| POST   | `/api/v1/auth/login`    | Đăng nhập     |
| POST   | `/api/v1/auth/refresh`  | Refresh token |
| POST   | `/api/v1/auth/logout`   | Đăng xuất     |

### Chats

| Method | Endpoint                  | Mô tả          |
| ------ | ------------------------- | -------------- |
| GET    | `/api/v1/chats`           | Danh sách chat |
| POST   | `/api/v1/chats`           | Tạo chat mới   |
| GET    | `/api/v1/chats/:id`       | Chi tiết chat  |
| POST   | `/api/v1/chats/:id/pin`   | Ghim chat      |
| POST   | `/api/v1/chats/:id/unpin` | Bỏ ghim        |

### Messages

| Method | Endpoint                     | Mô tả              |
| ------ | ---------------------------- | ------------------ |
| GET    | `/api/v1/chats/:id/messages` | Danh sách tin nhắn |
| POST   | `/api/v1/chats/:id/messages` | Gửi tin nhắn       |

### Upload

| Method | Endpoint         | Mô tả       |
| ------ | ---------------- | ----------- |
| POST   | `/api/v1/upload` | Upload file |

## WebSocket

```javascript
const ws = new WebSocket("wss://messages-api.bug.edu.vn/ws");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle: new_message, typing, presence, etc.
};
```
