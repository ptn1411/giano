# Fix Lỗi Duplicate Key khi Sử Dụng Invite Link

## Vấn đề

Khi sử dụng invite link, gặp lỗi:
```
Database error: error returned from database: duplicate key value violates unique constraint "chat_participants_chat_id_user_id_key"
POST http://localhost:3000/api/v1/invite-links/uUZkXT1Str7R/use 500 (Internal Server Error)
```

## Nguyên nhân

Lỗi xảy ra khi:
1. User đã là thành viên của chat (qua cách khác)
2. User cố gắng sử dụng invite link để join chat đó lại
3. Code cố gắng INSERT user vào `chat_participants` nhưng bị vi phạm unique constraint `(chat_id, user_id)`

Có 2 trường hợp gây lỗi:

### Trường hợp 1: Group Chat
```rust
// Code cũ - không xử lý duplicate
sqlx::query("INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'member')")
    .bind(chat_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;
```

### Trường hợp 2: Direct Chat
```rust
// Code cũ - insert cả 2 users cùng lúc
sqlx::query("INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'member')")
    .bind(new_chat_id)
    .bind(user_id)
    .bind(creator_id)
    .execute(&mut *tx)
    .await?;
```

## Giải pháp

Sử dụng `ON CONFLICT DO NOTHING` để xử lý trường hợp user đã là thành viên:

### Fix cho Group Chat

```rust
// Check if user is already a participant
let existing = sqlx::query("SELECT id FROM chat_participants WHERE chat_id = $1 AND user_id = $2")
    .bind(chat_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

if existing.is_none() {
    // Add user to group (use ON CONFLICT to handle race conditions)
    sqlx::query(
        r#"
        INSERT INTO chat_participants (chat_id, user_id, role) 
        VALUES ($1, $2, 'member')
        ON CONFLICT (chat_id, user_id) DO NOTHING
        "#
    )
    .bind(chat_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;
}
```

### Fix cho Direct Chat

```rust
// Add both users as participants (use ON CONFLICT to handle duplicates)
sqlx::query(
    r#"
    INSERT INTO chat_participants (chat_id, user_id, role) 
    VALUES ($1, $2, 'member'), ($1, $3, 'member')
    ON CONFLICT (chat_id, user_id) DO NOTHING
    "#
)
.bind(new_chat_id)
.bind(user_id)
.bind(creator_id)
.execute(&mut *tx)
.await?;
```

## Logic Flow sau khi Fix

### Group Invite Link
1. Validate invite link (active, not expired, not max uses)
2. Check if user already used this specific link → Error nếu đã dùng
3. Check if user is already a participant → Skip insert nếu đã là member
4. Insert user vào chat_participants với ON CONFLICT DO NOTHING (handle race condition)
5. Record usage và increment counter
6. Return chat info

### Direct Invite Link
1. Validate invite link
2. Check if user already used this specific link → Error nếu đã dùng
3. Check if direct chat already exists between user và creator → Return existing chat
4. Nếu chưa có, create new direct chat
5. Insert cả 2 users với ON CONFLICT DO NOTHING (handle duplicates)
6. Record usage và increment counter
7. Return chat info

## Lợi ích

1. **Idempotent**: Có thể gọi nhiều lần mà không gây lỗi
2. **Race Condition Safe**: ON CONFLICT xử lý concurrent requests
3. **User Friendly**: User đã là member vẫn có thể "join" (return chat info)
4. **Prevent Abuse**: Vẫn track usage qua `invite_link_uses` table

## Testing

Để test fix:

1. **Test case 1**: User chưa là member
   - Tạo invite link cho group
   - User A sử dụng link → Success, được add vào group

2. **Test case 2**: User đã là member (qua cách khác)
   - User A đã trong group
   - User A sử dụng invite link → Success, return chat info (không add lại)

3. **Test case 3**: User đã sử dụng link này rồi
   - User A đã dùng link X
   - User A cố dùng link X lại → Error "You have already used this invite link"

4. **Test case 4**: Race condition
   - 2 requests cùng lúc từ cùng user
   - Cả 2 đều success, chỉ 1 record được insert

5. **Test case 5**: Direct chat
   - User A tạo direct invite link
   - User B sử dụng → Success, tạo direct chat
   - User B sử dụng lại → Error "already used"
   - User C sử dụng link của A → Success, tạo direct chat mới A-C

## Files Changed

- `backend/src/services/invite_link.rs`: Updated `use_invite_link()` function
