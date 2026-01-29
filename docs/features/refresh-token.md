---
title: Refresh Token
---

# Refresh Token

Hệ thống xác thực an toàn với access token và refresh token.

## Cách hoạt động

1. **Login** → Nhận `access_token` (15 phút) + `refresh_token` (7 ngày)
2. **API call** → Dùng `access_token`
3. **Token hết hạn** → Tự động refresh bằng `refresh_token`
4. **Refresh token hết hạn** → Yêu cầu login lại

## API Endpoints

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

Response:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900
}
```

### Refresh

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

## Frontend Integration

```typescript
// Tự động refresh token khi gọi API
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const newToken = await refreshToken();
      // Retry request với token mới
    }
    return Promise.reject(error);
  },
);
```

## Bảo mật

- Access token ngắn hạn (15 phút)
- Refresh token dài hạn nhưng rotate sau mỗi lần dùng
- Revoke token khi logout
