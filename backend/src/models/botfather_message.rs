use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// BotFather message stored in database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BotFatherMessage {
    pub id: Uuid,
    pub user_id: Uuid,
    pub sender_type: String, // "user" or "bot"
    pub text: String,
    pub created_at: DateTime<Utc>,
}

/// Response type for BotFather message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotFatherMessageDto {
    pub id: Uuid,
    #[serde(rename = "senderId")]
    pub sender_id: String,
    pub text: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

impl BotFatherMessage {
    pub fn to_dto(&self, botfather_id: &str) -> BotFatherMessageDto {
        BotFatherMessageDto {
            id: self.id,
            sender_id: if self.sender_type == "bot" {
                botfather_id.to_string()
            } else {
                self.user_id.to_string()
            },
            text: self.text.clone(),
            created_at: self.created_at,
        }
    }
}
