/// Bot HTTP API Routes - Telegram-style bot API endpoints.
///
/// This module provides:
/// - POST /bot:token/sendMessage - Send a message to a chat
/// - POST /bot:token/setWebhook - Set webhook URL for updates
/// - GET /bot:token/getMe - Get bot information
///
/// # Requirements
/// - 7.1: Create message from bot via sendMessage
/// - 7.2: Identify bot by token from URL
/// - 7.3: Mark sender as Bot(bot_id)
/// - 7.4: Push message via WebSocket
/// - 7.5: Return auth error for invalid token
/// - 7.6: Return forbidden error if not subscribed
/// - 2.1, 2.2, 2.3, 2.4: Webhook management
use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::{
    error::{AppError, AppResult},
    models::{
        Bot, BotApiResponse, BotMeResponse, BotSendMessageRequest, MessageResponse,
        SetWebhookRequest,
    },
    services::{
        bot_engine::{
            dispatcher::{BotDispatcher, CommandContext},
            BotEngineService, PermissionChecker, RateLimitResult, SCOPE_SEND_MESSAGE,
        },
        ChatService, MessageService, WebSocketService,
    },
    AppState,
};

/// Create the bot API router.
/// Routes are mounted at /bot:token/* pattern.
pub fn bot_api_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/bot:token/sendMessage", post(send_message))
        .route("/bot:token/setWebhook", post(set_webhook))
        .route("/bot:token/getMe", get(get_me))
}

/// Extract and validate bot token from URL path.
///
/// # Arguments
/// * `state` - Application state with database
/// * `token` - Token extracted from URL path
///
/// # Returns
/// * `AppResult<Bot>` - The authenticated bot
/// * `AppError::InvalidToken` - If token is invalid
/// * `AppError::BotNotFound` - If no bot with this token exists
///
/// # Requirements
/// - 7.2: Identify bot by extracting and validating token
/// - 7.5: Return authentication error for invalid token
async fn extract_bot_from_token(state: &AppState, token: &str) -> AppResult<Bot> {
    // Remove leading colon if present (from :token path parameter)
    let clean_token = token.strip_prefix(':').unwrap_or(token);

    if clean_token.is_empty() {
        return Err(AppError::InvalidToken);
    }

    BotEngineService::get_bot_by_token(&state.db, clean_token)
        .await
        .map_err(|e| match e {
            AppError::BotNotFound => AppError::InvalidToken,
            other => other,
        })
}

/// Send a message to a chat.
///
/// POST /bot:token/sendMessage
///
/// # Request Body
/// ```json
/// {
///   "chat_id": "uuid",
///   "text": "message text",
///   "replyToId": "uuid" (optional),
///   "inlineKeyboard": [[{"text": "btn", "callbackData": "data"}]] (optional)
/// }
/// ```
///
/// # Requirements
/// - 7.1: Create message from bot
/// - 7.3: Mark sender as Bot(bot_id)
/// - 7.4: Push message via WebSocket
/// - 7.6: Return forbidden error if not subscribed
/// - 8.1-8.4: Rate limiting
async fn send_message(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Json(body): Json<BotSendMessageRequest>,
) -> AppResult<Json<BotApiResponse<MessageResponse>>> {
    // 1. Validate token and get bot
    let bot = extract_bot_from_token(&state, &token).await?;

    tracing::info!(
        "Bot {} ({}) attempting to send message to chat {}",
        bot.name,
        bot.id,
        body.chat_id
    );

    // 2. Check if bot is active
    if !bot.is_active {
        tracing::debug!("Bot {} is not active", bot.id);
        return Ok(Json(BotApiResponse::error(403, "Bot is not active")));
    }
    tracing::debug!("Bot {} is active, checking rate limit...", bot.id);

    // 3. Check rate limit (Requirements 8.1-8.4)
    if let Some(ref rate_limiter) = state.rate_limiter {
        match rate_limiter.check_rate_limit(bot.id).await {
            Ok(RateLimitResult::Exceeded { retry_after }) => {
                tracing::debug!(
                    "Bot {} rate limited, retry after {} seconds",
                    bot.id,
                    retry_after
                );
                return Ok(Json(BotApiResponse::rate_limited(retry_after)));
            }
            Ok(RateLimitResult::Allowed { remaining: _ }) => {
                tracing::debug!("Bot {} rate limit OK", bot.id);
            }
            Err(e) => {
                tracing::warn!("Rate limit check failed: {}. Allowing request.", e);
            }
        }
    }

    tracing::debug!(
        "Checking chat subscription for bot {} in chat {}...",
        bot.id,
        body.chat_id
    );
    // 4. Check chat subscription
    let is_subscribed = PermissionChecker::check_chat_subscription(&state.db, bot.id, body.chat_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check chat subscription: {:?}", e);
            e
        })?;
    if !is_subscribed {
        tracing::debug!("Bot {} not subscribed to chat {}", bot.id, body.chat_id);
        return Ok(Json(BotApiResponse::error(
            403,
            "Bot not subscribed to chat",
        )));
    }
    tracing::debug!("Bot {} is subscribed to chat {}", bot.id, body.chat_id);

    // 5. Check send_message permission
    tracing::debug!("Checking send_message permission for bot {}...", bot.id);
    let has_permission = PermissionChecker::check_scope(&state.db, bot.id, SCOPE_SEND_MESSAGE)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check send_message permission: {:?}", e);
            e
        })?;
    if !has_permission {
        tracing::debug!("Bot {} missing send_message permission", bot.id);
        return Ok(Json(BotApiResponse::error(
            403,
            "Permission denied: missing send_message scope",
        )));
    }
    tracing::debug!(
        "Bot {} has send_message permission, sending message...",
        bot.id
    );

    // 6. Create message with Bot sender using MessageService
    let mut message = MessageService::send_bot_message(
        &state.db,
        body.chat_id,
        bot.id,
        body.text.clone(),
        body.reply_to_id,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to send bot message: {:?}", e);
        e
    })?;
    tracing::debug!("Bot message created with id {}", message.id);

    // Add inline keyboard if provided
    message.inline_keyboard = body.inline_keyboard.clone();

    // 7. Broadcast via WebSocket to users
    let participant_ids = ChatService::get_participant_ids(&state.db, body.chat_id).await?;
    WebSocketService::broadcast_new_message(
        &state.ws_manager,
        message.clone(),
        &participant_ids,
        bot.id, // Use bot.id as sender for exclusion
    )
    .await;

    // 8. Dispatch to other bots in the chat (bot-to-bot messaging)
    // Get all bots subscribed to this chat, excluding the sender bot to prevent loops
    let other_bots = BotEngineService::get_chat_bots(&state.db, body.chat_id)
        .await?
        .into_iter()
        .filter(|b| b.id != bot.id) // Anti-loop: exclude sender bot
        .collect::<Vec<_>>();

    if !other_bots.is_empty() {
        let ctx = CommandContext {
            user_id: bot.id, // Sender is a bot
            chat_id: body.chat_id,
            message_id: message.id,
            text: body.text.clone(),
        };

        let dispatcher = BotDispatcher::new(state.ws_manager.clone());
        if let Err(e) = dispatcher.dispatch(&ctx, other_bots).await {
            tracing::warn!("Failed to dispatch bot message to other bots: {}", e);
        }
    }

    Ok(Json(BotApiResponse::success(message)))
}

