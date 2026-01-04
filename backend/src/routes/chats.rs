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
    models::{BotPublicResponse, ChatDetailResponse, ChatResponse, MessageResponse},
    routes::auth::get_current_user_id,
    services::{bot_engine::BotEngineService, ChatService, MessageService, MessageProcessor, WebSocketService, message::{AttachmentInput, ReplyToInput}},
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_chats))
        .route("/group", post(create_group))
        .route("/private", post(create_private_chat))
        .route("/:chat_id", get(get_chat).delete(delete_chat))
        .route("/:chat_id/read", post(mark_as_read))
        .route("/:chat_id/messages", get(get_messages).post(send_message).delete(clear_messages))
        .route("/:chat_id/messages/:message_id", axum::routing::put(edit_message).delete(delete_message))
        .route("/:chat_id/messages/:message_id/reactions", post(toggle_reaction))
        .route("/:chat_id/messages/:message_id/pin", post(pin_message).delete(unpin_message))
        // Bot-Chat management routes (Requirements 4.1, 4.2)
        .route("/:chat_id/bots", get(list_chat_bots).post(add_bot_to_chat))
        .route("/:chat_id/bots/:bot_id", axum::routing::delete(remove_bot_from_chat))
}

#[derive(Debug, Deserialize)]
pub struct ChatsQuery {
    search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ChatsResponse {
    chats: Vec<ChatResponse>,
}

async fn get_chats(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ChatsQuery>,
) -> AppResult<Json<ChatsResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let chats = ChatService::get_user_chats(&state.db, user_id, query.search.as_deref()).await?;

    Ok(Json(ChatsResponse { chats }))
}

#[derive(Debug, Serialize)]
pub struct ChatDetailResponseWrapper {
    chat: ChatDetailResponse,
}

async fn get_chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<ChatDetailResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let chat = ChatService::get_chat_by_id(&state.db, chat_id, user_id).await?;

    Ok(Json(ChatDetailResponseWrapper { chat }))
}

async fn delete_chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<SimpleMessage>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    ChatService::delete_chat(&state.db, chat_id, user_id).await?;

    Ok(Json(SimpleMessage {
        message: "Chat deleted successfully".to_string(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateGroupRequest {
    name: String,
    #[serde(rename = "participantIds")]
    participant_ids: Vec<Uuid>,
}

async fn create_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateGroupRequest>,
) -> AppResult<Json<ChatDetailResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let chat = ChatService::create_group(&state.db, user_id, &req.name, req.participant_ids).await?;

    Ok(Json(ChatDetailResponseWrapper { chat }))
}

#[derive(Debug, Deserialize)]
pub struct CreatePrivateChatRequest {
    #[serde(rename = "userId")]
    user_id: Uuid,
}

async fn create_private_chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreatePrivateChatRequest>,
) -> AppResult<Json<ChatDetailResponseWrapper>> {
    let current_user_id = get_current_user_id(&state, &headers).await?;

    let chat = ChatService::create_or_get_private_chat(&state.db, current_user_id, req.user_id).await?;

    Ok(Json(ChatDetailResponseWrapper { chat }))
}

#[derive(Debug, Serialize)]
pub struct SimpleMessage {
    message: String,
}

async fn mark_as_read(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<SimpleMessage>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    // Get unread messages before marking as read (to notify senders)
    let unread_messages: Vec<(Uuid, Uuid)> = sqlx::query_as(
        r#"
        SELECT id, sender_id FROM messages
        WHERE chat_id = $1 AND sender_id != $2 AND is_read = false
        "#,
    )
    .bind(chat_id)
    .bind(user_id)
    .fetch_all(&state.db.pool)
    .await?;

    ChatService::mark_as_read(&state.db, chat_id, user_id).await?;

    // Broadcast message read status to senders
    let read_at = chrono::Utc::now();
    for (message_id, sender_id) in unread_messages {
        WebSocketService::broadcast_message_read(
            &state.ws_manager,
            chat_id,
            message_id,
            user_id,
            read_at,
            sender_id,
        )
        .await;
    }

    Ok(Json(SimpleMessage {
        message: "Chat marked as read".to_string(),
    }))
}

// Message routes
#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    limit: Option<i64>,
    before: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct MessagesResponse {
    messages: Vec<MessageResponse>,
    #[serde(rename = "hasMore")]
    has_more: bool,
}

async fn get_messages(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
    Query(query): Query<MessagesQuery>,
) -> AppResult<Json<MessagesResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let (messages, has_more) = MessageService::get_messages(
        &state.db,
        chat_id,
        user_id,
        query.limit.unwrap_or(50),
        query.before,
    )
    .await?;

    Ok(Json(MessagesResponse { messages, has_more }))
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    text: Option<String>,
    #[serde(default)]
    attachments: Vec<AttachmentRequest>,
    #[serde(rename = "replyTo")]
    reply_to: Option<ReplyToRequest>,
}

