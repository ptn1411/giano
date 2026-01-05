# Refresh Token Implementation Guide

## Overview

This guide explains the refresh token mechanism implemented in the chat backend for improved security and user experience.

## What Changed

### 1. Token Strategy

**Before:**
- Single JWT token with long expiration (7 days)
- If token is compromised, attacker has access for 7 days

**After:**
- **Access Token**: Short-lived (1 hour) - used for API requests
- **Refresh Token**: Long-lived (7 days) - used only to get new access tokens
- If access token is compromised, attacker only has 1 hour of access
- Refresh token is stored in database and can be revoked

### 2. Database Changes

**New columns in `sessions` table:**
```sql
ALTER TABLE sessions 
ADD COLUMN refresh_token TEXT,
ADD COLUMN refresh_expires_at TIMESTAMP WITH TIME ZONE;
```

**New table `login_attempts`:**
```sql
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT
);
```

### 3. API Changes

#### Login Response (Updated)
```json
{
  "session": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "avatar": "https://...",
      "status": "online"
    },
    "token": "eyJhbGc...",           // Access token (1 hour)
    "expiresAt": 1704398400000,
    "refreshToken": "eyJhbGc...",    // NEW: Refresh token (7 days)
    "refreshExpiresAt": 1704998400000 // NEW
  }
}
```

#### New Endpoint: POST /api/v1/auth/refresh
```json
// Request
{
  "refreshToken": "eyJhbGc..."
}

// Response
{
  "session": {
    "user": { ... },
    "token": "new_access_token",
    "expiresAt": 1704402000000,
    "refreshToken": "same_refresh_token",
    "refreshExpiresAt": 1704998400000
  }
}
```

## Rate Limiting

### Login Rate Limits

**Email-based:**
- Max 5 failed attempts per email in 15 minutes
- Exponential backoff: 60s → 120s → 300s → 600s → 900s

**IP-based:**
- Max 10 failed attempts per IP in 15 minutes
- Protects against distributed attacks

**Response when rate limited:**
```json
{
  "error": {
    "code": "LOGIN_RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts, retry after 60 seconds"
  }
}
```
HTTP Status: `429 Too Many Requests`

### How It Works

1. **Before login attempt:**
   - Check failed attempts for email (last 15 min)
   - Check failed attempts for IP (last 15 min)
   - If exceeded, return 429 with retry-after

2. **After login attempt:**
   - Record attempt (success/failure) with email, IP, user-agent
   - If successful, clear all failed attempts for that email

3. **Cleanup:**
   - Old attempts (>24 hours) are automatically cleaned up
   - Run `SELECT cleanup_old_login_attempts()` periodically

## Frontend Integration

### 1. Store Both Tokens

```typescript
// After login/register
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { session } = await response.json();

// Store both tokens
localStorage.setItem('token', session.token);
localStorage.setItem('refreshToken', session.refreshToken);
localStorage.setItem('tokenExpiry', session.expiresAt);
```

### 2. Auto-Refresh Access Token

