---
title: Quản lý thiết bị
---

# Quản lý Thiết Bị

Quản lý các thiết bị đang đăng nhập và sessions.

## Tính năng

- Xem tất cả thiết bị đang đăng nhập
- Đăng xuất từ thiết bị khác
- Thông tin: Loại thiết bị, IP, vị trí, thời gian

## API Endpoints

### Lấy danh sách devices

```http
GET /api/v1/auth/devices
Authorization: Bearer <token>
```

Response:

```json
{
  "devices": [
    {
      "id": "uuid",
      "deviceName": "Chrome on Windows",
      "ipAddress": "192.168.1.100",
      "lastActive": "2024-01-01T00:00:00Z",
      "current": true
    }
  ]
}
```

### Đăng xuất device

```http
DELETE /api/v1/auth/devices/:device_id
Authorization: Bearer <token>
```

### Đăng xuất tất cả

```http
DELETE /api/v1/auth/devices
Authorization: Bearer <token>
```

## Bảo mật

- Thông báo khi có đăng nhập mới
- Xác nhận trước khi đăng xuất tất cả
- Không thể đăng xuất thiết bị hiện tại qua API này
