use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents the sender of a message - either a User or a Bot
/// 
/// This enum is used to distinguish between messages sent by human users
/// and messages sent by bots. The sender_id in the Message struct always
/// contains the UUID, while sender_type indicates whether it's a user or bot.
/// 
/// # Requirements
/// - 7.3: Mark the sender as Bot(bot_id) when message is created by a bot
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "id")]
pub enum MessageSender {
    /// Message sent by a human user
    User(Uuid),
    /// Message sent by a bot
    Bot(Uuid),
}

impl MessageSender {
    /// Get the UUID of the sender regardless of type
    pub fn id(&self) -> Uuid {
        match self {
            MessageSender::User(id) => *id,
            MessageSender::Bot(id) => *id,
        }
    }

    /// Check if the sender is a bot
    pub fn is_bot(&self) -> bool {
        matches!(self, MessageSender::Bot(_))
    }

    /// Check if the sender is a user
    pub fn is_user(&self) -> bool {
        matches!(self, MessageSender::User(_))
    }

    /// Create a MessageSender from sender_id and sender_type
    pub fn from_parts(sender_id: Uuid, sender_type: Option<&str>) -> Self {
        match sender_type {
            Some("bot") => MessageSender::Bot(sender_id),
            _ => MessageSender::User(sender_id),
        }
    }

    /// Get the sender type as a string for database storage
    pub fn sender_type(&self) -> &'static str {
        match self {
            MessageSender::User(_) => "user",
            MessageSender::Bot(_) => "bot",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub chat_id: Uuid,
    pub sender_id: Uuid,
    /// The type of sender: "user" or "bot"
    #[sqlx(default)]
    pub sender_type: Option<String>,
    pub text: Option<String>,
    pub is_read: bool,
    pub is_edited: bool,
    pub is_pinned: bool,
    pub reply_to_id: Option<Uuid>,
    pub delivery_status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Message {
    /// Get the MessageSender for this message
    pub fn sender(&self) -> MessageSender {
        MessageSender::from_parts(self.sender_id, self.sender_type.as_deref())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub message_id: Uuid,
    #[sqlx(rename = "type")]
    pub attachment_type: String,
    pub name: String,
    pub size: i64,
    pub url: String,
    pub mime_type: Option<String>,
    pub duration: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Reaction {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub emoji: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ReadReceipt {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub read_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentResponse {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub attachment_type: String,
    pub name: String,
    pub size: i64,
    pub url: String,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactionResponse {
    pub emoji: String,
    #[serde(rename = "userId")]
    pub user_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplyToResponse {
    pub id: Uuid,
    pub text: Option<String>,
    #[serde(rename = "senderId")]
    pub sender_id: Uuid,
    #[serde(rename = "senderName")]
    pub sender_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadByResponse {
    #[serde(rename = "userId")]
    pub user_id: Uuid,
    #[serde(rename = "readAt")]
    pub read_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageResponse {
    pub id: Uuid,
    #[serde(rename = "chatId")]
    pub chat_id: Uuid,
    #[serde(rename = "senderId")]
    pub sender_id: Uuid,
    /// The type of sender: "user" or "bot"
    #[serde(rename = "senderType")]
    pub sender_type: String,
    pub text: Option<String>,
    pub timestamp: DateTime<Utc>,
    #[serde(rename = "isRead")]
    pub is_read: bool,
    #[serde(rename = "isEdited")]
    pub is_edited: bool,
    #[serde(rename = "isPinned")]
    pub is_pinned: bool,
    pub reactions: Vec<ReactionResponse>,
    pub attachments: Vec<AttachmentResponse>,
    #[serde(rename = "replyTo")]
    pub reply_to: Option<ReplyToResponse>,
    #[serde(rename = "deliveryStatus")]
    pub delivery_status: String,
    #[serde(rename = "readBy")]
    pub read_by: Vec<ReadByResponse>,
    #[serde(rename = "inlineKeyboard", skip_serializing_if = "Option::is_none")]
    pub inline_keyboard: Option<Vec<Vec<InlineButton>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlineButton {
    pub text: String,
    #[serde(rename = "callbackData")]
    pub callback_data: Option<String>,
    pub url: Option<String>,
}
