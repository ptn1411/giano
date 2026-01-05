use std::sync::Arc;
use uuid::Uuid;
use thiserror::Error;

use crate::{
    AppState,
    ws::events::{ClientEvent, ServerEvent},
    ws::manager::WsManager,
};

use super::connection_manager::ConnectionId;

/// Message router errors
#[derive(Debug, Error)]
pub enum MessageRouterError {
    #[error("Failed to parse message: {0}")]
    ParseError(String),

    #[error("Failed to serialize response: {0}")]
    SerializeError(String),

    #[error("Handler error: {0}")]
    HandlerError(String),

    #[error("Connection not authenticated")]
    NotAuthenticated,

    #[error("Invalid message format")]
    InvalidFormat,
}

/// Message router that handles incoming messages from QUIC streams
///
/// # Requirements
/// - 1.5: Parse and route messages to appropriate handlers
/// - 6.1: Use same JSON format as WebSocket
/// - 6.2: Route to existing handlers
/// - 6.3: Support all message types
pub struct MessageRouter {
    state: Arc<AppState>,
    ws_manager: Arc<WsManager>,
}

impl MessageRouter {
    /// Create a new message router
    pub fn new(state: Arc<AppState>, ws_manager: Arc<WsManager>) -> Self {
        Self { state, ws_manager }
    }

    /// Route an incoming message from a QUIC connection
    ///
    /// # Requirements
    /// - 1.5: Parse and route messages to appropriate handlers
    /// - 6.1: Use same JSON format as WebSocket
    /// - 6.2: Route messages using existing handlers
    ///
    /// # Arguments
    /// * `data` - Raw message data from QUIC stream
    /// * `connection_id` - ID of the connection that sent the message
    /// * `user_id` - Authenticated user ID
    /// * `user_name` - Authenticated user name
    ///
    /// # Returns
    /// * `Ok(Option<Vec<u8>>)` - Optional response data to send back
    /// * `Err(MessageRouterError)` - Error if routing fails
    pub async fn route_message(
        &self,
        data: &[u8],
        _connection_id: ConnectionId,
        user_id: Uuid,
        user_name: &str,
    ) -> Result<Option<Vec<u8>>, MessageRouterError> {
        // Parse the message as UTF-8 JSON text (same format as WebSocket)
        let text = std::str::from_utf8(data)
            .map_err(|e| MessageRouterError::ParseError(format!("Invalid UTF-8: {}", e)))?;

        tracing::debug!("Routing QUIC message from user {}: {}", user_id, text);

        // Parse as ClientEvent (same as WebSocket)
        let event: ClientEvent = serde_json::from_str(text)
            .map_err(|e| MessageRouterError::ParseError(format!("Invalid JSON: {}", e)))?;

        // Handle the event using the same logic as WebSocket
        self.handle_client_event(event, user_id, user_name).await?;

        // Most events don't require a direct response (they broadcast to other clients)
        // Return None to indicate no response needed
        Ok(None)
    }

    /// Handle a client event (same logic as WebSocket handler)
    ///
    /// # Requirements
    /// - 6.2: Route messages to existing handlers
    /// - 6.3: Support all existing message types
    async fn handle_client_event(
        &self,
        event: ClientEvent,
        user_id: Uuid,
        user_name: &str,
    ) -> Result<(), MessageRouterError> {
        match event {
            ClientEvent::StartTyping { chat_id } => {
                self.handle_start_typing(chat_id, user_id, user_name).await
            }
            ClientEvent::StopTyping { chat_id } => {
                self.handle_stop_typing(chat_id, user_id, user_name).await
            }
            ClientEvent::JoinChat { chat_id } => {
                self.handle_join_chat(chat_id, user_id).await
            }
            ClientEvent::LeaveChat { chat_id } => {
                self.handle_leave_chat(chat_id, user_id).await
            }
            ClientEvent::Ping => {
                self.handle_ping(user_id).await
            }
            ClientEvent::InitiateCall {
                target_user_id,
                chat_id,
                call_type,
            } => {
                self.handle_initiate_call(user_id, user_name, target_user_id, chat_id, call_type)
                    .await
            }
            ClientEvent::AcceptCall { call_id } => {
                self.handle_accept_call(user_id, call_id).await
            }
            ClientEvent::DeclineCall { call_id } => {
                self.handle_decline_call(user_id, call_id).await
            }
            ClientEvent::EndCall { call_id } => {
                self.handle_end_call(user_id, call_id).await
            }
        }
    }

