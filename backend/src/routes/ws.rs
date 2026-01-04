use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::AppResult,
    routes::auth::get_current_user_id,
    services::{ChatService, WebSocketService, UserService},
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/typing/:chat_id/start", post(start_typing))
        .route("/typing/:chat_id/stop", post(stop_typing))
}

#[derive(Debug, Serialize)]
pub struct TypingResponse {
    message: String,
}

/// REST endpoint to broadcast typing start event
async fn start_typing(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<TypingResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    // Verify user is participant
    if !ChatService::is_participant(&state.db, chat_id, user_id).await? {
        return Err(crate::error::AppError::AccessDenied);
    }

    // Get user name
    let user = UserService::get_user_by_id(&state.db, user_id).await?;

    // Broadcast typing event
    WebSocketService::broadcast_typing(
        &state.ws_manager,
        chat_id,
        user_id,
        user.name,
        true,
    )
    .await;

    Ok(Json(TypingResponse {
        message: "Typing started".to_string(),
    }))
}

/// REST endpoint to broadcast typing stop event
async fn stop_typing(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<TypingResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    // Verify user is participant
    if !ChatService::is_participant(&state.db, chat_id, user_id).await? {
        return Err(crate::error::AppError::AccessDenied);
    }

    // Get user name
    let user = UserService::get_user_by_id(&state.db, user_id).await?;

    // Broadcast typing event
    WebSocketService::broadcast_typing(
        &state.ws_manager,
        chat_id,
        user_id,
        user.name,
        false,
    )
    .await;

    Ok(Json(TypingResponse {
        message: "Typing stopped".to_string(),
    }))
}
