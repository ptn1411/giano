use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::MessageResponse;

// ==================== Bot WebSocket Events ====================

/// Bot-specific server events sent to connected bots
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum BotServerEvent {
    /// Update sent to bot (message in subscribed chat)
    BotUpdate {
        #[serde(rename = "updateId")]
        update_id: Uuid,
        message: BotUpdateMessage,
    },
    /// Bot authenticated successfully
    BotConnected {
        #[serde(rename = "botId")]
        bot_id: Uuid,
        #[serde(rename = "botName")]
        bot_name: String,
    },
    /// Error event for bots
    BotError { code: String, message: String },
}

/// Message data in bot update (matches webhook payload format per Requirement 9.6)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotUpdateMessage {
    #[serde(rename = "messageId")]
    pub message_id: Uuid,
    pub chat: BotUpdateChat,
    pub from: BotUpdateUser,
    pub text: String,
}

/// Chat info in bot update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotUpdateChat {
    pub id: Uuid,
}

/// User info in bot update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotUpdateUser {
    pub id: Uuid,
    /// Username of the sender (user or bot)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
}

// ==================== User WebSocket Events ====================

/// Events sent from server to client
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum ServerEvent {
    /// New message received
    NewMessage { message: MessageResponse },
    /// Message updated (edited)
    MessageUpdated { message: MessageResponse },
    /// Message deleted
    MessageDeleted {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
        #[serde(rename = "messageId")]
        message_id: Uuid,
    },
    /// Message pinned/unpinned
    MessagePinned {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
        #[serde(rename = "messageId")]
        message_id: Uuid,
        #[serde(rename = "isPinned")]
        is_pinned: bool,
    },
    /// Reaction added/removed
    ReactionUpdated { message: MessageResponse },
    /// User typing indicator
    Typing {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
        #[serde(rename = "userId")]
        user_id: Uuid,
        #[serde(rename = "userName")]
        user_name: String,
        #[serde(rename = "isTyping")]
        is_typing: bool,
    },
    /// User status change (online/offline)
    UserStatus {
        #[serde(rename = "userId")]
        user_id: Uuid,
        status: String,
        #[serde(rename = "lastSeen")]
        last_seen: Option<DateTime<Utc>>,
    },
    /// Message delivery status update
    MessageStatus {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
        #[serde(rename = "messageId")]
        message_id: Uuid,
        status: String,
    },
    /// Message read receipt
    MessageRead {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
        #[serde(rename = "messageId")]
        message_id: Uuid,
        #[serde(rename = "readBy")]
        read_by: ReadByInfo,
    },
    /// Error event
    Error { code: String, message: String },
    /// Connection established
    Connected {
        #[serde(rename = "userId")]
        user_id: Uuid,
    },
    /// Incoming call notification
    IncomingCall {
        #[serde(rename = "callId")]
        call_id: Uuid,
        #[serde(rename = "callerId")]
        caller_id: Uuid,
        #[serde(rename = "callerName")]
        caller_name: String,
        #[serde(rename = "callerAvatar")]
        caller_avatar: Option<String>,
        #[serde(rename = "chatId")]
        chat_id: Uuid,
        #[serde(rename = "callType")]
        call_type: String, // "voice" | "video"
    },
    /// Call accepted - both parties should join mediasoup room
    CallAccepted {
        #[serde(rename = "callId")]
        call_id: Uuid,
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "mediasoupUrl")]
        mediasoup_url: String,
    },
    /// Call declined
    CallDeclined {
        #[serde(rename = "callId")]
        call_id: Uuid,
    },
    /// Call ended
    CallEnded {
        #[serde(rename = "callId")]
        call_id: Uuid,
        reason: String, // "ended" | "timeout" | "error"
    },
    /// User busy (already in another call)
    UserBusy {
        #[serde(rename = "callId")]
        call_id: Uuid,
    },
    /// Call initiated - sent to caller with real call ID
    CallInitiated {
        #[serde(rename = "callId")]
        call_id: Uuid,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadByInfo {
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[serde(rename = "readAt")]
    pub read_at: DateTime<Utc>,
}

/// Events sent from client to server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum ClientEvent {
    /// Start typing in a chat
    StartTyping {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
    },
    /// Stop typing in a chat
    StopTyping {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
    },
    /// Subscribe to a chat room
    JoinChat {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
    },
    /// Unsubscribe from a chat room
    LeaveChat {
        #[serde(rename = "chatId")]
        chat_id: Uuid,
    },
    /// Ping to keep connection alive
    Ping,
    /// Initiate a call
    InitiateCall {
        #[serde(rename = "targetUserId")]
        target_user_id: Uuid,
        #[serde(rename = "chatId")]
        chat_id: Uuid,
        #[serde(rename = "callType")]
        call_type: String, // "voice" | "video"
    },
    /// Accept incoming call
    AcceptCall {
        #[serde(rename = "callId")]
        call_id: Uuid,
    },
    /// Decline incoming call
    DeclineCall {
        #[serde(rename = "callId")]
        call_id: Uuid,
    },
    /// End ongoing call
    EndCall {
        #[serde(rename = "callId")]
        call_id: Uuid,
    },
}