```typescript
// Axios interceptor example
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/api/v1/auth/refresh', {
          refreshToken
        });

        const { session } = response.data;
        
        // Update stored tokens
        localStorage.setItem('token', session.token);
        localStorage.setItem('tokenExpiry', session.expiresAt);

        // Retry original request with new token
        originalRequest.headers['Authorization'] = `Bearer ${session.token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### 3. Proactive Token Refresh

```typescript
// Check token expiry before making requests
async function getValidToken(): Promise<string> {
  const token = localStorage.getItem('token');
  const expiry = parseInt(localStorage.getItem('tokenExpiry') || '0');
  const now = Date.now();

  // If token expires in less than 5 minutes, refresh it
  if (expiry - now < 5 * 60 * 1000) {
    const refreshToken = localStorage.getItem('refreshToken');
    
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const { session } = await response.json();
    
    localStorage.setItem('token', session.token);
    localStorage.setItem('tokenExpiry', session.expiresAt);
    
    return session.token;
  }

  return token!;
}

// Use in API calls
const token = await getValidToken();
fetch('/api/v1/chats', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Security Benefits

### 1. Reduced Attack Window
- Access token only valid for 1 hour
- Even if stolen, attacker has limited time

### 2. Token Revocation
- Refresh tokens stored in database
- Can be revoked immediately (logout, security breach)
- Access tokens can't be revoked but expire quickly

### 3. Brute Force Protection
- Rate limiting prevents password guessing
- Exponential backoff slows down attackers
- IP-based limits prevent distributed attacks

### 4. Audit Trail
- All login attempts logged with IP and user-agent
- Can detect suspicious patterns
- Useful for security investigations

## Monitoring

### Check Recent Failed Attempts

```rust
use crate::services::LoginRateLimiter;

// Get last 100 failed attempts
let attempts = LoginRateLimiter::get_recent_failed_attempts(&db, 100).await?;

for attempt in attempts {
    println!("Failed login: {} from {} at {}", 
        attempt.email, 
        attempt.ip_address.unwrap_or_default(),
        attempt.attempted_at
    );
}
```

### Cleanup Old Attempts

```rust
// Run periodically (e.g., daily cron job)
let deleted = LoginRateLimiter::cleanup_old_attempts(&db).await?;
println!("Cleaned up {} old login attempts", deleted);
```

## Migration Steps

### 1. Run Migrations

```bash
cd backend
cargo run  # Migrations run automatically on startup
```

Or manually:
```bash
sqlx migrate run
```

### 2. Update Frontend

- Update login/register response handling
- Implement token refresh logic
- Add proactive refresh before expiry
- Handle rate limit errors (429)

### 3. Test

```bash
# Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test refresh
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJhbGc..."}'

# Test rate limiting (try 6 times with wrong password)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo ""
done
```

## Configuration

### Token Lifetimes

**Access Token:** 1 hour (hardcoded in `auth.rs`)
```rust
Self::generate_token(&user, jwt_secret, 1)?; // 1 hour
```

**Refresh Token:** 7 days (hardcoded in `auth.rs`)
```rust
Self::generate_refresh_token(user.id, session_id, jwt_secret, 7)?; // 7 days
```

To change, modify the numbers in `backend/src/services/auth.rs`.

### Rate Limit Thresholds

**Email limit:** 5 attempts in 15 minutes
**IP limit:** 10 attempts in 15 minutes

To change, modify `backend/src/services/login_rate_limiter.rs`:
```rust
if email_attempts >= 5 {  // Change this number
    // ...
}

if ip_attempts >= 10 {  // Change this number
    // ...
}
```

## Troubleshooting

### "Token expired" errors

**Cause:** Access token expired (after 1 hour)
**Solution:** Frontend should automatically refresh using refresh token

### "Invalid token" on refresh

**Cause:** Refresh token expired (after 7 days) or revoked
**Solution:** User needs to login again

### "Too many login attempts"

**Cause:** Rate limit exceeded
**Solution:** Wait for retry-after seconds, or clear attempts:
```sql
DELETE FROM login_attempts WHERE email = 'user@example.com';
```

### Refresh token not working

**Check:**
1. Refresh token exists in database
2. Refresh token not expired
3. Session still exists
4. User still exists

```sql
SELECT * FROM sessions WHERE refresh_token = 'token_here';
```

## Best Practices

1. **Always use HTTPS in production** - tokens sent in plain text over HTTP can be intercepted

2. **Store tokens securely** - use httpOnly cookies or secure localStorage

3. **Implement token refresh** - don't wait for 401 errors, refresh proactively

4. **Handle rate limits gracefully** - show user-friendly error messages

5. **Monitor failed attempts** - set up alerts for suspicious patterns

6. **Rotate refresh tokens** - consider rotating refresh token on each use (not implemented yet)

7. **Implement logout** - delete session from database to revoke refresh token

## Future Improvements

1. **Refresh Token Rotation** - Issue new refresh token on each refresh
2. **Device Management** - Track and manage sessions per device
3. **Suspicious Activity Detection** - ML-based anomaly detection
4. **2FA Support** - Two-factor authentication
5. **Session Limits** - Max N concurrent sessions per user
6. **Geographic Restrictions** - Block logins from unexpected locations

## References

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [JWT Best Practices RFC 8725](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
