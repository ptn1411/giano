# Tính năng Ghim Cuộc Trò Chuyện

## Tổng quan
Đã implement tính năng ghim cuộc trò chuyện, cho phép user ghim các chat quan trọng lên đầu danh sách.

## Backend Changes

### 1. Database Migration (`backend/migrations/20260111000001_pinned_chats.sql`)

Thêm 2 cột mới vào bảng `chat_participants`:
- `is_pinned` (BOOLEAN): Trạng thái ghim của chat cho user
- `pinned_at` (TIMESTAMP): Thời điểm ghim chat

```sql
ALTER TABLE chat_participants 
ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_chat_participants_pinned ON chat_participants(user_id, is_pinned) WHERE is_pinned = TRUE;
```

### 2. Models (`backend/src/models/chat.rs`)

Cập nhật `ChatParticipant` và `ChatResponse`:

```rust
pub struct ChatParticipant {
    pub id: Uuid,
    pub chat_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub unread_count: i32,
    pub is_pinned: Option<bool>,      // NEW
    pub pinned_at: Option<DateTime<Utc>>,  // NEW
    pub joined_at: DateTime<Utc>,
}

pub struct ChatResponse {
    // ... existing fields
    pub is_pinned: bool,  // NEW
}
```

### 3. Service Layer (`backend/src/services/chat.rs`)

#### Thêm methods mới:

```rust
/// Pin a chat for a user
pub async fn pin_chat(db: &Database, chat_id: Uuid, user_id: Uuid) -> AppResult<()>

/// Unpin a chat for a user
pub async fn unpin_chat(db: &Database, chat_id: Uuid, user_id: Uuid) -> AppResult<()>
```

#### Cập nhật `get_user_chats`:
Sắp xếp chats với pinned chats lên đầu:

```rust
ORDER BY cp.is_pinned DESC NULLS LAST, c.updated_at DESC
```

#### Cập nhật `build_chat_response`:
Include `is_pinned` field:

```rust
is_pinned: participant.is_pinned.unwrap_or(false),
```

### 4. Routes (`backend/src/routes/chats.rs`)

Thêm 2 routes mới:

```rust
.route("/:chat_id/pin", post(pin_chat))
.route("/:chat_id/unpin", post(unpin_chat))
```

Handler functions:

```rust
async fn pin_chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<SimpleMessage>>

async fn unpin_chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<SimpleMessage>>
```

## Frontend Changes

### 1. Types (`src/services/api/types.ts`)

Cập nhật `Chat` interface:

```typescript
export interface Chat {
  // ... existing fields
  isPinned: boolean;  // NEW
}
```

### 2. API Service (`src/services/api/chats.ts`)

Thêm 2 methods mới:

```typescript
async pinChat(chatId: string): Promise<{ error: string | null }>
async unpinChat(chatId: string): Promise<{ error: string | null }>
```

### 3. Store (`src/stores/chatsStore.ts`)

Thêm actions:

```typescript
pinChat: async (chatId: string) => Promise<void>
unpinChat: async (chatId: string) => Promise<void>
```

Logic:
- Optimistic update: Cập nhật UI ngay lập tức
- Call API
- Nếu thành công: Re-sort chats (pinned lên đầu)
- Nếu thất bại: Rollback và hiển thị error

### 4. UI Component (`src/components/chat/ChatListItem.tsx`)

#### Thêm Pin Icon:
```tsx
{chat.isPinned && (
  <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
)}
```

#### Thêm Context Menu:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <MoreVertical className="h-4 w-4" />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handlePinToggle}>
      <Pin className="h-4 w-4 mr-2" />
      {chat.isPinned ? 'Bỏ ghim' : 'Ghim cuộc trò chuyện'}
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Context menu chỉ hiển thị khi hover và không áp dụng cho BotFather chat.

### 5. BotFather (`src/lib/botfather.ts`)

Cập nhật `BOTFATHER_CHAT` để include `isPinned: false`.

## API Endpoints

### Pin Chat
```
POST /api/v1/chats/:chat_id/pin
Authorization: Bearer <token>

Response:
{
  "message": "Chat pinned successfully"
}
```

