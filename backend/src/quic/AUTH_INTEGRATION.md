# QUIC Authentication Integration

## Overview

This document describes the authentication integration for QUIC connections, which reuses the existing JWT validation logic from the WebSocket handler.

## Implementation

### Components

1. **QuicAuthenticator** (`backend/src/quic/auth.rs`)
   - Handles JWT token verification for QUIC connections
   - Reuses `AuthService::verify_token()` from WebSocket authentication
   - Reads authentication requests from QUIC streams
   - Sends authentication responses back to clients

2. **QuicServer Integration** (`backend/src/quic/server.rs`)
   - Added `set_jwt_secret()` method to configure JWT secret
   - Added `set_connection_manager()` method to configure connection tracking
   - Added `authenticate_and_register_connection()` method to authenticate and register connections

3. **Connection State** (`backend/src/quic/connection_manager.rs`)
   - `QuicConnection` stores authenticated user ID via `set_user_id()`
   - Connection manager tracks user-to-connection mappings

## Authentication Flow

```
Client                          Server
  |                               |
  |--- QUIC Connection --------->|
  |                               |
  |<-- Accept Bi Stream ---------|
  |                               |
  |--- AuthRequest (JWT) ------->|
  |                               | Verify JWT using AuthService
  |                               | Parse user_id from claims
  |                               | Create QuicConnection
  |                               | Set user_id on connection
  |                               | Register with ConnectionManager
  |<-- AuthResponse (Success) ---|
  |                               |
  |--- Application Messages ---->|
  |<-- Application Messages -----|
```

## Message Format

### AuthRequest
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### AuthResponse (Success)
```json
{
  "type": "success",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "user_name": "John Doe"
}
```

### AuthResponse (Error)
```json
{
  "type": "error",
  "code": "INVALID_TOKEN",
  "message": "Token has expired"
}
```

## Usage Example

```rust
use std::sync::Arc;
use chat_backend::quic::{QuicServer, QuicServerConfig, ConnectionManager};

async fn setup_quic_server(jwt_secret: String) -> Result<(), Box<dyn std::error::Error>> {
    let config = QuicServerConfig::default();
    let mut server = QuicServer::new(config);
    
    // Configure authentication (same JWT secret as WebSocket)
    server.set_jwt_secret(jwt_secret);
    
    // Configure connection manager
    let connection_manager = Arc::new(ConnectionManager::new());
    server.set_connection_manager(connection_manager);
    
    // Initialize and start server
    server.initialize().await?;
    server.start().await?;
    
    // Accept and authenticate connections
    loop {
        let connection = server.accept().await?;
        let (conn_id, user_id, user_name) = 
            server.authenticate_and_register_connection(connection).await?;
        
        println!("Authenticated: {} ({}) - connection_id: {}", 
                 user_name, user_id, conn_id);
        
        // Handle authenticated connection...
    }
}
```

## Requirements Satisfied

- **Requirement 1.3**: Authenticate QUIC connections on establishment using JWT tokens
- **Requirement 7.3**: Support the same authentication tokens as WebSocket connections
- **Requirement 1.3**: Store authenticated user ID in connection state

## Testing

All authentication tests pass:
- `test_auth_request_serialization` - Validates request format
- `test_auth_response_success_serialization` - Validates success response
- `test_auth_response_error_serialization` - Validates error response
- `test_authenticator_new` - Validates authenticator creation

## Security Considerations

1. **JWT Validation**: Uses the same `AuthService::verify_token()` as WebSocket, ensuring consistent security
2. **Token Expiration**: Expired tokens are rejected with `TOKEN_EXPIRED` error
3. **Invalid Tokens**: Malformed tokens are rejected with `INVALID_TOKEN` error
4. **Connection Closure**: Failed authentication results in immediate connection closure
5. **Size Limits**: Authentication requests are limited to 4KB to prevent DoS attacks

## Next Steps

- Task 5: Implement stream management for different message types
- Task 6: Implement message routing to existing handlers
- Task 7: Implement connection migration support
