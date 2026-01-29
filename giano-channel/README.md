# Giano Moltbot Channel

Moltbot channel plugin để kết nối với Giano chat backend.

## Cài đặt

```bash
npm install
npm run build
```

## Cấu hình

Thêm vào file cấu hình Moltbot:

```yaml
channels:
  giano:
    accounts:
      default:
        enabled: true
        apiBaseUrl: "https://messages-api.bug.edu.vn"
        wsUrl: "wss://messages-api.bug.edu.vn/ws"
        token: "your_jwt_access_token"
        botUserId: "uuid-of-bot-user" # Optional: để filter tin nhắn từ chính bot
        allowFrom:
          - "allowed-user-id-1"

plugins:
  load:
    paths:
      - "./giano-moltbot-channel"
```

## Cách hoạt động

1. **Inbound (nhận tin)**: Plugin kết nối WebSocket tới Giano backend, lắng nghe event `new_message`
2. **Outbound (gửi tin)**: Plugin gọi HTTP POST tới `/api/v1/chats/:chatId/messages`

## Các field quan trọng

| Field        | Mô tả                                                    |
| ------------ | -------------------------------------------------------- |
| `apiBaseUrl` | URL của Giano API (HTTP)                                 |
| `wsUrl`      | URL của Giano WebSocket                                  |
| `token`      | JWT access token của user/bot                            |
| `botUserId`  | ID của bot để filter tin nhắn từ chính mình (tránh loop) |
| `allowFrom`  | Danh sách user IDs được phép gửi tin                     |