### Unpin Chat
```
POST /api/v1/chats/:chat_id/unpin
Authorization: Bearer <token>

Response:
{
  "message": "Chat unpinned successfully"
}
```

### Get Chats (Updated)
```
GET /api/v1/chats
Authorization: Bearer <token>

Response:
{
  "chats": [
    {
      "id": "uuid",
      "type": "private",
      "name": "John Doe",
      "avatar": "url",
      "participants": ["uuid1", "uuid2"],
      "lastMessage": {...},
      "unreadCount": 0,
      "isTyping": false,
      "isBot": false,
      "isPinned": true  // NEW
    }
  ]
}
```

## User Flow

1. **Pin a chat:**
   - User hover vào chat item
   - Context menu (3 dots) xuất hiện
   - Click vào menu → Click "Ghim cuộc trò chuyện"
   - Chat được ghim và di chuyển lên đầu danh sách
   - Pin icon xuất hiện bên cạnh tên chat

2. **Unpin a chat:**
   - User hover vào pinned chat
   - Click context menu → Click "Bỏ ghim"
   - Chat được bỏ ghim và di chuyển về vị trí theo thời gian cập nhật
   - Pin icon biến mất

3. **Sorting:**
   - Pinned chats luôn ở đầu danh sách
   - Trong nhóm pinned: Sắp xếp theo thời gian cập nhật
   - Trong nhóm unpinned: Sắp xếp theo thời gian cập nhật

## Features

1. **Per-user pinning**: Mỗi user có thể ghim chat riêng của mình
2. **Persistent**: Trạng thái ghim được lưu trong database
3. **Optimistic UI**: UI cập nhật ngay lập tức, không cần đợi API
4. **Error handling**: Rollback nếu API call thất bại
5. **Visual indicator**: Pin icon hiển thị rõ ràng
6. **Easy access**: Context menu dễ sử dụng
7. **BotFather exception**: BotFather chat không thể ghim

## Database Schema

```sql
-- chat_participants table
CREATE TABLE chat_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'member',
    unread_count    INTEGER DEFAULT 0,
    is_pinned       BOOLEAN DEFAULT FALSE,           -- NEW
    pinned_at       TIMESTAMP WITH TIME ZONE,        -- NEW
    joined_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

-- Index for efficient pinned chat queries
CREATE INDEX idx_chat_participants_pinned 
ON chat_participants(user_id, is_pinned) 
WHERE is_pinned = TRUE;
```

## Testing

### Backend
```bash
cd backend
cargo test
```

### Frontend
1. Login to app
2. Hover over a chat item
3. Click context menu (3 dots)
4. Click "Ghim cuộc trò chuyện"
5. Verify chat moves to top with pin icon
6. Refresh page - verify chat stays pinned
7. Click "Bỏ ghim" - verify chat unpins

### API Testing
```bash
# Pin a chat
curl -X POST http://localhost:3000/api/v1/chats/{chat_id}/pin \
  -H "Authorization: Bearer {token}"

# Unpin a chat
curl -X POST http://localhost:3000/api/v1/chats/{chat_id}/unpin \
  -H "Authorization: Bearer {token}"

# Get chats (verify sorting)
curl http://localhost:3000/api/v1/chats \
  -H "Authorization: Bearer {token}"
```

## Files Changed

### Backend
- `backend/migrations/20260111000001_pinned_chats.sql` (NEW)
- `backend/src/models/chat.rs`
- `backend/src/services/chat.rs`
- `backend/src/routes/chats.rs`

### Frontend
- `src/services/api/types.ts`
- `src/services/api/chats.ts`
- `src/stores/chatsStore.ts`
- `src/components/chat/ChatListItem.tsx`
- `src/lib/botfather.ts`

## Future Enhancements

1. **Pin limit**: Giới hạn số lượng chat có thể ghim (e.g., max 5)
2. **Pin order**: Cho phép sắp xếp thứ tự các pinned chats
3. **Keyboard shortcut**: Phím tắt để pin/unpin (e.g., Ctrl+P)
4. **Bulk operations**: Pin/unpin nhiều chats cùng lúc
5. **Pin categories**: Ghim theo nhóm (work, personal, etc.)
