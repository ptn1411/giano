use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token: String,
    pub refresh_token: Option<String>,
    pub refresh_expires_at: Option<DateTime<Utc>>,
    pub device_name: Option<String>,
    pub device_type: Option<String>,
    pub location: Option<String>,
    pub ip_address: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub last_active: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceResponse {
    pub id: Uuid,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub device_type: Option<String>,
    pub location: Option<String>,
    #[serde(rename = "lastActive")]
    pub last_active: DateTime<Utc>,
    #[serde(rename = "isCurrent")]
    pub is_current: bool,
}
