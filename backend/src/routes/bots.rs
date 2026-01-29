/// Bot Management API Routes - User-facing bot management endpoints.
///
/// This module provides:
/// - POST /api/v1/bots - Create a new bot
/// - GET /api/v1/bots - List user's bots
/// - GET /api/v1/bots/search - Search bot by username
/// - GET /api/v1/bots/:id - Get bot details
/// - DELETE /api/v1/bots/:id - Delete a bot
/// - POST /api/v1/bots/:bot_id/callback - Handle inline button callback
///
/// # Requirements
/// - 1.1: Create bot with unique token
/// - 1.5: Delete bot and cascade to related records
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::{BotPublicResponse, BotResponse, CreateBotRequest, MessageResponse},
    routes::auth::get_current_user_id,
    services::{bot_engine::BotEngineService, BotService, ChatService, WebSocketService},
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(create_bot).get(list_bots))
        .route("/available", get(list_available_bots))
        .route("/search", get(search_bot))
        .route("/:bot_id", get(get_bot).delete(delete_bot))
        .route("/:bot_id/callback", post(handle_callback))
}

#[derive(Debug, Deserialize)]
pub struct AvailableBotsQuery {
    limit: Option<i64>,
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

// ==================== Bot Management Routes ====================
// Requirements: 1.1, 1.5

/// Response wrapper for a single bot
#[derive(Debug, Serialize)]
pub struct BotResponseWrapper {
    bot: BotResponse,
}

/// Response wrapper for a list of bots
#[derive(Debug, Serialize)]
pub struct BotsListResponse {
    bots: Vec<BotResponse>,
}

/// Simple message response
#[derive(Debug, Serialize)]
pub struct SimpleMessage {
    message: String,
}

/// Query for searching bots
#[derive(Debug, Deserialize)]
pub struct SearchBotQuery {
    username: String,
}

/// Response wrapper for public bot info
#[derive(Debug, Serialize)]
pub struct BotPublicResponseWrapper {
    bot: BotPublicResponse,
}

/// Create a new bot.
///
/// POST /api/v1/bots
///
/// # Request Body
/// ```json
/// {
///   "name": "My Bot"
/// }
/// ```
///
/// # Requirements
/// - 1.1: Generate unique token and store bot in database
/// - 1.2: Associate bot with owner_id
/// - 3.1: Assign default permissions (send_message only)
async fn create_bot(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateBotRequest>,
) -> AppResult<Json<BotResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let bot = BotEngineService::create_bot(&state.db, user_id, req).await?;

    Ok(Json(BotResponseWrapper { bot }))
}

/// List all bots owned by the current user.
///
/// GET /api/v1/bots
///
/// # Returns
/// List of bots owned by the authenticated user.
async fn list_bots(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<BotsListResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let bots = BotEngineService::get_bots_by_owner(&state.db, user_id).await?;
    let bot_responses: Vec<BotResponse> = bots.into_iter().map(BotResponse::from).collect();

    Ok(Json(BotsListResponse {
        bots: bot_responses,
    }))
}

/// Response wrapper for available bots (using public info)
#[derive(Debug, Serialize)]
pub struct AvailableBotsResponse {
    bots: Vec<BotPublicResponse>,
}

/// List all available active bots that can be added to chats.
///
/// GET /api/v1/bots/available
///
/// # Query Parameters
/// - `limit`: Optional, maximum number of bots to return (default: 50)
///
/// # Returns
/// List of active bots with public info (without tokens).
async fn list_available_bots(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<AvailableBotsQuery>,
) -> AppResult<Json<AvailableBotsResponse>> {
    // Verify authentication
    let _ = get_current_user_id(&state, &headers).await?;

    let limit = query.limit.unwrap_or(50).min(100);
    let bots = BotEngineService::get_all_active_bots(&state.db, limit).await?;
    let bot_responses: Vec<BotPublicResponse> =
        bots.into_iter().map(BotPublicResponse::from).collect();

    Ok(Json(AvailableBotsResponse {
        bots: bot_responses,
    }))
}

/// Get bot details by ID.
///
/// GET /api/v1/bots/:bot_id
///
/// # Returns
/// Bot details if the user is the owner.
async fn get_bot(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(bot_id): Path<Uuid>,
) -> AppResult<Json<BotResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let bot = BotEngineService::get_bot_by_id(&state.db, bot_id).await?;

    // Verify ownership
    if bot.owner_id != user_id {
        return Err(crate::error::AppError::AccessDenied);
    }

    Ok(Json(BotResponseWrapper {
        bot: BotResponse::from(bot),
    }))
}

/// Delete a bot and all associated data.
///
/// DELETE /api/v1/bots/:bot_id
///
/// # Requirements
/// - 1.5: Remove bot and all associated permissions and chat subscriptions
async fn delete_bot(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(bot_id): Path<Uuid>,
) -> AppResult<Json<SimpleMessage>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    BotEngineService::delete_bot(&state.db, bot_id, user_id).await?;

    Ok(Json(SimpleMessage {
        message: "Bot deleted successfully".to_string(),
    }))
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

/// Search for a bot by username.
///
/// GET /api/v1/bots/search?username=xxx
///
/// # Query Parameters
/// - `username`: The bot's username to search for
///
/// # Returns
/// Public bot info if found (without token for security).
async fn search_bot(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchBotQuery>,
) -> AppResult<Json<BotPublicResponseWrapper>> {
    // Verify authentication
    let _ = get_current_user_id(&state, &headers).await?;

    let bot = BotEngineService::get_bot_by_username(&state.db, &query.username).await?;

    Ok(Json(BotPublicResponseWrapper {
        bot: BotPublicResponse::from(bot),
    }))
}
