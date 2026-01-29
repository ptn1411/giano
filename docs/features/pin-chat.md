---
title: Ghim Chat
---

# Tính năng Ghim Cuộc Trò Chuyện

Cho phép user ghim các chat quan trọng lên đầu danh sách.

## Cách sử dụng

1. **Ghim chat**: Hover vào chat → Click menu (3 chấm) → "Ghim cuộc trò chuyện"
2. **Bỏ ghim**: Click menu → "Bỏ ghim"

## API Endpoints

### Pin Chat

```http
POST /api/v1/chats/:chat_id/pin
Authorization: Bearer <token>
```

### Unpin Chat

```http
POST /api/v1/chats/:chat_id/unpin
Authorization: Bearer <token>
```

## Database Schema

```sql
ALTER TABLE chat_participants
ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_chat_participants_pinned
ON chat_participants(user_id, is_pinned)
WHERE is_pinned = TRUE;
```

## Đặc điểm

- **Per-user pinning**: Mỗi user có danh sách ghim riêng
- **Persistent**: Lưu trong database
- **Optimistic UI**: Cập nhật UI ngay lập tức
- **Auto-sorting**: Pinned chats luôn ở đầu
