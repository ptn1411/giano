use crate::services::AuthService;
use quinn::{RecvStream, SendStream};
use serde::{Deserialize, Serialize};
use std::io;
use thiserror::Error;
use uuid::Uuid;

/// QUIC authentication errors
#[derive(Debug, Error)]
pub enum QuicAuthError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),

    #[error("Invalid token")]
    InvalidToken,

    #[error("Token expired")]
    TokenExpired,

    #[error("Missing authentication")]
    MissingAuth,

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Stream error: {0}")]
    Stream(String),

    #[error("Invalid user ID")]
    InvalidUserId,
}

/// Authentication request message sent by client
#[derive(Debug, Serialize, Deserialize)]
pub struct AuthRequest {
    /// JWT token
    pub token: String,
}

/// Authentication response message sent by server
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AuthResponse {
    /// Authentication successful
    #[serde(rename = "success")]
    Success {
        user_id: String,
        user_name: String,
    },
    /// Authentication failed
    #[serde(rename = "error")]
    Error { code: String, message: String },
}

/// QUIC authentication handler
///
/// # Requirements
/// - 1.3: Authenticate QUIC connections on establishment
/// - 7.3: Support the same authentication tokens as WebSocket connections
pub struct QuicAuthenticator {
    /// JWT secret for token verification
    jwt_secret: String,
}

impl QuicAuthenticator {
    /// Create a new QUIC authenticator
    pub fn new(jwt_secret: String) -> Self {
        Self { jwt_secret }
    }

    /// Authenticate a QUIC connection by reading auth request from stream
    ///
    /// # Requirements
    /// - 1.3: Authenticate QUIC connections on establishment
    /// - 7.3: Reuse existing JWT validation logic
    ///
    /// # Arguments
    /// * `recv_stream` - Stream to read authentication request from
    /// * `send_stream` - Stream to send authentication response to
    ///
    /// # Returns
    /// * `Ok((user_id, user_name))` - Authentication successful
    /// * `Err(QuicAuthError)` - Authentication failed
    pub async fn authenticate_connection(
        &self,
        mut recv_stream: RecvStream,
        mut send_stream: SendStream,
    ) -> Result<(Uuid, String), QuicAuthError> {
        // Read authentication request from stream
        let auth_request = self.read_auth_request(&mut recv_stream).await?;

        // Verify JWT token using existing AuthService
        match AuthService::verify_token(&auth_request.token, &self.jwt_secret) {
            Ok(claims) => {
                // Parse user ID from claims
                let user_id = Uuid::parse_str(&claims.sub)
                    .map_err(|_| QuicAuthError::InvalidUserId)?;

                let user_name = claims.name.clone();

                // Send success response
                let response = AuthResponse::Success {
                    user_id: user_id.to_string(),
                    user_name: user_name.clone(),
                };

                self.send_auth_response(&mut send_stream, &response).await?;

                tracing::info!(
                    "QUIC authentication successful: user_id={}, user_name={}",
                    user_id,
                    user_name
                );

                Ok((user_id, user_name))
            }
            Err(e) => {
                // Send error response
                let (code, message) = match e {
                    crate::error::AppError::TokenExpired => {
                        ("TOKEN_EXPIRED", "Token has expired")
                    }
                    crate::error::AppError::InvalidToken => {
                        ("INVALID_TOKEN", "Invalid or malformed token")
                    }
                    _ => ("AUTH_ERROR", "Authentication failed"),
                };

                let response = AuthResponse::Error {
                    code: code.to_string(),
                    message: message.to_string(),
                };

                self.send_auth_response(&mut send_stream, &response).await?;

                tracing::warn!("QUIC authentication failed: {}", message);

                Err(QuicAuthError::InvalidToken)
            }
        }
    }

    /// Authenticate using a token string directly (for testing or alternative flows)
    ///
    /// # Requirements
    /// - 1.3: Authenticate QUIC connections on establishment
    /// - 7.3: Reuse existing JWT validation logic
    pub fn authenticate_token(&self, token: &str) -> Result<(Uuid, String), QuicAuthError> {
        // Verify JWT token using existing AuthService
        let claims = AuthService::verify_token(token, &self.jwt_secret)
            .map_err(|_| QuicAuthError::InvalidToken)?;

        // Parse user ID from claims
        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| QuicAuthError::InvalidUserId)?;

        let user_name = claims.name.clone();

        Ok((user_id, user_name))
    }

    /// Read authentication request from stream
    async fn read_auth_request(
        &self,
        recv_stream: &mut RecvStream,
    ) -> Result<AuthRequest, QuicAuthError> {
        // Read length prefix (4 bytes)
        let mut len_buf = [0u8; 4];
        recv_stream
            .read_exact(&mut len_buf)
            .await
            .map_err(|e| QuicAuthError::Stream(e.to_string()))?;

        let len = u32::from_be_bytes(len_buf) as usize;

        // Validate length (max 4KB for auth request)
        if len > 4096 {
            return Err(QuicAuthError::Stream(format!(
                "Auth request too large: {} bytes",
                len
            )));
        }

        // Read JSON data
        let mut data = vec![0u8; len];
        recv_stream
            .read_exact(&mut data)
            .await
            .map_err(|e| QuicAuthError::Stream(e.to_string()))?;

        // Deserialize JSON
        let auth_request: AuthRequest = serde_json::from_slice(&data)?;

        Ok(auth_request)
    }

    /// Send authentication response to stream
    async fn send_auth_response(
        &self,
        send_stream: &mut SendStream,
        response: &AuthResponse,
    ) -> Result<(), QuicAuthError> {
        // Serialize response to JSON
        let json = serde_json::to_vec(response)?;

        // Write length prefix (4 bytes)
        let len = json.len() as u32;
        send_stream
            .write_all(&len.to_be_bytes())
            .await
            .map_err(|e| QuicAuthError::Stream(e.to_string()))?;

        // Write JSON data
        send_stream
            .write_all(&json)
            .await
            .map_err(|e| QuicAuthError::Stream(e.to_string()))?;

        // Finish the stream
        send_stream
            .finish()
            .map_err(|e| QuicAuthError::Stream(e.to_string()))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_request_serialization() {
        let request = AuthRequest {
            token: "test_token".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("test_token"));

        let deserialized: AuthRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.token, "test_token");
    }

    #[test]
    fn test_auth_response_success_serialization() {
        let response = AuthResponse::Success {
            user_id: "123e4567-e89b-12d3-a456-426614174000".to_string(),
            user_name: "Test User".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("success"));
        assert!(json.contains("Test User"));

        let deserialized: AuthResponse = serde_json::from_str(&json).unwrap();
        match deserialized {
            AuthResponse::Success { user_id, user_name } => {
                assert_eq!(user_id, "123e4567-e89b-12d3-a456-426614174000");
                assert_eq!(user_name, "Test User");
            }
            _ => panic!("Expected Success variant"),
        }
    }

    #[test]
    fn test_auth_response_error_serialization() {
        let response = AuthResponse::Error {
            code: "INVALID_TOKEN".to_string(),
            message: "Token is invalid".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("error"));
        assert!(json.contains("INVALID_TOKEN"));

        let deserialized: AuthResponse = serde_json::from_str(&json).unwrap();
        match deserialized {
            AuthResponse::Error { code, message } => {
                assert_eq!(code, "INVALID_TOKEN");
                assert_eq!(message, "Token is invalid");
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[test]
    fn test_authenticator_new() {
        let authenticator = QuicAuthenticator::new("test_secret".to_string());
        assert_eq!(authenticator.jwt_secret, "test_secret");
    }
}