/// Set webhook URL for the bot.
///
/// POST /bot:token/setWebhook
///
/// # Request Body
/// ```json
/// {
///   "url": "https://example.com/webhook" (or null to clear)
/// }
/// ```
///
/// # Requirements
/// - 2.1: Store webhook_url for bot when valid URL provided
/// - 2.2: Clear webhook_url when empty/null URL provided
/// - 2.3: Return error for invalid URL format
/// - 2.4: Send test request to verify connectivity (TODO)
async fn set_webhook(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Json(body): Json<SetWebhookRequest>,
) -> AppResult<Json<BotApiResponse<bool>>> {
    // 1. Validate token and get bot
    let bot = extract_bot_from_token(&state, &token).await?;

    // 2. Validate URL if provided
    if let Some(ref url) = body.url {
        if !url.is_empty() {
            // Basic URL validation
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Ok(Json(BotApiResponse::error(
                    400,
                    "Invalid webhook URL: must start with http:// or https://",
                )));
            }

            // Parse URL to validate format
            if url::Url::parse(url).is_err() {
                return Ok(Json(BotApiResponse::error(
                    400,
                    "Invalid webhook URL format",
                )));
            }

            // TODO: Send test request to verify connectivity (Requirement 2.4)
            // For now, we just validate the URL format
        }
    }

    // 3. Update webhook URL
    let webhook_url = body.url.filter(|u| !u.is_empty());

    sqlx::query("UPDATE bots SET webhook_url = $1, updated_at = NOW() WHERE id = $2")
        .bind(&webhook_url)
        .bind(bot.id)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(BotApiResponse::success(true)))
}

/// Get bot information.
///
/// GET /bot:token/getMe
///
/// # Returns
/// Bot information including id, name, and is_active status.
///
/// # Requirements
/// - 7.2: Identify bot by token
async fn get_me(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> AppResult<Json<BotApiResponse<BotMeResponse>>> {
    // Validate token and get bot
    let bot = extract_bot_from_token(&state, &token).await?;

    Ok(Json(BotApiResponse::success(BotMeResponse::from(bot))))
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_token_extraction_removes_colon() {
        // Test that colon prefix is properly handled
        let token_with_colon = ":abc123:xyz";
        let clean = token_with_colon
            .strip_prefix(':')
            .unwrap_or(token_with_colon);
        assert_eq!(clean, "abc123:xyz");

        let token_without_colon = "abc123:xyz";
        let clean = token_without_colon
            .strip_prefix(':')
            .unwrap_or(token_without_colon);
        assert_eq!(clean, "abc123:xyz");
    }
}
