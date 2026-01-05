# QUIC Transport API Documentation

## Overview

This document provides comprehensive API documentation for the QUIC transport feature, including endpoints, transport selection behavior, configuration options, and integration guidelines.

## Table of Contents

1. [Transport Protocols](#transport-protocols)
2. [QUIC Endpoints](#quic-endpoints)
3. [Transport Selection Behavior](#transport-selection-behavior)
4. [Configuration Options](#configuration-options)
5. [Message Format](#message-format)
6. [Authentication](#authentication)
7. [Error Handling](#error-handling)
8. [Client Integration](#client-integration)
9. [Monitoring and Metrics](#monitoring-and-metrics)

## Transport Protocols

The messaging system supports two transport protocols:

### QUIC (Preferred)
- **Protocol**: QUIC over UDP
- **Port**: 4433 (configurable)
- **URL Scheme**: `https://`
- **API**: WebTransport (browser), Quinn (server)
- **Features**: 
  - Lower latency
  - Connection migration
  - Stream multiplexing
  - Better performance on lossy networks

### WebSocket (Fallback)
- **Protocol**: WebSocket over TCP
- **Port**: 8080 (configurable)
- **URL Scheme**: `wss://`
- **API**: WebSocket API
- **Features**:
  - Universal browser support
  - Works through most firewalls
  - Reliable fallback option

## QUIC Endpoints

### Connection Endpoint

**Endpoint**: `https://your-domain.com:4433`

**Protocol**: WebTransport (QUIC)

**Description**: Main QUIC connection endpoint for establishing WebTransport connections.

**Connection Flow**:
```javascript
// Client-side connection
const transport = new WebTransport('https://your-domain.com:4433');
await transport.ready;
```

**Connection Parameters**:
- **Server Name Indication (SNI)**: Must match certificate domain
- **ALPN**: `h3` (HTTP/3)
- **TLS Version**: 1.3 (required)

**Response**:
- **Success**: WebTransport connection established
- **Failure**: Connection rejected with error code

### Authentication Stream

**Stream Type**: Bidirectional, Stream ID 0

**Description**: First stream opened after connection establishment for authentication.

**Request Format**:
```json
{
  "type": "auth_request",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "timestamp": 1704067200000
}
```

**Response Format**:
```json
{
  "type": "auth_response",
  "success": true,
  "user_id": "user-123",
  "connection_id": "conn-456"
}
```

**Error Response**:
```json
{
  "type": "auth_response",
  "success": false,
  "error": "invalid_token",
  "message": "JWT token is invalid or expired"
}
```

### Message Streams

**Stream Type**: Bidirectional, Stream IDs 1-99

**Description**: Streams for sending and receiving chat messages.

**Stream Allocation**:
- Stream 1-99: Chat messages (round-robin allocation)
- One stream per active conversation
- Streams are reused after completion

**Message Format**:
```json
{
  "type": "chat_message",
  "id": "msg-789",
  "chat_id": "chat-123",
  "sender_id": "user-123",
  "content": "Hello, world!",
  "timestamp": 1704067200000,
  "metadata": {
    "reply_to": null,
    "attachments": []
  }
}
```

**Acknowledgment**:
```json
{
  "type": "message_ack",
  "message_id": "msg-789",
  "status": "delivered",
  "timestamp": 1704067201000
}
```

### File Transfer Streams

**Stream Type**: Bidirectional, Stream IDs 100-199

**Description**: Dedicated streams for file uploads and downloads.

**Upload Initiation**:
```json
{
  "type": "file_upload_start",
  "file_id": "file-123",
  "filename": "document.pdf",
  "size": 1048576,
  "mime_type": "application/pdf",
  "chat_id": "chat-123"
}
```

**File Chunk**:
```json
{
  "type": "file_chunk",
  "file_id": "file-123",
  "chunk_index": 0,
  "data": "<base64-encoded-data>",
  "is_final": false
}
```

**Upload Complete**:
```json
{
  "type": "file_upload_complete",
  "file_id": "file-123",
  "url": "https://your-domain.com/uploads/file-123.pdf",
  "checksum": "sha256:abc123..."
}
```

### Bot Command Streams

**Stream Type**: Bidirectional, Stream IDs 200+

**Description**: Streams for bot commands and responses.

**Command Format**:
```json
{
  "type": "bot_command",
  "command": "/start",
  "args": [],
  "chat_id": "chat-123",
  "user_id": "user-123"
}
```

**Response Format**:
```json
{
  "type": "bot_response",
  "command": "/start",
  "response": "Welcome! I'm a bot.",
  "keyboard": {
    "type": "inline",
    "buttons": [
      [{"text": "Help", "callback_data": "help"}]
    ]
  }
}
```

### Control Messages

**Stream Type**: Bidirectional, Stream ID 0

**Description**: Control messages for presence, typing indicators, and keep-alive.

**Typing Indicator**:
```json
{
  "type": "typing_start",
  "chat_id": "chat-123",
  "user_id": "user-123"
}
```

**Presence Update**:
```json
{
  "type": "user_online",
  "user_id": "user-123",
  "last_seen": 1704067200000
}
```

**Keep-Alive (Ping/Pong)**:
```json
{
  "type": "ping",
  "timestamp": 1704067200000
}
```

```json
{
  "type": "pong",
  "timestamp": 1704067200000
}
```

## Transport Selection Behavior

### Client-Side Selection Algorithm

The client automatically selects the best transport protocol:

```
1. Check WebTransport Support
   ├─ Supported → Attempt QUIC
   │  ├─ Success (< 5s) → Use QUIC
   │  └─ Failure/Timeout → Fallback to WebSocket
   └─ Not Supported → Use WebSocket

2. Check Transport Preference Cache
   ├─ Cache Hit (QUIC failed recently)
   │  ├─ Use WebSocket
   │  └─ Retry QUIC periodically (every 5 minutes)
   └─ Cache Miss → Attempt QUIC first
```

### Feature Detection

**WebTransport Support**:
```javascript
const supportsWebTransport = 'WebTransport' in window;
```

**Browser Compatibility**:
- Chrome/Edge 97+: ✅ Full support
- Safari: ❌ Not supported (uses WebSocket)
- Firefox: ⚠️ Behind flag (uses WebSocket by default)
- Opera 83+: ✅ Full support

### Fallback Triggers

QUIC fallback to WebSocket occurs when:

1. **Connection Timeout**: No response within 5 seconds
2. **Handshake Failure**: TLS or QUIC handshake fails
3. **Certificate Error**: Invalid or expired certificate
4. **Network Block**: UDP port 4433 is blocked
5. **Browser Unsupported**: WebTransport API not available

### Transport Switching

**Automatic Switching**:
- QUIC → WebSocket: Automatic on failure
- WebSocket → QUIC: Manual or periodic retry

**Seamless Transition**:
- Messages queued during switch
- No message loss or duplication
- Connection state preserved
- User experience uninterrupted

### Preference Caching

**Cache Key**: `transport_preference`

**Cache Duration**: 5 minutes (configurable)

**Cache Values**:
- `quic`: Prefer QUIC
- `websocket`: Prefer WebSocket (QUIC failed recently)

**Cache Invalidation**:
- Manual: User clears browser data
- Automatic: After cache duration expires
- Successful QUIC: Updates cache to prefer QUIC

## Configuration Options

### Backend Configuration

#### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `QUIC_ENABLED` | boolean | `true` | Enable/disable QUIC transport |
| `QUIC_BIND_ADDRESS` | string | `0.0.0.0` | IP address to bind QUIC server |
| `QUIC_PORT` | integer | `4433` | UDP port for QUIC connections |
| `QUIC_CERT_PATH` | string | `./certs/server.crt` | Path to TLS certificate |
| `QUIC_KEY_PATH` | string | `./certs/server.key` | Path to TLS private key |
| `QUIC_MAX_CONNECTIONS` | integer | `10000` | Maximum concurrent connections |
| `QUIC_MAX_STREAMS_PER_CONNECTION` | integer | `100` | Maximum streams per connection |
| `QUIC_IDLE_TIMEOUT_MS` | integer | `30000` | Connection idle timeout (ms) |
| `QUIC_KEEP_ALIVE_INTERVAL_MS` | integer | `5000` | Keep-alive interval (ms) |

#### Configuration File

**Location**: `backend/.env`

**Example**:
```bash
QUIC_ENABLED=true
QUIC_BIND_ADDRESS=0.0.0.0
QUIC_PORT=4433
QUIC_CERT_PATH=./certs/server.crt
QUIC_KEY_PATH=./certs/server.key
QUIC_MAX_CONNECTIONS=10000
QUIC_MAX_STREAMS_PER_CONNECTION=100
QUIC_IDLE_TIMEOUT_MS=30000
QUIC_KEEP_ALIVE_INTERVAL_MS=5000
```

#### Runtime Configuration

Configuration can be updated without code changes:

1. Edit `.env` file
2. Restart service: `systemctl restart messaging-app`
3. New connections use updated configuration

### Frontend Configuration

#### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_QUIC_ENABLED` | boolean | `true` | Enable/disable QUIC on client |
| `VITE_QUIC_URL` | string | - | QUIC server URL (required) |
| `VITE_QUIC_TIMEOUT` | integer | `5000` | Connection timeout (ms) |
| `VITE_QUIC_FALLBACK_ENABLED` | boolean | `true` | Enable WebSocket fallback |
| `VITE_WEBSOCKET_URL` | string | - | WebSocket fallback URL |
| `VITE_QUIC_RETRY_INTERVAL` | integer | `300000` | Retry interval (ms) |

#### Configuration File

**Location**: `frontend/.env.production`

**Example**:
```bash
VITE_QUIC_ENABLED=true
VITE_QUIC_URL=https://your-domain.com:4433
VITE_QUIC_TIMEOUT=5000
VITE_QUIC_FALLBACK_ENABLED=true
VITE_WEBSOCKET_URL=wss://your-domain.com/ws
VITE_QUIC_RETRY_INTERVAL=300000
```

#### Build-Time Configuration

Frontend configuration is embedded at build time:

```bash
# Build with production config
npm run build

# Configuration is read from .env.production
```

## Message Format

### Base Message Structure

All messages follow this structure:

```typescript
interface TransportMessage {
  type: MessageType;           // Message type identifier
  id: string;                  // Unique message ID (UUID)
  timestamp: number;           // Unix timestamp (milliseconds)
  payload: unknown;            // Type-specific payload
}
```

### Message Types

#### Authentication Messages

**AUTH_REQUEST**:
```json
{
  "type": "auth_request",
  "id": "msg-001",
  "timestamp": 1704067200000,
  "payload": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**AUTH_RESPONSE**:
```json
{
  "type": "auth_response",
  "id": "msg-002",
  "timestamp": 1704067201000,
  "payload": {
    "success": true,
    "user_id": "user-123",
    "connection_id": "conn-456"
  }
}
```

#### Chat Messages

**CHAT_MESSAGE**:
```json
{
  "type": "chat_message",
  "id": "msg-003",
  "timestamp": 1704067202000,
  "payload": {
    "chat_id": "chat-123",
    "sender_id": "user-123",
    "content": "Hello!",
    "reply_to": null,
    "attachments": []
  }
}
```

**MESSAGE_ACK**:
```json
{
  "type": "message_ack",
  "id": "msg-004",
  "timestamp": 1704067203000,
  "payload": {
    "message_id": "msg-003",
    "status": "delivered"
  }
}
```

#### Presence Messages

**TYPING_START**:
```json
{
  "type": "typing_start",
  "id": "msg-005",
  "timestamp": 1704067204000,
  "payload": {
    "chat_id": "chat-123",
    "user_id": "user-123"
  }
}
```

**USER_ONLINE**:
```json
{
  "type": "user_online",
  "id": "msg-006",
  "timestamp": 1704067205000,
  "payload": {
    "user_id": "user-123",
    "last_seen": 1704067205000
  }
}
```

#### Control Messages

**PING**:
```json
{
  "type": "ping",
  "id": "msg-007",
  "timestamp": 1704067206000,
  "payload": {}
}
```

**PONG**:
```json
{
  "type": "pong",
  "id": "msg-008",
  "timestamp": 1704067207000,
  "payload": {}
}
```

**ERROR**:
```json
{
  "type": "error",
  "id": "msg-009",
  "timestamp": 1704067208000,
  "payload": {
    "code": "invalid_message",
    "message": "Message format is invalid",
    "details": {}
  }
}
```

### Serialization

**Format**: JSON (UTF-8 encoded)

**Encoding**:
```javascript
// Client-side
const message = { type: 'chat_message', ... };
const encoded = new TextEncoder().encode(JSON.stringify(message));
```

**Decoding**:
```javascript
// Client-side
const decoded = new TextDecoder().decode(data);
const message = JSON.parse(decoded);
```

**Server-side** (Rust):
```rust
// Encoding
let message = Message { ... };
let json = serde_json::to_string(&message)?;
let bytes = json.as_bytes();

// Decoding
let json = String::from_utf8(bytes)?;
let message: Message = serde_json::from_str(&json)?;
```

## Authentication

### JWT Token Authentication

Both QUIC and WebSocket use the same JWT authentication:

**Token Format**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6MTcwNDA3MDgwMH0.signature
```

**Token Claims**:
```json
{
  "sub": "user-123",        // User ID
  "exp": 1704070800,        // Expiration timestamp
  "iat": 1704067200,        // Issued at timestamp
  "jti": "token-456"        // Token ID
}
```

### Authentication Flow

1. **Client obtains JWT** from login endpoint
2. **Client connects** via QUIC or WebSocket
3. **Client sends** `auth_request` with JWT token
4. **Server validates** JWT signature and expiration
5. **Server responds** with `auth_response`
6. **Connection authenticated** and ready for messages

### Authentication Errors

| Error Code | Description | Action |
|------------|-------------|--------|
| `invalid_token` | Token is malformed or invalid | Re-authenticate |
| `expired_token` | Token has expired | Refresh token |
| `revoked_token` | Token has been revoked | Re-authenticate |
| `missing_token` | No token provided | Provide token |

### Token Refresh

**Endpoint**: `POST /api/auth/refresh`

**Request**:
```json
{
  "refresh_token": "refresh-token-here"
}
```

**Response**:
```json
{
  "access_token": "new-jwt-token",
  "expires_in": 3600
}
```

## Error Handling

### Error Response Format

```json
{
  "type": "error",
  "id": "msg-error-001",
  "timestamp": 1704067200000,
  "payload": {
    "code": "error_code",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Error Codes

#### Connection Errors

| Code | Description | Recovery |
|------|-------------|----------|
| `connection_timeout` | Connection timed out | Retry connection |
| `handshake_failed` | TLS handshake failed | Check certificates |
| `auth_failed` | Authentication failed | Re-authenticate |
| `connection_closed` | Connection closed by server | Reconnect |

#### Message Errors

| Code | Description | Recovery |
|------|-------------|----------|
| `invalid_message` | Message format invalid | Fix message format |
| `message_too_large` | Message exceeds size limit | Reduce message size |
| `rate_limited` | Too many messages | Slow down sending |
| `unauthorized` | Not authorized for action | Check permissions |

#### Stream Errors

| Code | Description | Recovery |
|------|-------------|----------|
| `stream_closed` | Stream was closed | Open new stream |
| `stream_limit` | Too many streams | Wait for streams to close |
| `stream_error` | Stream encountered error | Retry on new stream |

### Error Recovery

**Automatic Recovery**:
- Connection errors → Automatic reconnection
- Stream errors → Retry on new stream
- Rate limiting → Exponential backoff

**Manual Recovery**:
- Authentication errors → User must re-login
- Authorization errors → User must request permissions
- Configuration errors → Admin must fix configuration

## Client Integration

### JavaScript/TypeScript Integration

#### Installation

```bash
npm install @your-org/messaging-client
```

#### Basic Usage

```typescript
import { TransportManager } from '@your-org/messaging-client';

// Initialize transport manager
const transport = new TransportManager({
  quicUrl: 'https://your-domain.com:4433',
  websocketUrl: 'wss://your-domain.com/ws',
  quicTimeout: 5000,
  fallbackEnabled: true,
});

// Connect
await transport.connect();

// Listen for messages
transport.on('message', (message) => {
  console.log('Received:', message);
});

// Send message
await transport.send({
  type: 'chat_message',
  payload: {
    chat_id: 'chat-123',
    content: 'Hello!',
  },
});

// Disconnect
await transport.disconnect();
```

#### Advanced Usage

```typescript
// Check transport type
const transportType = transport.getTransportType();
console.log('Connected via:', transportType); // 'quic' or 'websocket'

// Monitor connection state
transport.on('connected', (type) => {
  console.log('Connected via', type);
});

transport.on('disconnected', (reason) => {
  console.log('Disconnected:', reason);
});

transport.on('error', (error) => {
  console.error('Transport error:', error);
});

// Force reconnection
await transport.reconnect();

// Get connection metrics
const metrics = transport.getMetrics();
console.log('Latency:', metrics.latency);
console.log('Throughput:', metrics.throughput);
```

### React Integration

```typescript
import { useTransport } from '@your-org/messaging-client/react';

function ChatComponent() {
  const { transport, connected, transportType } = useTransport({
    quicUrl: 'https://your-domain.com:4433',
    websocketUrl: 'wss://your-domain.com/ws',
  });

  const sendMessage = async (content: string) => {
    await transport.send({
      type: 'chat_message',
      payload: { content },
    });
  };

  return (
    <div>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      <div>Transport: {transportType}</div>
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

### Other Languages

#### Python

```python
from messaging_client import TransportManager

# Initialize
transport = TransportManager(
    quic_url='https://your-domain.com:4433',
    websocket_url='wss://your-domain.com/ws'
)

# Connect
await transport.connect()

# Send message
await transport.send({
    'type': 'chat_message',
    'payload': {'content': 'Hello!'}
})
```

#### Go

```go
import "github.com/your-org/messaging-client-go"

// Initialize
transport := messaging.NewTransportManager(messaging.Config{
    QuicURL: "https://your-domain.com:4433",
    WebSocketURL: "wss://your-domain.com/ws",
})

// Connect
err := transport.Connect()

// Send message
err = transport.Send(messaging.Message{
    Type: "chat_message",
    Payload: map[string]interface{}{
        "content": "Hello!",
    },
})
```

## Monitoring and Metrics

### Metrics Endpoint

**Endpoint**: `GET /api/metrics/quic`

**Authentication**: Optional (configure based on security requirements)

**Response Format**:
```json
{
  "active_connections": {
    "quic": 1250,
    "websocket": 750,
    "total": 2000
  },
  "connection_ratio": {
    "quic_percentage": 62.5,
    "websocket_percentage": 37.5
  },
  "throughput": {
    "messages_per_second": 15000,
    "bytes_per_second": 2500000
  },
  "latency": {
    "p50_ms": 25,
    "p95_ms": 50,
    "p99_ms": 100,
    "max_ms": 250
  },
  "errors": {
    "connection_failures": 5,
    "migration_failures": 2,
    "timeout_errors": 3,
    "auth_failures": 1
  },
  "streams": {
    "active_streams": 5000,
    "total_streams_opened": 50000,
    "total_streams_closed": 45000
  },
  "uptime_seconds": 86400,
  "timestamp": 1704067200000
}
```

### Health Check Endpoint

**Endpoint**: `GET /api/health/quic`

**Response Format**:
```json
{
  "status": "healthy",
  "quic_enabled": true,
  "active_connections": 1250,
  "uptime_seconds": 86400,
  "checks": {
    "port_listening": true,
    "certificate_valid": true,
    "database_connected": true
  }
}
```

**Status Values**:
- `healthy`: All systems operational
- `degraded`: Some issues but operational
- `unhealthy`: Critical issues, service impaired

### Prometheus Metrics

**Endpoint**: `GET /metrics`

**Format**: Prometheus exposition format

**Example Metrics**:
```
# HELP quic_active_connections Number of active QUIC connections
# TYPE quic_active_connections gauge
quic_active_connections 1250

# HELP quic_messages_total Total messages sent/received
# TYPE quic_messages_total counter
quic_messages_total{direction="sent"} 1000000
quic_messages_total{direction="received"} 950000

# HELP quic_latency_seconds Message latency
# TYPE quic_latency_seconds histogram
quic_latency_seconds_bucket{le="0.01"} 8500
quic_latency_seconds_bucket{le="0.05"} 9500
quic_latency_seconds_bucket{le="0.1"} 9900
quic_latency_seconds_bucket{le="+Inf"} 10000
```

## Versioning

### API Version

**Current Version**: `v1`

**Version Header**: `X-API-Version: v1`

### Backward Compatibility

- Message format is backward compatible
- New fields added with default values
- Deprecated fields marked but not removed
- Breaking changes require new API version

### Deprecation Policy

1. **Announcement**: 3 months before deprecation
2. **Warning**: Logs warning when deprecated feature used
3. **Removal**: After 6 months minimum

## Rate Limiting

### Connection Rate Limits

- **New connections**: 10 per minute per IP
- **Authentication attempts**: 5 per minute per IP
- **Failed authentications**: 3 per hour per IP

### Message Rate Limits

- **Messages**: 100 per minute per user
- **File uploads**: 10 per hour per user
- **Bot commands**: 30 per minute per user

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067260
```

## Security

### TLS Requirements

- **Minimum Version**: TLS 1.3
- **Cipher Suites**: AEAD only (AES-GCM, ChaCha20-Poly1305)
- **Certificate**: Valid, not expired, matches domain

### Best Practices

1. **Always use HTTPS/WSS**: Never use unencrypted connections
2. **Validate certificates**: Don't skip certificate validation
3. **Rotate tokens**: Refresh JWT tokens regularly
4. **Rate limiting**: Implement client-side rate limiting
5. **Error handling**: Don't expose sensitive information in errors

## Support

### Documentation

- Deployment Guide: `QUIC_DEPLOYMENT_GUIDE.md`
- Troubleshooting: `QUIC_TROUBLESHOOTING_GUIDE.md`
- API Reference: This document

### Contact

- GitHub Issues: Report bugs and feature requests
- Email: support@your-domain.com
- Documentation: https://docs.your-domain.com

## Changelog

### Version 1.0.0 (2024-01-01)
- Initial QUIC transport implementation
- WebTransport API support
- Automatic fallback to WebSocket
- Stream multiplexing
- Connection migration support

### Future Versions

- **v1.1.0**: Enhanced metrics and monitoring
- **v1.2.0**: Multi-region support
- **v2.0.0**: HTTP/3 support for all endpoints
