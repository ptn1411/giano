# Testing Refresh Token & Rate Limiting

## Prerequisites

1. Start the backend server:
```bash
cd backend
cargo run
```

2. Make sure migrations have run (they run automatically on startup)

## Test 1: Register with Refresh Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }' | jq
```

**Expected Response:**
```json
{
  "session": {
    "user": {
      "id": "uuid",
      "name": "Test User",
      "avatar": "https://...",
      "status": "online",
      "is_bot": false
    },
    "token": "eyJhbGc...",
    "expiresAt": 1704398400000,
    "refreshToken": "eyJhbGc...",
    "refreshExpiresAt": 1704998400000
  }
}
```

**Save the tokens:**
```bash
# Save to variables
ACCESS_TOKEN="<token from response>"
REFRESH_TOKEN="<refreshToken from response>"
```

## Test 2: Use Access Token

```bash
curl -X GET http://localhost:3000/api/v1/chats \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

**Expected:** List of chats (or empty array)

## Test 3: Refresh Access Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }" | jq
```

**Expected Response:**
```json
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

## Test 4: Rate Limiting - Email Based

Try logging in with wrong password 6 times:

```bash
for i in {1..6}; do
  echo "Attempt $i:"
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "wrongpassword"
    }' | jq
  echo ""
  sleep 1
done
```

**Expected:**
- Attempts 1-5: `{"error": {"code": "INVALID_CREDENTIALS", ...}}`
- Attempt 6: `{"error": {"code": "LOGIN_RATE_LIMIT_EXCEEDED", "message": "Too many login attempts, retry after 60 seconds"}}`
- HTTP Status: 429

## Test 5: Rate Limiting - IP Based

Try from same IP with different emails:

```bash
for i in {1..11}; do
  echo "Attempt $i:"
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"user$i@example.com\",
      \"password\": \"wrongpassword\"
    }" | jq
  echo ""
  sleep 1
done
```

**Expected:**
- Attempts 1-10: `INVALID_CREDENTIALS`
- Attempt 11: `LOGIN_RATE_LIMIT_EXCEEDED`

## Test 6: Successful Login Clears Failed Attempts

```bash
# 1. Fail 3 times
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "wrong"
    }' | jq
done

# 2. Login successfully
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq

# 3. Try again - should work (failed attempts cleared)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq
```

**Expected:** All successful logins work

## Test 7: Invalid Refresh Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "invalid_token"
  }' | jq
```

**Expected:**
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid token"
  }
}
```
HTTP Status: 401

## Test 8: Expired Access Token (Manual)

1. Wait 1 hour for access token to expire, OR
2. Manually set expiry in database:

```sql
UPDATE sessions 
SET expires_at = NOW() - INTERVAL '1 hour' 
WHERE token = '<your_access_token>';
```

3. Try to use expired token:
```bash
curl -X GET http://localhost:3000/api/v1/chats \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

**Expected:**
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Token expired"
  }
}
```

4. Refresh and try again:
```bash
# Get new token
NEW_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" | jq -r '.session.token')

# Use new token
curl -X GET http://localhost:3000/api/v1/chats \
  -H "Authorization: Bearer $NEW_TOKEN" | jq
```

**Expected:** Success

## Test 9: Check Database

```sql
-- View sessions with refresh tokens
SELECT 
  id,
  user_id,
  expires_at,
  refresh_expires_at,
  created_at
FROM sessions
ORDER BY created_at DESC
LIMIT 5;

-- View login attempts
SELECT 
  email,
  ip_address,
  success,
  attempted_at,
  user_agent
FROM login_attempts
ORDER BY attempted_at DESC
LIMIT 10;

-- Count failed attempts per email
SELECT 
  email,
  COUNT(*) as failed_attempts
FROM login_attempts
WHERE success = FALSE
  AND attempted_at > NOW() - INTERVAL '15 minutes'
GROUP BY email
ORDER BY failed_attempts DESC;
```

## Test 10: Cleanup Old Attempts

```sql
-- Manual cleanup
SELECT cleanup_old_login_attempts();

-- Check result
SELECT COUNT(*) FROM login_attempts;
```

## Automated Test Script

Save as `test_auth.sh`:

```bash
#!/bin/bash

API_URL="http://localhost:3000/api/v1"

echo "=== Test 1: Register ==="
RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123",
    "name": "Test User"
  }')

echo $RESPONSE | jq

ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.session.token')
REFRESH_TOKEN=$(echo $RESPONSE | jq -r '.session.refreshToken')

echo ""
echo "=== Test 2: Use Access Token ==="
curl -s -X GET $API_URL/chats \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

echo ""
echo "=== Test 3: Refresh Token ==="
NEW_RESPONSE=$(curl -s -X POST $API_URL/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")

echo $NEW_RESPONSE | jq

NEW_ACCESS_TOKEN=$(echo $NEW_RESPONSE | jq -r '.session.token')

echo ""
echo "=== Test 4: Use New Access Token ==="
curl -s -X GET $API_URL/chats \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" | jq

echo ""
echo "=== Test 5: Rate Limiting ==="
for i in {1..6}; do
  echo "Attempt $i:"
  curl -s -X POST $API_URL/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "testuser@example.com",
      "password": "wrongpassword"
    }' | jq -c
  sleep 1
done

echo ""
echo "=== All tests completed ==="
```

Run:
```bash
chmod +x test_auth.sh
./test_auth.sh
```

## Expected Results Summary

| Test | Expected Result | Status |
|------|----------------|--------|
| Register | Returns access + refresh tokens | ✅ |
| Use access token | API call succeeds | ✅ |
| Refresh token | Returns new access token | ✅ |
| Email rate limit | Blocks after 5 attempts | ✅ |
| IP rate limit | Blocks after 10 attempts | ✅ |
| Successful login | Clears failed attempts | ✅ |
| Invalid refresh token | Returns 401 error | ✅ |
| Expired access token | Returns TOKEN_EXPIRED | ✅ |
| Database tracking | Records all attempts | ✅ |
| Cleanup | Removes old attempts | ✅ |

## Troubleshooting

### "Connection refused"
- Make sure backend is running: `cargo run`
- Check port: `netstat -an | grep 3000`

### "Database error"
- Run migrations: `sqlx migrate run`
- Check database connection in `.env`

### "Invalid token" on refresh
- Token might be expired (7 days)
- Check database: `SELECT * FROM sessions WHERE refresh_token = 'token';`

### Rate limit not working
- Check Redis connection (optional, uses database if Redis unavailable)
- Check database: `SELECT * FROM login_attempts;`

### Tokens not in response
- Check migrations ran successfully
- Check `sessions` table has `refresh_token` column

## Monitoring

### Watch login attempts in real-time

```sql
-- Terminal 1: Watch attempts
WATCH 1 'SELECT email, ip_address, success, attempted_at FROM login_attempts ORDER BY attempted_at DESC LIMIT 10;'

-- Terminal 2: Run tests
./test_auth.sh
```

### Check rate limit status

```sql
-- Failed attempts in last 15 minutes
SELECT 
  email,
  COUNT(*) as attempts,
  MAX(attempted_at) as last_attempt
FROM login_attempts
WHERE success = FALSE
  AND attempted_at > NOW() - INTERVAL '15 minutes'
GROUP BY email;
```

## Clean Up After Testing

```sql
-- Remove test user
DELETE FROM users WHERE email = 'testuser@example.com';

-- Clear login attempts
DELETE FROM login_attempts;

-- Clear sessions
DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users);
```
