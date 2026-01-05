use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::InlineButton;

/// Bot entity stored in the database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Bot {
    pub id: Uuid,
    pub name: String,
    pub username: Option<String>,
    pub token: String,
    pub owner_id: Uuid,
    pub webhook_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Bot permission record linking a bot to a scope
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BotPermission {
    pub bot_id: Uuid,
    pub scope: String,
}

/// Bot chat subscription record linking a bot to a chat
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BotChat {
    pub bot_id: Uuid,
    pub chat_id: Uuid,
    pub added_at: DateTime<Utc>,
}

/// Response type for bot information (excludes sensitive data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotResponse {
    pub id: Uuid,
    pub name: String,
    pub username: Option<String>,
    pub token: String,
    #[serde(rename = "webhookUrl")]
    pub webhook_url: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

impl From<Bot> for BotResponse {
    fn from(bot: Bot) -> Self {
        Self {
            id: bot.id,
            name: bot.name,
            username: bot.username,
            token: bot.token,
            webhook_url: bot.webhook_url,
            is_active: bot.is_active,
            created_at: bot.created_at,
        }
    }
}

/// Public bot info (without token, for non-owners)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotPublicResponse {
    pub id: Uuid,
    pub name: String,
    pub username: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

impl From<Bot> for BotPublicResponse {
    fn from(bot: Bot) -> Self {
        Self {
            id: bot.id,
            name: bot.name,
            username: bot.username,
            is_active: bot.is_active,
        }
    }
}

/// Request to create a new bot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBotRequest {
    pub name: String,
    pub username: Option<String>,
}

/// Request to update bot settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBotRequest {
    pub name: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
}

/// Request to set webhook URL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetWebhookRequest {
    pub url: Option<String>,
}

/// Request for bot to send a message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotSendMessageRequest {
    pub chat_id: Uuid,
    pub text: String,
    #[serde(rename = "replyToId")]
    pub reply_to_id: Option<Uuid>,
    #[serde(rename = "inlineKeyboard")]
    pub inline_keyboard: Option<Vec<Vec<InlineButton>>>,
}

/// Webhook payload sent to bot's webhook URL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookPayload {
    #[serde(rename = "updateId")]
    pub update_id: Uuid,
    pub message: WebhookMessage,
}

/// Message data in webhook payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookMessage {
    #[serde(rename = "messageId")]
    pub message_id: Uuid,
    pub chat: WebhookChat,
    pub from: WebhookUser,
    pub text: String,
}

/// Chat info in webhook payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookChat {
    pub id: Uuid,
}

/// User info in webhook payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookUser {
    pub id: Uuid,
}

/// Bot API response wrapper (Telegram-style)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotApiResponse<T> {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<T>,
    #[serde(rename = "errorCode", skip_serializing_if = "Option::is_none")]
    pub error_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl<T> BotApiResponse<T> {
    pub fn success(result: T) -> Self {
        Self {
            ok: true,
            result: Some(result),
            error_code: None,
            description: None,
        }
    }

    pub fn error(code: i32, description: &str) -> Self {
        Self {
            ok: false,
            result: None,
            error_code: Some(code),
            description: Some(description.to_string()),
        }
    }

    /// Create a rate limit exceeded response (Requirement 8.3)
    pub fn rate_limited(retry_after: u32) -> Self {
        Self {
            ok: false,
            result: None,
            error_code: Some(429),
            description: Some(format!("Rate limit exceeded. Retry after {} seconds.", retry_after)),
        }
    }
}

/// getMe response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotMeResponse {
    pub id: Uuid,
    pub name: String,
    pub username: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

impl From<Bot> for BotMeResponse {
    fn from(bot: Bot) -> Self {
        Self {
            id: bot.id,
            name: bot.name,
            username: bot.username,
            is_active: bot.is_active,
        }
    }
}
