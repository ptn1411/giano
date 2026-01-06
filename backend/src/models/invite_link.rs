use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InviteLink {
    pub id: Uuid,
    pub code: String,
    pub link_type: String,
    pub chat_id: Option<Uuid>,
    pub created_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub current_uses: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InviteLinkUse {
    pub id: Uuid,
    pub invite_link_id: Uuid,
    pub user_id: Uuid,
    pub used_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInviteLinkRequest {
    #[serde(rename = "type")]
    pub link_type: String, // "group" or "direct"
    #[serde(rename = "chatId")]
    pub chat_id: Option<Uuid>,
    #[serde(rename = "expiresIn")]
    pub expires_in: Option<i64>, // seconds
    #[serde(rename = "maxUses")]
    pub max_uses: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InviteLinkResponse {
    pub id: Uuid,
    pub code: String,
    #[serde(rename = "type")]
    pub link_type: String,
    #[serde(rename = "chatId")]
    pub chat_id: Option<Uuid>,
    #[serde(rename = "chatName")]
    pub chat_name: Option<String>,
    #[serde(rename = "createdBy")]
    pub created_by: Uuid,
    #[serde(rename = "creatorName")]
    pub creator_name: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<DateTime<Utc>>,
    #[serde(rename = "maxUses")]
    pub max_uses: Option<i32>,
    #[serde(rename = "currentUses")]
    pub current_uses: i32,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "url")]
    pub url: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UseInviteLinkResponse {
    #[serde(rename = "chatId")]
    pub chat_id: Uuid,
    #[serde(rename = "chatName")]
    pub chat_name: String,
    #[serde(rename = "chatType")]
    pub chat_type: String,
    pub joined: bool,
}
