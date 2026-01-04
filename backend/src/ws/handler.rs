use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{services::AuthService, services::bot_engine::BotEngineService, AppState};

use super::{
    events::{BotServerEvent, ClientEvent, ServerEvent},
    manager::{BotClient, Client, WsManager},
};

#[derive(Debug, serde::Deserialize)]
pub struct WsQuery {
    token: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct BotWsQuery {
    token: String,
}

/// WebSocket upgrade handler with JWT authentication
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let ws_manager = state.ws_manager.clone();
    // Verify JWT token
    let claims = match AuthService::verify_token(&query.token, &state.config.jwt_secret) {
        Ok(claims) => claims,
        Err(_) => {
            return ws.on_upgrade(|mut socket| async move {
                let error = ServerEvent::Error {
                    code: "INVALID_TOKEN".to_string(),
                    message: "Invalid or expired token".to_string(),
                };
                let _ = socket
                    .send(Message::Text(serde_json::to_string(&error).unwrap()))
                    .await;
                let _ = socket.close().await;
            });
        }
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return ws.on_upgrade(|mut socket| async move {
                let error = ServerEvent::Error {
                    code: "INVALID_TOKEN".to_string(),
                    message: "Invalid user ID in token".to_string(),
                };
                let _ = socket
                    .send(Message::Text(serde_json::to_string(&error).unwrap()))
                    .await;
                let _ = socket.close().await;
            });
        }
    };

    let user_name = claims.name.clone();

    ws.on_upgrade(move |socket| handle_socket(socket, user_id, user_name, state, ws_manager))
}

/// Bot WebSocket upgrade handler with token authentication
///
/// # Requirements
/// - 9.1: Authenticate bot via token and establish WebSocket connection
pub async fn bot_ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<BotWsQuery>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let ws_manager = state.ws_manager.clone();
    
    // Verify bot token and get bot info
    let bot = match BotEngineService::get_bot_by_token(&state.db, &query.token).await {
        Ok(bot) => bot,
        Err(_) => {
            return ws.on_upgrade(|mut socket| async move {
                let error = BotServerEvent::BotError {
                    code: "INVALID_TOKEN".to_string(),
                    message: "Invalid bot token".to_string(),
                };
                let _ = socket
                    .send(Message::Text(serde_json::to_string(&error).unwrap()))
                    .await;
                let _ = socket.close().await;
            });
        }
    };

    // Check if bot is active
    if !bot.is_active {
        return ws.on_upgrade(|mut socket| async move {
            let error = BotServerEvent::BotError {
                code: "BOT_INACTIVE".to_string(),
                message: "Bot is not active".to_string(),
            };
            let _ = socket
                .send(Message::Text(serde_json::to_string(&error).unwrap()))
                .await;
            let _ = socket.close().await;
        });
    }

    let bot_id = bot.id;
    let bot_name = bot.name.clone();

    ws.on_upgrade(move |socket| handle_bot_socket(socket, bot_id, bot_name, state, ws_manager))
}