#[derive(Debug, Deserialize)]
pub struct AttachmentRequest {
    #[serde(rename = "type")]
    attachment_type: String,
    name: String,
    size: i64,
    url: String,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReplyToRequest {
    id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct MessageResponseWrapper {
    message: MessageResponse,
}

async fn send_message(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> AppResult<Json<MessageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let attachments: Vec<AttachmentInput> = req
        .attachments
        .into_iter()
        .map(|a| AttachmentInput {
            attachment_type: a.attachment_type,
            name: a.name,
            size: a.size,
            url: a.url,
            mime_type: a.mime_type,
        })
        .collect();

    let reply_to = req.reply_to.map(|r| ReplyToInput { id: r.id });

    let message = MessageService::send_message(
        &state.db,
        chat_id,
        user_id,
        req.text,
        attachments,
        reply_to,
    )
    .await?;

    // Broadcast new message to all chat participants via WebSocket
    let participant_ids = ChatService::get_participant_ids(&state.db, chat_id).await?;
    WebSocketService::broadcast_new_message(
        &state.ws_manager,
        message.clone(),
        &participant_ids,
        user_id,
    )
    .await;

    // Process message for bot commands (Requirements 6.1, 6.2)
    // This will parse commands and dispatch to subscribed bots
    if let Err(e) = MessageProcessor::process_message(
        &state.db,
        state.ws_manager.clone(),
        &message,
    ).await {
        tracing::error!("Failed to process message for bots: {}", e);
    }

    Ok(Json(MessageResponseWrapper { message }))
}

#[derive(Debug, Deserialize)]
pub struct EditMessageRequest {
    text: String,
}

async fn edit_message(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((chat_id, message_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<EditMessageRequest>,
) -> AppResult<Json<MessageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let message = MessageService::edit_message(&state.db, chat_id, message_id, user_id, &req.text).await?;

    // Broadcast message updated to all chat participants via WebSocket
    let participant_ids = ChatService::get_participant_ids(&state.db, chat_id).await?;
    WebSocketService::broadcast_message_updated(
        &state.ws_manager,
        message.clone(),
        &participant_ids,
        user_id,
    )
    .await;

    Ok(Json(MessageResponseWrapper { message }))
}

async fn delete_message(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((chat_id, message_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<SimpleMessage>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    MessageService::delete_message(&state.db, chat_id, message_id, user_id).await?;

    // Broadcast message deleted to all chat participants via WebSocket
    let participant_ids = ChatService::get_participant_ids(&state.db, chat_id).await?;
    WebSocketService::broadcast_message_deleted(
        &state.ws_manager,
        chat_id,
        message_id,
        &participant_ids,
        user_id,
    )
    .await;

    Ok(Json(SimpleMessage {
        message: "Message deleted successfully".to_string(),
    }))
}

async fn clear_messages(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<SimpleMessage>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    MessageService::clear_chat_messages(&state.db, chat_id, user_id).await?;

    Ok(Json(SimpleMessage {
        message: "All messages cleared successfully".to_string(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct ReactionRequest {
    emoji: String,
}

async fn toggle_reaction(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((chat_id, message_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<ReactionRequest>,
) -> AppResult<Json<MessageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let message = MessageService::toggle_reaction(&state.db, chat_id, message_id, user_id, &req.emoji).await?;

    // Broadcast reaction updated to all chat participants via WebSocket
    let participant_ids = ChatService::get_participant_ids(&state.db, chat_id).await?;
    WebSocketService::broadcast_reaction_updated(
        &state.ws_manager,
        message.clone(),
        &participant_ids,
        user_id,
    )
    .await;

    Ok(Json(MessageResponseWrapper { message }))
}

async fn pin_message(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((chat_id, message_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<MessageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let message = MessageService::pin_message(&state.db, chat_id, message_id, user_id).await?;

    // Broadcast message pinned to all chat participants via WebSocket
    let participant_ids = ChatService::get_participant_ids(&state.db, chat_id).await?;
    WebSocketService::broadcast_message_pinned(
        &state.ws_manager,
        chat_id,
        message_id,
        true,
        &participant_ids,
        user_id,
    )
    .await;

    Ok(Json(MessageResponseWrapper { message }))
}

async fn unpin_message(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((chat_id, message_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<MessageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    let message = MessageService::unpin_message(&state.db, chat_id, message_id, user_id).await?;

    // Broadcast message unpinned to all chat participants via WebSocket
    let participant_ids = ChatService::get_participant_ids(&state.db, chat_id).await?;
    WebSocketService::broadcast_message_pinned(
        &state.ws_manager,
        chat_id,
        message_id,
        false,
        &participant_ids,
        user_id,
    )
    .await;

    Ok(Json(MessageResponseWrapper { message }))
}


// ==================== Bot-Chat Management Routes ====================
// Requirements: 4.1, 4.2

/// Request to add a bot to a chat
#[derive(Debug, Deserialize)]
pub struct AddBotToChatRequest {
    #[serde(rename = "botId")]
    bot_id: Uuid,
}

/// Response wrapper for a list of bots in a chat
#[derive(Debug, Serialize)]
pub struct ChatBotsResponse {
    bots: Vec<BotPublicResponse>,
}

/// Response wrapper for bot-chat operation
#[derive(Debug, Serialize)]
pub struct BotChatOperationResponse {
    success: bool,
    message: String,
}

/// Add a bot to a chat.
///
/// POST /api/v1/chats/:chat_id/bots
///
/// # Request Body
/// ```json
/// {
///   "botId": "uuid"
/// }
/// ```
///
/// # Requirements
/// - 4.1: Create a bot_chats record linking the bot and chat
async fn add_bot_to_chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
    Json(req): Json<AddBotToChatRequest>,
) -> AppResult<Json<BotChatOperationResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    // Verify user is a participant of the chat (authorization)
    let is_participant = ChatService::is_participant(&state.db, chat_id, user_id).await?;
    if !is_participant {
        return Err(crate::error::AppError::AccessDenied);
    }

    // Add bot to chat
    BotEngineService::add_bot_to_chat(&state.db, req.bot_id, chat_id).await?;

    Ok(Json(BotChatOperationResponse {
        success: true,
        message: "Bot added to chat successfully".to_string(),
    }))
}

/// Remove a bot from a chat.
///
/// DELETE /api/v1/chats/:chat_id/bots/:bot_id
///
/// # Requirements
/// - 4.2: Delete the bot_chats record
async fn remove_bot_from_chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((chat_id, bot_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<BotChatOperationResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    // Verify user is a participant of the chat (authorization)
    let is_participant = ChatService::is_participant(&state.db, chat_id, user_id).await?;
    if !is_participant {
        return Err(crate::error::AppError::AccessDenied);
    }

    // Remove bot from chat
    let removed = BotEngineService::remove_bot_from_chat(&state.db, bot_id, chat_id).await?;

    if removed {
        Ok(Json(BotChatOperationResponse {
            success: true,
            message: "Bot removed from chat successfully".to_string(),
        }))
    } else {
        Ok(Json(BotChatOperationResponse {
            success: false,
            message: "Bot was not in this chat".to_string(),
        }))
    }
}

/// List all bots in a chat.
///
/// GET /api/v1/chats/:chat_id/bots
///
/// # Returns
/// List of bots subscribed to the chat.
async fn list_chat_bots(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(chat_id): Path<Uuid>,
) -> AppResult<Json<ChatBotsResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    // Verify user is a participant of the chat (authorization)
    let is_participant = ChatService::is_participant(&state.db, chat_id, user_id).await?;
    if !is_participant {
        return Err(crate::error::AppError::AccessDenied);
    }

    // Get bots in chat
    let bots = BotEngineService::get_chat_bots(&state.db, chat_id).await?;
    let bot_responses: Vec<BotPublicResponse> = bots.into_iter().map(BotPublicResponse::from).collect();

    Ok(Json(ChatBotsResponse { bots: bot_responses }))
}
