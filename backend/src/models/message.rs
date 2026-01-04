use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub chat_id: Uuid,
    pub sender_id: Uuid,
    pub text: Option<String>,
    pub is_read: bool,
    pub is_edited: bool,
    pub is_pinned: bool,
    pub reply_to_id: Option<Uuid>,
    pub delivery_status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