/// Handle an individual bot WebSocket connection
///
/// # Requirements
/// - 9.1: Authenticate and establish bot WebSocket connection
/// - 9.3: Track bot connections in WsManager
async fn handle_bot_socket(
    socket: WebSocket,
    bot_id: Uuid,
    bot_name: String,
    _state: Arc<AppState>,
    ws_manager: Arc<WsManager>,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Create channel for sending messages to this bot
    let (tx, mut rx) = mpsc::unbounded_channel::<BotServerEvent>();

    // Register bot client
    let client = BotClient {
        bot_id,
        bot_name: bot_name.clone(),
        sender: tx.clone(),
    };
    ws_manager.add_bot_client(client).await;

    // Send connected confirmation
    let connected_event = BotServerEvent::BotConnected {
        bot_id,
        bot_name: bot_name.clone(),
    };
    let _ = tx.send(connected_event);

    tracing::info!("Bot WebSocket connected: bot_id={}, bot_name={}", bot_id, bot_name);

    // Task to forward messages from channel to WebSocket
    let ws_manager_clone = ws_manager.clone();
    let tx_clone = tx.clone();
    let send_task = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match serde_json::to_string(&event) {
                Ok(json) => {
                    if ws_sender.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to serialize bot event: {}", e);
                }
            }
        }
        ws_manager_clone.remove_bot_client(bot_id, &tx_clone).await;
    });

    // Task to receive messages from WebSocket (bots don't send events, just keep-alive)
    let recv_task = tokio::spawn(async move {
        while let Some(result) = ws_receiver.next().await {
            match result {
                Ok(Message::Text(text)) => {
                    // Bots don't send events, but we log any received messages
                    tracing::debug!("Received message from bot {}: {}", bot_id, text);
                }
                Ok(Message::Ping(data)) => {
                    tracing::debug!("Received ping from bot {}: {:?}", bot_id, data);
                }
                Ok(Message::Pong(_)) => {
                    tracing::debug!("Received pong from bot {}", bot_id);
                }
                Ok(Message::Close(_)) => {
                    tracing::info!("Bot {} requested close", bot_id);
                    break;
                }
                Ok(Message::Binary(_)) => {
                    tracing::warn!("Received unexpected binary message from bot {}", bot_id);
                }
                Err(e) => {
                    tracing::error!("WebSocket error for bot {}: {}", bot_id, e);
                    break;
                }
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Cleanup: remove bot client
    ws_manager.remove_bot_client(bot_id, &tx).await;
    tracing::info!("Bot WebSocket disconnected: bot_id={}", bot_id);
}

/// Handle an individual WebSocket connection
async fn handle_socket(
    socket: WebSocket,
    user_id: Uuid,
    user_name: String,
    state: Arc<AppState>,
    ws_manager: Arc<WsManager>,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Create channel for sending messages to this client
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerEvent>();

    // Register client
    let client = Client {
        user_id,
        user_name: user_name.clone(),
        sender: tx.clone(),
    };
    ws_manager.add_client(client).await;

    // Update user status to online
    if let Err(e) = update_user_status(&state, user_id, "online").await {
        tracing::error!("Failed to update user status: {}", e);
    }

    // Broadcast user online status
    let status_event = ServerEvent::UserStatus {
        user_id,
        status: "online".to_string(),
        last_seen: None,
    };
    ws_manager.broadcast_user_status(status_event).await;

    // Send connected confirmation
    let connected_event = ServerEvent::Connected { user_id };
    let _ = tx.send(connected_event);

    // Auto-join user's chat rooms
    if let Ok(chat_ids) = get_user_chat_ids(&state, user_id).await {
        for chat_id in chat_ids {
            ws_manager.join_room(user_id, chat_id).await;
        }
    }

    // Task to forward messages from channel to WebSocket
    let ws_manager_clone = ws_manager.clone();
    let tx_clone = tx.clone();
    let send_task = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match serde_json::to_string(&event) {
                Ok(json) => {
                    if ws_sender.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to serialize event: {}", e);
                }
            }
        }
        ws_manager_clone.remove_client(user_id, &tx_clone).await;
    });

    // Task to receive messages from WebSocket
    let ws_manager_clone = ws_manager.clone();
    let state_clone = state.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(result) = ws_receiver.next().await {
            match result {
                Ok(Message::Text(text)) => {
                    handle_client_message(
                        &text,
                        user_id,
                        &user_name,
                        &state_clone,
                        &ws_manager_clone,
                    )
                    .await;
                }
                Ok(Message::Ping(data)) => {
                    // Pong is handled automatically by axum
                    tracing::debug!("Received ping from user {}: {:?}", user_id, data);
                }
                Ok(Message::Pong(_)) => {
                    tracing::debug!("Received pong from user {}", user_id);
                }
                Ok(Message::Close(_)) => {
                    tracing::info!("Client {} requested close", user_id);
                    break;
                }
                Ok(Message::Binary(_)) => {
                    tracing::warn!("Received unexpected binary message from user {}", user_id);
                }
                Err(e) => {
                    tracing::error!("WebSocket error for user {}: {}", user_id, e);
                    break;
                }
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Cleanup: remove client and update status
    ws_manager.remove_client(user_id, &tx).await;

    // Check if user has no more connections
    if !ws_manager.is_user_online(user_id).await {
        // Update user status to offline
        if let Err(e) = update_user_status(&state, user_id, "offline").await {
            tracing::error!("Failed to update user status: {}", e);
        }

        // Broadcast user offline status
        let last_seen = chrono::Utc::now();
        let status_event = ServerEvent::UserStatus {
            user_id,
            status: "offline".to_string(),
            last_seen: Some(last_seen),
        };
        ws_manager.broadcast_user_status(status_event).await;
    }
}

/// Handle incoming client messages
async fn handle_client_message(
    text: &str,
    user_id: Uuid,
    user_name: &str,
    state: &Arc<AppState>,
    ws_manager: &Arc<WsManager>,
) {
    tracing::debug!("Received message: {}", text);
    let event: ClientEvent = match serde_json::from_str(text) {
        Ok(e) => e,
        Err(e) => {
            tracing::warn!("Failed to parse client event: {}. Raw message: {}", e, text);
            return;
        }
    };

    match event {
        ClientEvent::StartTyping { chat_id } => {
            // Verify user is participant of the chat
            if !is_chat_participant(state, chat_id, user_id).await {
                return;
            }

            let typing_event = ServerEvent::Typing {
                chat_id,
                user_id,
                user_name: user_name.to_string(),
                is_typing: true,
            };
            ws_manager
                .broadcast_to_room(chat_id, typing_event, Some(user_id))
                .await;
        }
        ClientEvent::StopTyping { chat_id } => {
            // Verify user is participant of the chat
            if !is_chat_participant(state, chat_id, user_id).await {
                return;
            }

            let typing_event = ServerEvent::Typing {
                chat_id,
                user_id,
                user_name: user_name.to_string(),
                is_typing: false,
            };
            ws_manager
                .broadcast_to_room(chat_id, typing_event, Some(user_id))
                .await;
        }
        ClientEvent::JoinChat { chat_id } => {
            // Verify user is participant of the chat
            if !is_chat_participant(state, chat_id, user_id).await {
                return;
            }
            ws_manager.join_room(user_id, chat_id).await;
        }
        ClientEvent::LeaveChat { chat_id } => {
            ws_manager.leave_room(user_id, chat_id).await;
        }
        ClientEvent::Ping => {
            // Client ping - no action needed, connection is alive
            tracing::debug!("Received ping from user {}", user_id);
        }
        ClientEvent::InitiateCall {
            target_user_id,
            chat_id,
            call_type,
        } => {
            handle_initiate_call(
                user_id,
                user_name,
                target_user_id,
                chat_id,
                call_type,
                state,
                ws_manager,
            )
            .await;
        }
        ClientEvent::AcceptCall { call_id } => {
            handle_accept_call(user_id, call_id, state, ws_manager).await;
        }
        ClientEvent::DeclineCall { call_id } => {
            handle_decline_call(user_id, call_id, ws_manager).await;
        }
        ClientEvent::EndCall { call_id } => {
            handle_end_call(user_id, call_id, ws_manager).await;
        }
    }
}

/// Update user online/offline status in database
async fn update_user_status(
    state: &Arc<AppState>,
    user_id: Uuid,
    status: &str,
) -> Result<(), sqlx::Error> {
    if status == "offline" {
        sqlx::query("UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2")
            .bind(status)
            .bind(user_id)
            .execute(&state.db.pool)
            .await?;
    } else {
        sqlx::query("UPDATE users SET status = $1, last_seen = NULL WHERE id = $2")
            .bind(status)
            .bind(user_id)
            .execute(&state.db.pool)
            .await?;
    }
    Ok(())
}

/// Get all chat IDs for a user
async fn get_user_chat_ids(state: &Arc<AppState>, user_id: Uuid) -> Result<Vec<Uuid>, sqlx::Error> {
    let chat_ids: Vec<(Uuid,)> =
        sqlx::query_as("SELECT chat_id FROM chat_participants WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(&state.db.pool)
            .await?;

    Ok(chat_ids.into_iter().map(|(id,)| id).collect())
}

/// Check if user is a participant of a chat
async fn is_chat_participant(state: &Arc<AppState>, chat_id: Uuid, user_id: Uuid) -> bool {
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
    .fetch_optional(&state.db.pool)
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

// ==================== Call Signaling Handlers ====================

/// Handle InitiateCall event
async fn handle_initiate_call(
    caller_id: Uuid,
    caller_name: &str,
    target_user_id: Uuid,
    chat_id: Uuid,
    call_type: String,
    state: &Arc<AppState>,
    ws_manager: &Arc<WsManager>,
) {
    // Validate call type
    if call_type != "voice" && call_type != "video" {
        let error = ServerEvent::Error {
            code: "INVALID_CALL_TYPE".to_string(),
            message: "Call type must be 'voice' or 'video'".to_string(),
        };
        ws_manager.send_to_user(caller_id, error).await;
        return;
    }

    // Validate that caller and target have an existing chat
    if !is_chat_participant(state, chat_id, caller_id).await {
        tracing::error!(
            "Caller is not participant of chat: caller_id={}, chat_id={}",
            caller_id,
            chat_id
        );
        let error = ServerEvent::Error {
            code: "NOT_CHAT_PARTICIPANT".to_string(),
            message: "You are not a participant of this chat".to_string(),
        };
        ws_manager.send_to_user(caller_id, error).await;
        return;
    }

    if !is_chat_participant(state, chat_id, target_user_id).await {
        tracing::error!(
            "Target is not participant of chat: target_user_id={}, chat_id={}",
            target_user_id,
            chat_id
        );
        let error = ServerEvent::Error {
            code: "TARGET_NOT_PARTICIPANT".to_string(),
            message: "Target user is not a participant of this chat".to_string(),
        };
        ws_manager.send_to_user(caller_id, error).await;
        return;
    }

    // Check if target user is online
    if !ws_manager.is_user_online(target_user_id).await {
        let error = ServerEvent::Error {
            code: "USER_OFFLINE".to_string(),
            message: "User is not available".to_string(),
        };
        ws_manager.send_to_user(caller_id, error).await;
        return;
    }

    // Check if caller is already in a call
    if ws_manager.is_user_in_call(caller_id).await {
        let error = ServerEvent::Error {
            code: "ALREADY_IN_CALL".to_string(),
            message: "You are already in a call".to_string(),
        };
        ws_manager.send_to_user(caller_id, error).await;
        return;
    }

    // Check if target user is already in a call
    if ws_manager.is_user_in_call(target_user_id).await {
        // Create a temporary call session to get call_id for UserBusy event
        let session = ws_manager
            .create_call_session(caller_id, target_user_id, chat_id, call_type.clone())
            .await;

        let busy_event = ServerEvent::UserBusy {
            call_id: session.call_id,
        };
        ws_manager.send_to_user(caller_id, busy_event).await;

        // Clean up the temporary session
        ws_manager.end_call(session.call_id).await;
        return;
    }

    // Create call session
    let session = ws_manager
        .create_call_session(caller_id, target_user_id, chat_id, call_type.clone())
        .await;

    // Get caller avatar
    let caller_avatar = ws_manager.get_user_avatar(caller_id).await;

    // Send CallInitiated to caller with the real call ID
    let call_initiated = ServerEvent::CallInitiated {
        call_id: session.call_id,
    };
    ws_manager.send_to_user(caller_id, call_initiated).await;

    // Send IncomingCall to target user
    let incoming_call = ServerEvent::IncomingCall {
        call_id: session.call_id,
        caller_id,
        caller_name: caller_name.to_string(),
        caller_avatar,
        chat_id,
        call_type,
    };
    ws_manager.send_to_user(target_user_id, incoming_call).await;

    tracing::info!(
        "Call initiated: call_id={}, caller={}, callee={}",
        session.call_id,
        caller_id,
        target_user_id
    );
}

/// Handle AcceptCall event
async fn handle_accept_call(
    user_id: Uuid,
    call_id: Uuid,
    state: &Arc<AppState>,
    ws_manager: &Arc<WsManager>,
) {
    // Get the call session
    let session = match ws_manager.get_call_session(call_id).await {
        Some(s) => s,
        None => {
            let error = ServerEvent::Error {
                code: "CALL_NOT_FOUND".to_string(),
                message: "Call not found or already ended".to_string(),
            };
            ws_manager.send_to_user(user_id, error).await;
            return;
        }
    };

    // Verify the user is the callee
    if session.callee_id != user_id {
        let error = ServerEvent::Error {
            code: "NOT_CALLEE".to_string(),
            message: "You are not the callee of this call".to_string(),
        };
        ws_manager.send_to_user(user_id, error).await;
        return;
    }

    // Accept the call
    let session = match ws_manager.accept_call(call_id).await {
        Some(s) => s,
        None => {
            let error = ServerEvent::Error {
                code: "CALL_ACCEPT_FAILED".to_string(),
                message: "Failed to accept call".to_string(),
            };
            ws_manager.send_to_user(user_id, error).await;
            return;
        }
    };

    // Get mediasoup URL from config
    let mediasoup_url = state.config.mediasoup_url.clone();

    // Send CallAccepted to both parties
    let accepted_event = ServerEvent::CallAccepted {
        call_id: session.call_id,
        room_id: session.room_id.clone(),
        mediasoup_url,
    };

    ws_manager
        .send_to_user(session.caller_id, accepted_event.clone())
        .await;
    ws_manager
        .send_to_user(session.callee_id, accepted_event)
        .await;

    tracing::info!(
        "Call accepted: call_id={}, room_id={}",
        session.call_id,
        session.room_id
    );
}

/// Handle DeclineCall event
async fn handle_decline_call(user_id: Uuid, call_id: Uuid, ws_manager: &Arc<WsManager>) {
    // Get the call session
    let session = match ws_manager.get_call_session(call_id).await {
        Some(s) => s,
        None => {
            let error = ServerEvent::Error {
                code: "CALL_NOT_FOUND".to_string(),
                message: "Call not found or already ended".to_string(),
            };
            ws_manager.send_to_user(user_id, error).await;
            return;
        }
    };

    // Verify the user is the callee
    if session.callee_id != user_id {
        let error = ServerEvent::Error {
            code: "NOT_CALLEE".to_string(),
            message: "You are not the callee of this call".to_string(),
        };
        ws_manager.send_to_user(user_id, error).await;
        return;
    }

    // End the call
    ws_manager.end_call(call_id).await;

    // Send CallDeclined to caller
    let declined_event = ServerEvent::CallDeclined { call_id };
    ws_manager
        .send_to_user(session.caller_id, declined_event)
        .await;

    tracing::info!("Call declined: call_id={}", call_id);
}

/// Handle EndCall event
async fn handle_end_call(user_id: Uuid, call_id: Uuid, ws_manager: &Arc<WsManager>) {
    // Get the call session
    let session = match ws_manager.get_call_session(call_id).await {
        Some(s) => s,
        None => {
            let error = ServerEvent::Error {
                code: "CALL_NOT_FOUND".to_string(),
                message: "Call not found or already ended".to_string(),
            };
            ws_manager.send_to_user(user_id, error).await;
            return;
        }
    };

    // Verify the user is part of the call
    if session.caller_id != user_id && session.callee_id != user_id {
        let error = ServerEvent::Error {
            code: "NOT_IN_CALL".to_string(),
            message: "You are not part of this call".to_string(),
        };
        ws_manager.send_to_user(user_id, error).await;
        return;
    }

    // End the call
    ws_manager.end_call(call_id).await;

    // Send CallEnded to both parties
    let ended_event = ServerEvent::CallEnded {
        call_id,
        reason: "ended".to_string(),
    };

    ws_manager
        .send_to_user(session.caller_id, ended_event.clone())
        .await;
    ws_manager
        .send_to_user(session.callee_id, ended_event)
        .await;

    tracing::info!("Call ended: call_id={}", call_id);
}
