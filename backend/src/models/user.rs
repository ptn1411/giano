use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub name: String,
    pub username: Option<String>,
    pub avatar: Option<String>,
    pub bio: Option<String>,
    pub phone: Option<String>,
    pub status: String,
    pub last_seen: Option<DateTime<Utc>>,
    pub is_bot: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserPublic {
    pub id: Uuid,
    pub name: String,
    pub avatar: Option<String>,
    pub status: String,
    pub last_seen: Option<DateTime<Utc>>,
    pub is_bot: bool,
}

impl From<User> for UserPublic {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            status: user.status,
            last_seen: user.last_seen,
            is_bot: user.is_bot,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSession {
    pub user: UserPublic,
    pub token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "refreshExpiresAt")]
    pub refresh_expires_at: i64,
}
