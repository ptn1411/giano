/// BotFather API Routes - Handle BotFather chat messages.
///
/// This module provides:
/// - POST /api/v1/botfather/message - Send a message to BotFather and get response
/// - GET /api/v1/botfather/messages - Get message history

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::{BotFatherMessage, BotFatherMessageDto},
    routes::auth::get_current_user_id,
    services::bot_engine::{BotFather, ParsedCommand, BOTFATHER_ID},
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/message", post(send_message))
        .route("/messages", get(get_messages))
}

#[derive(Debug, Deserialize)]
pub struct BotFatherMessageRequest {
    pub text: String,
    #[serde(rename = "chatId")]
    pub chat_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct BotFatherMessageResponse {
    pub success: bool,
    pub response: Option<String>,
    pub error: Option<String>,
    #[serde(rename = "userMessage")]
    pub user_message: Option<BotFatherMessageDto>,
    #[serde(rename = "botMessage")]
    pub bot_message: Option<BotFatherMessageDto>,
}

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    pub limit: Option<i64>,
    pub before: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct GetMessagesResponse {
    pub messages: Vec<BotFatherMessageDto>,
}

/// Save a message to database
async fn save_message(
    state: &AppState,
    user_id: Uuid,
    sender_type: &str,
    text: &str,
) -> AppResult<BotFatherMessage> {
    let msg: BotFatherMessage = sqlx::query_as(
        r#"
        INSERT INTO botfather_messages (user_id, sender_type, text)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(sender_type)
    .bind(text)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(msg)
}

/// Get message history
///
/// GET /api/v1/botfather/messages?limit=50&before=uuid
async fn get_messages(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<GetMessagesQuery>,
) -> AppResult<Json<GetMessagesResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let limit = query.limit.unwrap_or(50).min(100);

    let messages: Vec<BotFatherMessage> = if let Some(before_id) = query.before {
        sqlx::query_as(
            r#"
            SELECT * FROM botfather_messages
            WHERE user_id = $1 AND created_at < (
                SELECT created_at FROM botfather_messages WHERE id = $2
            )
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(user_id)
        .bind(before_id)
        .bind(limit)
        .fetch_all(&state.db.pool)
        .await?
    } else {
        sqlx::query_as(
            r#"
            SELECT * FROM botfather_messages
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&state.db.pool)
        .await?
    };

    // Reverse to get chronological order
    let messages: Vec<BotFatherMessageDto> = messages
        .into_iter()
        .rev()
        .map(|m| m.to_dto(BOTFATHER_ID))
        .collect();

    Ok(Json(GetMessagesResponse { messages }))
}

/// Send a message to BotFather and get response.
///
/// POST /api/v1/botfather/message
async fn send_message(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<BotFatherMessageRequest>,
) -> AppResult<Json<BotFatherMessageResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let text = body.text.trim();

    // Save user message
    let user_msg = save_message(&state, user_id, "user", text).await?;

    // Process and get response
    let (success, response_text) = process_botfather_message(&state, user_id, &body, text).await;

    // Save bot response
    let bot_msg = save_message(&state, user_id, "bot", &response_text).await?;

    Ok(Json(BotFatherMessageResponse {
        success,
        response: Some(response_text.clone()),
        error: if success { None } else { Some(response_text) },
        user_message: Some(user_msg.to_dto(BOTFATHER_ID)),
        bot_message: Some(bot_msg.to_dto(BOTFATHER_ID)),
    }))
}

/// Process message and return (success, response_text)
async fn process_botfather_message(
    state: &AppState,
    user_id: Uuid,
    body: &BotFatherMessageRequest,
    text: &str,
) -> (bool, String) {
    // Try to parse as command
    if let Some(cmd) = ParsedCommand::parse(text) {
        if BotFather::is_botfather_command(&cmd) {
            let chat_id = body.chat_id.unwrap_or_else(Uuid::nil);

            return match BotFather::handle_command(&state.db, user_id, chat_id, &cmd).await {
                Ok(Some(response)) => (response.success, response.text),
                Ok(None) => (false, "Command not handled".to_string()),
                Err(e) => (false, format!("Error: {}", e)),
            };
        }
    }

    // Not a command - check if user has an active conversation session
    if BotFather::has_active_session(user_id) {
        return match BotFather::handle_message(&state.db, user_id, text).await {
            Ok(Some(response)) => (response.success, response.text),
            Ok(None) => (false, "Session expired. Please start again.".to_string()),
            Err(e) => (false, format!("Error: {}", e)),
        };
    }

    // No active session and not a valid command
    (false, "Please send a command starting with /. Type /bothelp for available commands.".to_string())
}
