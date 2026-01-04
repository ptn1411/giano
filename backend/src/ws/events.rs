use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::MessageResponse;

/// Events sent from server to client
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum ServerEvent {
    /// New message received
    NewMessage {
        message: MessageResponse,
    },
    /// Message updated (edited)
    MessageUpdated {
        message: MessageResponse,
    },
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
    ReactionUpdated {
        message: MessageResponse,
    },
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
    Error {
        code: String,
        message: String,
    },
    /// Connection established
    Connected {
        #[serde(rename = "userId")]
        user_id: Uuid,
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
}