    /// Handle StartTyping event
    async fn handle_start_typing(
        &self,
        chat_id: Uuid,
        user_id: Uuid,
        user_name: &str,
    ) -> Result<(), MessageRouterError> {
        // Verify user is participant of the chat
        if !self.is_chat_participant(chat_id, user_id).await {
            return Ok(());
        }

        let typing_event = ServerEvent::Typing {
            chat_id,
            user_id,
            user_name: user_name.to_string(),
            is_typing: true,
        };

        self.ws_manager
            .broadcast_to_room(chat_id, typing_event, Some(user_id))
            .await;

        Ok(())
    }

    /// Handle StopTyping event
    async fn handle_stop_typing(
        &self,
        chat_id: Uuid,
        user_id: Uuid,
        user_name: &str,
    ) -> Result<(), MessageRouterError> {
        // Verify user is participant of the chat
        if !self.is_chat_participant(chat_id, user_id).await {
            return Ok(());
        }

        let typing_event = ServerEvent::Typing {
            chat_id,
            user_id,
            user_name: user_name.to_string(),
            is_typing: false,
        };

        self.ws_manager
            .broadcast_to_room(chat_id, typing_event, Some(user_id))
            .await;

        Ok(())
    }

    /// Handle JoinChat event
    async fn handle_join_chat(&self, chat_id: Uuid, user_id: Uuid) -> Result<(), MessageRouterError> {
        // Verify user is participant of the chat
        if !self.is_chat_participant(chat_id, user_id).await {
            return Ok(());
        }

        self.ws_manager.join_room(user_id, chat_id).await;
        Ok(())
    }

    /// Handle LeaveChat event
    async fn handle_leave_chat(&self, chat_id: Uuid, user_id: Uuid) -> Result<(), MessageRouterError> {
        self.ws_manager.leave_room(user_id, chat_id).await;
        Ok(())
    }

    /// Handle Ping event
    async fn handle_ping(&self, user_id: Uuid) -> Result<(), MessageRouterError> {
        tracing::debug!("Received ping from user {} via QUIC", user_id);
        Ok(())
    }

