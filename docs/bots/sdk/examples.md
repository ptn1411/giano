# Bot SDK Examples

Thư mục này chứa các ví dụ về cách sử dụng Bot SDK TypeScript.

## Danh sách ví dụ

### 1. Basic Bot (`basic-bot.ts`)
Ví dụ cơ bản về cách tạo một bot đơn giản với các lệnh cơ bản.

**Tính năng:**
- Xử lý lệnh `/start`, `/help`, `/echo`, `/time`
- Xử lý tin nhắn văn bản
- Xử lý lỗi và sự kiện

**Chạy:**
```bash
BOT_TOKEN=your_token ts-node examples/basic-bot.ts
```

### 2. Middleware Bot (`middleware-bot.ts`)
Ví dụ về cách sử dụng middleware để logging, authentication, và rate limiting.

**Tính năng:**
- Logging middleware - Ghi log tất cả tin nhắn
- Authentication middleware - Kiểm tra quyền admin
- Rate limiting middleware - Giới hạn tốc độ gửi tin nhắn
- Error handling middleware - Xử lý lỗi toàn cục

**Chạy:**
```bash
BOT_TOKEN=your_token ts-node examples/middleware-bot.ts
```

### 3. Buttons Bot (`buttons-bot.ts`)
Ví dụ về cách sử dụng inline buttons (nút bấm) trong bot.

**Tính năng:**
- Menu với các nút lựa chọn
- Cài đặt với các nút toggle
- Quiz với các nút trả lời
- Rating với emoji buttons
- Xác nhận hành động
- Phân trang (pagination)

**Chạy:**
```bash
BOT_TOKEN=your_token ts-node examples/buttons-bot.ts
```

### 4. Conversation Bot (`conversation-bot.ts`)
Ví dụ về bot có khả năng quản lý trạng thái hội thoại.

**Tính năng:**
- Quản lý trạng thái người dùng
- Hội thoại nhiều bước (multi-step conversation)
- Validation dữ liệu đầu vào
- Lưu trữ thông tin người dùng

**Chạy:**
```bash
BOT_TOKEN=your_token ts-node examples/conversation-bot.ts
```

### 5. Webhook Bot (`webhook-bot.ts`)
Ví dụ về bot chạy ở chế độ webhook, phù hợp cho serverless deployment.

**Tính năng:**
- Chế độ webhook thay vì WebSocket
- Phù hợp cho AWS Lambda, Vercel, etc.
- HTTP server để nhận updates

**Chạy:**
```bash
BOT_TOKEN=your_token PORT=8080 ts-node examples/webhook-bot.ts
```

## Cài đặt

Trước khi chạy các ví dụ, cần cài đặt dependencies:

```bash
cd bot-sdk-typescript
npm install
npm run build
```

## Biến môi trường

Các ví dụ sử dụng các biến môi trường sau:

- `BOT_TOKEN` - Token của bot (bắt buộc)
- `API_BASE_URL` - URL của API server (mặc định: `http://localhost:3000`)
- `WS_URL` - URL của WebSocket server (mặc định: `ws://localhost:3000`)
- `PORT` - Port cho webhook server (mặc định: `8080`)
- `WEBHOOK_PATH` - Path cho webhook endpoint (mặc định: `/webhook`)

## Chạy ví dụ

### Với ts-node

```bash
# Cài đặt ts-node nếu chưa có
npm install -g ts-node

# Chạy ví dụ
BOT_TOKEN=your_token ts-node examples/basic-bot.ts
```

### Với Node.js (sau khi build)

```bash
# Build SDK
npm run build

# Chạy ví dụ
BOT_TOKEN=your_token node examples/basic-bot.js
```

## Tùy chỉnh

Bạn có thể tùy chỉnh các ví dụ theo nhu cầu của mình:

1. Thay đổi token và URL trong code
2. Thêm các lệnh mới
3. Thêm middleware tùy chỉnh
4. Thay đổi logic xử lý tin nhắn

## Tài liệu

Xem thêm tài liệu chi tiết tại [README.md](../README.md)
