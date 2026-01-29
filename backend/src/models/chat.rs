use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::MessageResponse;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Chat {
    pub id: Uuid,
    #[sqlx(rename = "type")]
    pub chat_type: String,
    pub name: Option<String>,
    pub avatar: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChatParticipant {
    pub id: Uuid,
    pub chat_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub unread_count: i32,
    pub is_pinned: Option<bool>,
    pub pinned_at: Option<DateTime<Utc>>,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub chat_type: String,
    pub name: String,
    pub avatar: Option<String>,
    pub participants: Vec<Uuid>,
    #[serde(rename = "lastMessage")]
    pub last_message: Option<MessageResponse>,
    #[serde(rename = "unreadCount")]
    pub unread_count: i32,
    #[serde(rename = "isTyping")]
    pub is_typing: bool,
    #[serde(rename = "typingUser")]
    pub typing_user: Option<String>,
    #[serde(rename = "isBot")]
    pub is_bot: bool,
    #[serde(rename = "isPinned")]
    pub is_pinned: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatDetailResponse {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub chat_type: String,
    pub name: String,
    pub avatar: Option<String>,
    pub participants: Vec<Uuid>,
    #[serde(rename = "unreadCount")]
    pub unread_count: i32,
    #[serde(rename = "isTyping")]
    pub is_typing: bool,
    #[serde(rename = "isBot")]
    pub is_bot: bool,
}