    /// Handle InitiateCall event
    async fn handle_initiate_call(
        &self,
        caller_id: Uuid,
        caller_name: &str,
        target_user_id: Uuid,
        chat_id: Uuid,
        call_type: String,
    ) -> Result<(), MessageRouterError> {
        // Validate call type
        if call_type != "voice" && call_type != "video" {
            let error = ServerEvent::Error {
                code: "INVALID_CALL_TYPE".to_string(),
                message: "Call type must be 'voice' or 'video'".to_string(),
            };
            self.ws_manager.send_to_user(caller_id, error).await;
            return Ok(());
        }

        // Validate that caller and target have an existing chat
        if !self.is_chat_participant(chat_id, caller_id).await {
            tracing::error!(
                "Caller is not participant of chat: caller_id={}, chat_id={}",
                caller_id,
                chat_id
            );
            let error = ServerEvent::Error {
                code: "NOT_CHAT_PARTICIPANT".to_string(),
                message: "You are not a participant of this chat".to_string(),
            };
            self.ws_manager.send_to_user(caller_id, error).await;
            return Ok(());
        }

        if !self.is_chat_participant(chat_id, target_user_id).await {
            tracing::error!(
                "Target is not participant of chat: target_user_id={}, chat_id={}",
                target_user_id,
                chat_id
            );
            let error = ServerEvent::Error {
                code: "TARGET_NOT_PARTICIPANT".to_string(),
                message: "Target user is not a participant of this chat".to_string(),
            };
            self.ws_manager.send_to_user(caller_id, error).await;
            return Ok(());
        }

        // Check if target user is online
        if !self.ws_manager.is_user_online(target_user_id).await {
            let error = ServerEvent::Error {
                code: "USER_OFFLINE".to_string(),
                message: "User is not available".to_string(),
            };
            self.ws_manager.send_to_user(caller_id, error).await;
            return Ok(());
        }

        // Check if caller is already in a call
        if self.ws_manager.is_user_in_call(caller_id).await {
            let error = ServerEvent::Error {
                code: "ALREADY_IN_CALL".to_string(),
                message: "You are already in a call".to_string(),
            };
            self.ws_manager.send_to_user(caller_id, error).await;
            return Ok(());
        }

        // Check if target user is already in a call
        if self.ws_manager.is_user_in_call(target_user_id).await {
            // Create a temporary call session to get call_id for UserBusy event
            let session = self
                .ws_manager
                .create_call_session(caller_id, target_user_id, chat_id, call_type.clone())
                .await;

            let busy_event = ServerEvent::UserBusy {
                call_id: session.call_id,
            };
            self.ws_manager.send_to_user(caller_id, busy_event).await;

            // Clean up the temporary session
            self.ws_manager.end_call(session.call_id).await;
            return Ok(());
        }

        // Create call session
        let session = self
            .ws_manager
            .create_call_session(caller_id, target_user_id, chat_id, call_type.clone())
            .await;

        // Get caller avatar
        let caller_avatar = self.ws_manager.get_user_avatar(caller_id).await;

        // Send CallInitiated to caller with the real call ID
        let call_initiated = ServerEvent::CallInitiated {
            call_id: session.call_id,
        };
        self.ws_manager.send_to_user(caller_id, call_initiated).await;

        // Send IncomingCall to target user
        let incoming_call = ServerEvent::IncomingCall {
            call_id: session.call_id,
            caller_id,
            caller_name: caller_name.to_string(),
            caller_avatar,
            chat_id,
            call_type,
        };
        self.ws_manager
            .send_to_user(target_user_id, incoming_call)
            .await;

        tracing::info!(
            "Call initiated via QUIC: call_id={}, caller={}, callee={}",
            session.call_id,
            caller_id,
            target_user_id
        );

        Ok(())
    }

    /// Handle AcceptCall event
    async fn handle_accept_call(&self, user_id: Uuid, call_id: Uuid) -> Result<(), MessageRouterError> {
        // Get the call session
        let session = match self.ws_manager.get_call_session(call_id).await {
            Some(s) => s,
            None => {
                let error = ServerEvent::Error {
                    code: "CALL_NOT_FOUND".to_string(),
                    message: "Call not found or already ended".to_string(),
                };
                self.ws_manager.send_to_user(user_id, error).await;
                return Ok(());
            }
        };

        // Verify the user is the callee
        if session.callee_id != user_id {
            let error = ServerEvent::Error {
                code: "NOT_CALLEE".to_string(),
                message: "You are not the callee of this call".to_string(),
            };
            self.ws_manager.send_to_user(user_id, error).await;
            return Ok(());
        }

        // Accept the call
        let session = match self.ws_manager.accept_call(call_id).await {
            Some(s) => s,
            None => {
                let error = ServerEvent::Error {
                    code: "CALL_ACCEPT_FAILED".to_string(),
                    message: "Failed to accept call".to_string(),
                };
                self.ws_manager.send_to_user(user_id, error).await;
                return Ok(());
            }
        };

        // Get mediasoup URL from config
        let mediasoup_url = self.state.config.mediasoup_url.clone();

        // Send CallAccepted to both parties
        let accepted_event = ServerEvent::CallAccepted {
            call_id: session.call_id,
            room_id: session.room_id.clone(),
            mediasoup_url,
        };

        self.ws_manager
            .send_to_user(session.caller_id, accepted_event.clone())
            .await;
        self.ws_manager
            .send_to_user(session.callee_id, accepted_event)
            .await;

        tracing::info!(
            "Call accepted via QUIC: call_id={}, room_id={}",
            session.call_id,
            session.room_id
        );

        Ok(())
    }

