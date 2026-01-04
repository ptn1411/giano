# Chat Backend API

Backend API cho ứng dụng Chat, được xây dựng bằng Rust với Axum framework.

## Tech Stack

- **Rust** - Programming language
- **Axum** - Web framework
- **SQLx** - Database toolkit
- **PostgreSQL** - Database
- **Redis** - Cache (optional)
- **JWT** - Authentication

## Prerequisites

- Rust 1.70+
- PostgreSQL 14+
- Redis (optional)

## Setup

1. Clone repository và cd vào thư mục backend:
```bash
cd backend
```

2. Copy file environment:
```bash
cp .env.example .env
```

3. Cập nhật `.env` với thông tin database của bạn.

4. Tạo database:
```bash
createdb chat_db
```

5. Chạy migrations:
```bash
cargo install sqlx-cli
sqlx migrate run
```

6. Chạy server:
```bash
cargo run
```

Server sẽ chạy tại `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Đăng ký
- `POST /api/v1/auth/login` - Đăng nhập
- `POST /api/v1/auth/logout` - Đăng xuất
- `GET /api/v1/auth/session` - Lấy session hiện tại

### Users
- `GET /api/v1/users` - Lấy danh sách users
- `GET /api/v1/users/:id` - Lấy thông tin user

### Chats
- `GET /api/v1/chats` - Lấy danh sách chats
- `GET /api/v1/chats/:id` - Lấy chi tiết chat
- `POST /api/v1/chats/group` - Tạo group chat
- `POST /api/v1/chats/:id/read` - Đánh dấu đã đọc

### Messages
- `GET /api/v1/chats/:chatId/messages` - Lấy messages
- `POST /api/v1/chats/:chatId/messages` - Gửi message
- `PUT /api/v1/chats/:chatId/messages/:id` - Sửa message
- `DELETE /api/v1/chats/:chatId/messages/:id` - Xóa message
- `POST /api/v1/chats/:chatId/messages/:id/reactions` - Toggle reaction
- `POST /api/v1/chats/:chatId/messages/:id/pin` - Pin message
- `DELETE /api/v1/chats/:chatId/messages/:id/pin` - Unpin message

### Settings
- `GET/PUT /api/v1/settings/profile` - Profile settings
- `GET/PUT /api/v1/settings/privacy` - Privacy settings
- `GET/PUT /api/v1/settings/notifications` - Notification settings
- `GET/PUT /api/v1/settings/chat` - Chat settings
- `GET/PUT /api/v1/settings/data-storage` - Data storage settings
- `POST /api/v1/settings/clear-cache` - Clear cache
- `GET/PUT /api/v1/settings/appearance` - Appearance settings
- `GET /api/v1/settings/devices` - Get devices
- `DELETE /api/v1/settings/devices/:id` - Terminate device
- `DELETE /api/v1/settings/devices` - Terminate all other devices

### Upload
- `POST /api/v1/upload` - Upload file

## Development

```bash
# Run with hot reload
cargo watch -x run

# Run tests
cargo test

# Check code
cargo clippy
```

## License

MIT
