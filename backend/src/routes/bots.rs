use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::MessageResponse,
    routes::auth::get_current_user_id,
    services::{BotService, ChatService, WebSocketService},
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/:bot_id/callback", post(handle_callback))
}

#[derive(Debug, Deserialize)]
pub struct CallbackRequest {
    #[serde(rename = "chatId")]
    chat_id: Uuid,
    #[serde(rename = "messageId")]
    message_id: Uuid,
    #[serde(rename = "callbackData")]
    callback_data: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponseWrapper {
    message: MessageResponse,
}

/// Handle inline button callback from bot
/// POST /bots/:botId/callback
async fn handle_callback(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(bot_id): Path<Uuid>,
    Json(req): Json<CallbackRequest>,
) -> AppResult<Json<MessageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let message = BotService::handle_callback(
        &state.db,
        bot_id,
        req.chat_id,
        req.message_id,
        user_id,
        &req.callback_data,
    )
    .await?;

    // Broadcast new message to all chat participants via WebSocket
    let participant_ids = ChatService::get_participant_ids(&state.db, req.chat_id).await?;
    WebSocketService::broadcast_new_message(
        &state.ws_manager,
        message.clone(),
        &participant_ids,
        bot_id,
    )
    .await;

    Ok(Json(MessageResponseWrapper { message }))
}