    /// Handle DeclineCall event
    async fn handle_decline_call(&self, user_id: Uuid, call_id: Uuid) -> Result<(), MessageRouterError> {
        // Get the call session
        let session = match self.ws_manager.get_call_session(call_id).await {
            Some(s) => s,
            None => {
                let error = ServerEvent::Error {
                    code: "CALL_NOT_FOUND".to_string(),
                    message: "Call not found or already ended".to_string(),
                };
                self.ws_manager.send_to_user(user_id, error).await;
                return Ok(());
            }
        };

        // Verify the user is the callee
        if session.callee_id != user_id {
            let error = ServerEvent::Error {
                code: "NOT_CALLEE".to_string(),
                message: "You are not the callee of this call".to_string(),
            };
            self.ws_manager.send_to_user(user_id, error).await;
            return Ok(());
        }

        // End the call
        self.ws_manager.end_call(call_id).await;

        // Send CallDeclined to caller
        let declined_event = ServerEvent::CallDeclined { call_id };
        self.ws_manager
            .send_to_user(session.caller_id, declined_event)
            .await;

        tracing::info!("Call declined via QUIC: call_id={}", call_id);

        Ok(())
    }

    /// Handle EndCall event
    async fn handle_end_call(&self, user_id: Uuid, call_id: Uuid) -> Result<(), MessageRouterError> {
        // Get the call session
        let session = match self.ws_manager.get_call_session(call_id).await {
            Some(s) => s,
            None => {
                let error = ServerEvent::Error {
                    code: "CALL_NOT_FOUND".to_string(),
                    message: "Call not found or already ended".to_string(),
                };
                self.ws_manager.send_to_user(user_id, error).await;
                return Ok(());
            }
        };

        // Verify the user is part of the call
        if session.caller_id != user_id && session.callee_id != user_id {
            let error = ServerEvent::Error {
                code: "NOT_IN_CALL".to_string(),
                message: "You are not part of this call".to_string(),
            };
            self.ws_manager.send_to_user(user_id, error).await;
            return Ok(());
        }

        // End the call
        self.ws_manager.end_call(call_id).await;

        // Send CallEnded to both parties
        let ended_event = ServerEvent::CallEnded {
            call_id,
            reason: "ended".to_string(),
        };

        self.ws_manager
            .send_to_user(session.caller_id, ended_event.clone())
            .await;
        self.ws_manager
            .send_to_user(session.callee_id, ended_event)
            .await;

        tracing::info!("Call ended via QUIC: call_id={}", call_id);

        Ok(())
    }

    /// Check if user is a participant of a chat
    async fn is_chat_participant(&self, chat_id: Uuid, user_id: Uuid) -> bool {
        tracing::debug!(
            "Checking chat participant: chat_id={}, user_id={}",
            chat_id,
            user_id
        );

        let query_result = sqlx::query_as::<_, (i32,)>(
            "SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
        )
        .bind(chat_id)
        .bind(user_id)
        .fetch_optional(&self.state.db.pool)
        .await;

        match query_result {
            Ok(Some(_)) => {
                tracing::debug!("User {} IS participant of chat {}", user_id, chat_id);
                true
            }
            Ok(None) => {
                tracing::warn!("User {} is NOT participant of chat {}", user_id, chat_id);
                false
            }
            Err(e) => {
                tracing::error!("Database error checking participation: {}", e);
                false
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_router_error_display() {
        let err = MessageRouterError::ParseError("test".to_string());
        assert!(err.to_string().contains("test"));

        let err = MessageRouterError::NotAuthenticated;
        assert!(err.to_string().contains("authenticated"));
    }

    #[test]
    fn test_parse_client_event() {
        // Test parsing a valid StartTyping event
        let json = r#"{"event":"start_typing","data":{"chatId":"550e8400-e29b-41d4-a716-446655440000"}}"#;
        let event: Result<ClientEvent, _> = serde_json::from_str(json);
        assert!(event.is_ok());

        // Test parsing a valid Ping event
        let json = r#"{"event":"ping"}"#;
        let event: Result<ClientEvent, _> = serde_json::from_str(json);
        assert!(event.is_ok());
    }

    #[test]
    fn test_invalid_json() {
        let json = r#"{"invalid": "json"}"#;
        let event: Result<ClientEvent, _> = serde_json::from_str(json);
        assert!(event.is_err());
    }
}
