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

use crate::{
    services::AuthService,
    AppState,
};

use super::{
    events::{ClientEvent, ServerEvent},
    manager::{Client, WsManager},
};

#[derive(Debug, serde::Deserialize)]
pub struct WsQuery {
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
                    handle_client_message(&text, user_id, &user_name, &state_clone, &ws_manager_clone).await;
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
    let event: ClientEvent = match serde_json::from_str(text) {
        Ok(e) => e,
        Err(e) => {
            tracing::warn!("Failed to parse client event: {}", e);
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
            ws_manager.broadcast_to_room(chat_id, typing_event, Some(user_id)).await;
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
            ws_manager.broadcast_to_room(chat_id, typing_event, Some(user_id)).await;
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
    }
}

/// Update user online/offline status in database
async fn update_user_status(state: &Arc<AppState>, user_id: Uuid, status: &str) -> Result<(), sqlx::Error> {
    if status == "offline" {
        sqlx::query(
            "UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2"
        )
        .bind(status)
        .bind(user_id)
        .execute(&state.db.pool)
        .await?;
    } else {
        sqlx::query(
            "UPDATE users SET status = $1, last_seen = NULL WHERE id = $2"
        )
        .bind(status)
        .bind(user_id)
        .execute(&state.db.pool)
        .await?;
    }
    Ok(())
}

/// Get all chat IDs for a user
async fn get_user_chat_ids(state: &Arc<AppState>, user_id: Uuid) -> Result<Vec<Uuid>, sqlx::Error> {
    let chat_ids: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT chat_id FROM chat_participants WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(&state.db.pool)
    .await?;

    Ok(chat_ids.into_iter().map(|(id,)| id).collect())
}

/// Check if user is a participant of a chat
async fn is_chat_participant(state: &Arc<AppState>, chat_id: Uuid, user_id: Uuid) -> bool {
    let result: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2"
    )
    .bind(chat_id)
    .bind(user_id)
    .fetch_optional(&state.db.pool)
    .await
    .ok()
    .flatten();

    result.is_some()
}
