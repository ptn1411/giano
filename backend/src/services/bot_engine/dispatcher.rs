/// Bot Dispatcher module - handles delivering updates to bots via WebSocket or webhook.
///
/// This module provides:
/// - WebSocket delivery preference (Requirement 9.4)
/// - Webhook fallback on disconnect (Requirement 9.5)
/// - Consistent payload format (Requirement 9.6)
///
/// Requirements covered: 6.2, 6.3, 6.4, 6.5, 9.2, 9.4, 9.5, 9.6
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::Bot;
use crate::ws::{BotServerEvent, BotUpdateChat, BotUpdateMessage, BotUpdateUser, WsManager};

/// Context for a command/message being dispatched to bots
#[derive(Debug, Clone)]
pub struct CommandContext {
    pub user_id: Uuid,
    /// Username of the sender (user or bot)
    pub sender_username: Option<String>,
    pub chat_id: Uuid,
    pub message_id: Uuid,
    pub text: String,
}

/// Bot Dispatcher handles delivering updates to bots
pub struct BotDispatcher {
    ws_manager: Arc<WsManager>,
    http_client: reqwest::Client,
}

impl BotDispatcher {
    /// Create a new BotDispatcher
    ///
    /// # Arguments
    /// * `ws_manager` - WebSocket manager for checking bot connections and sending events
    pub fn new(ws_manager: Arc<WsManager>) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            ws_manager,
            http_client,
        }
    }

    /// Dispatch message to all active bots subscribed to the chat
    ///
    /// # Arguments
    /// * `ctx` - Command context containing message details
    /// * `bots` - List of bots subscribed to the chat
    ///
    /// # Requirements
    /// - 6.2: Find all active bots subscribed to the chat
    /// - 6.3: Skip inactive bots
    /// - 9.4: Prefer WebSocket delivery over webhook
    pub async fn dispatch(&self, ctx: &CommandContext, bots: Vec<Bot>) -> AppResult<()> {
        for bot in bots {
            // Skip inactive bots (Requirement 6.3)
            if !bot.is_active {
                tracing::debug!("Skipping inactive bot: {}", bot.id);
                continue;
            }

            // Try WebSocket first, fallback to webhook (Requirement 9.4)
            if !self.send_via_websocket(&bot, ctx).await {
                // WebSocket delivery failed, try webhook (Requirement 9.5)
                if let Err(e) = self.send_via_webhook(&bot, ctx).await {
                    tracing::warn!(
                        "Failed to deliver update to bot {} via webhook: {}",
                        bot.id,
                        e
                    );
                }
            }
        }
        Ok(())
    }

    /// Send update to bot via WebSocket
    ///
    /// # Arguments
    /// * `bot` - The bot to send to
    /// * `ctx` - Command context
    ///
    /// # Returns
    /// * `bool` - True if sent successfully via WebSocket
    ///
    /// # Requirements
    /// - 9.2: Push message updates directly to bot's WebSocket
    /// - 9.4: Prefer WebSocket delivery
    async fn send_via_websocket(&self, bot: &Bot, ctx: &CommandContext) -> bool {
        // Check if bot has active WebSocket connection
        if !self.ws_manager.is_bot_connected(bot.id).await {
            return false;
        }

        // Create BotUpdate event (matches webhook payload format per Requirement 9.6)
        let event = BotServerEvent::BotUpdate {
            update_id: ctx.message_id,
            message: BotUpdateMessage {
                message_id: ctx.message_id,
                chat: BotUpdateChat { id: ctx.chat_id },
                from: BotUpdateUser {
                    id: ctx.user_id,
                    username: ctx.sender_username.clone(),
                },
                text: ctx.text.clone(),
            },
        };

        // Send via WebSocket
        let sent = self.ws_manager.send_to_bot(bot.id, event).await;
        if sent {
            tracing::debug!("Sent update to bot {} via WebSocket", bot.id);
        }
        sent
    }

    /// Send update to bot via webhook
    ///
    /// # Arguments
    /// * `bot` - The bot to send to
    /// * `ctx` - Command context
    ///
    /// # Requirements
    /// - 6.4: Call webhook with message payload
    /// - 6.5: Webhook payload includes update_id, message.chat.id, message.from.id, message.text
    /// - 9.5: Fallback to webhook on WebSocket disconnect
    async fn send_via_webhook(&self, bot: &Bot, ctx: &CommandContext) -> AppResult<()> {
        let webhook_url = match &bot.webhook_url {
            Some(url) if !url.is_empty() => url,
            _ => {
                tracing::debug!("Bot {} has no webhook configured", bot.id);
                return Ok(());
            }
        };

        // Create webhook payload (Requirement 6.5)
        let payload = WebhookPayload {
            update_id: ctx.message_id,
            message: WebhookMessage {
                message_id: ctx.message_id,
                chat: WebhookChat { id: ctx.chat_id },
                from: WebhookUser { id: ctx.user_id },
                text: ctx.text.clone(),
            },
        };

        // Send webhook request
        let response = self
            .http_client
            .post(webhook_url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::WebhookError(e.to_string()))?;

        if !response.status().is_success() {
            tracing::warn!(
                "Webhook to bot {} returned status {}: {}",
                bot.id,
                response.status(),
                webhook_url
            );
        } else {
            tracing::debug!("Sent update to bot {} via webhook", bot.id);
        }

        Ok(())
    }

    /// Send update to a single bot (convenience method)
    ///
    /// # Arguments
    /// * `bot` - The bot to send to
    /// * `ctx` - Command context
    ///
    /// # Returns
    /// * `AppResult<bool>` - True if delivered via WebSocket, false if via webhook
    pub async fn send_to_bot(&self, bot: &Bot, ctx: &CommandContext) -> AppResult<bool> {
        if !bot.is_active {
            return Err(AppError::BotInactive);
        }

        // Try WebSocket first
        if self.send_via_websocket(bot, ctx).await {
            return Ok(true);
        }

        // Fallback to webhook
        self.send_via_webhook(bot, ctx).await?;
        Ok(false)
    }
}

/// Webhook payload structure (matches Requirement 6.5)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebhookPayload {
    #[serde(rename = "updateId")]
    pub update_id: Uuid,
    pub message: WebhookMessage,
}

/// Message data in webhook payload
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebhookMessage {
    #[serde(rename = "messageId")]
    pub message_id: Uuid,
    pub chat: WebhookChat,
    pub from: WebhookUser,
    pub text: String,
}

/// Chat info in webhook payload
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebhookChat {
    pub id: Uuid,
}

/// User info in webhook payload
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebhookUser {
    pub id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_webhook_payload_serialization() {
        let payload = WebhookPayload {
            update_id: Uuid::new_v4(),
            message: WebhookMessage {
                message_id: Uuid::new_v4(),
                chat: WebhookChat { id: Uuid::new_v4() },
                from: WebhookUser { id: Uuid::new_v4() },
                text: "Hello, bot!".to_string(),
            },
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("updateId"));
        assert!(json.contains("messageId"));
        assert!(json.contains("chat"));
        assert!(json.contains("from"));
        assert!(json.contains("text"));
    }

    #[test]
    fn test_command_context_creation() {
        let ctx = CommandContext {
            user_id: Uuid::new_v4(),
            sender_username: Some("test_user".to_string()),
            chat_id: Uuid::new_v4(),
            message_id: Uuid::new_v4(),
            text: "/help".to_string(),
        };

        assert!(!ctx.text.is_empty());
    }
}
