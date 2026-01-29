use crate::{
    db::Database,
    error::{AppError, AppResult},
    models::{InlineButton, Message, MessageResponse},
    services::{ChatService, MessageService},
};
use chrono::Utc;
use uuid::Uuid;

pub struct BotService;

impl BotService {
    /// Process a message sent to a bot and generate a response
    pub async fn process_bot_message(
        db: &Database,
        bot_id: Uuid,
        chat_id: Uuid,
        user_id: Uuid,
        message_text: &str,
    ) -> AppResult<MessageResponse> {
        // Verify the bot exists and is actually a bot
        Self::verify_bot(db, bot_id).await?;

        // Verify user is a participant in the chat
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        // Generate bot response based on message content
        let (response_text, inline_keyboard) = Self::generate_bot_response(message_text);

        // Create the bot's response message
        let message = Self::create_bot_message(db, chat_id, bot_id, &response_text, inline_keyboard).await?;

        Ok(message)
    }

    /// Handle inline keyboard button callback
    pub async fn handle_callback(
        db: &Database,
        bot_id: Uuid,
        chat_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
        callback_data: &str,
    ) -> AppResult<MessageResponse> {
        // Verify the bot exists and is actually a bot
        Self::verify_bot(db, bot_id).await?;

        // Verify user is a participant in the chat
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        // Validate that the callback refers to a message in this chat.
        // (Prevents users from forging callbacks with arbitrary message IDs.)
        let original: Option<Message> = sqlx::query_as(
            "SELECT * FROM messages WHERE id = $1 AND chat_id = $2",
        )
        .bind(message_id)
        .bind(chat_id)
        .fetch_optional(&db.pool)
        .await?;

        let original = original.ok_or(AppError::MessageNotFound)?;

        // Optionally require the original message to be from this bot.
        if original.sender_id != bot_id {
            return Err(AppError::BadRequest("Invalid callback: message is not from this bot".to_string()));
        }

        // Generate response based on callback data
        let (response_text, inline_keyboard) = Self::generate_callback_response(callback_data);

        // Create the bot's response message
        let message = Self::create_bot_message(db, chat_id, bot_id, &response_text, inline_keyboard).await?;

        Ok(message)
    }


    /// Verify that the given user ID is a bot
    async fn verify_bot(db: &Database, bot_id: Uuid) -> AppResult<()> {
        let is_bot: Option<(bool,)> = sqlx::query_as("SELECT is_bot FROM users WHERE id = $1")
            .bind(bot_id)
            .fetch_optional(&db.pool)
            .await?;

        match is_bot {
            Some((true,)) => Ok(()),
            Some((false,)) => Err(AppError::BotNotFound),
            None => Err(AppError::BotNotFound),
        }
    }

    /// Create a message from the bot
    async fn create_bot_message(
        db: &Database,
        chat_id: Uuid,
        bot_id: Uuid,
        text: &str,
        inline_keyboard: Option<Vec<Vec<InlineButton>>>,
    ) -> AppResult<MessageResponse> {
        // Create the message
        let message: Message = sqlx::query_as(
            r#"
            INSERT INTO messages (chat_id, sender_id, text, delivery_status)
            VALUES ($1, $2, $3, 'sent')
            RETURNING *
            "#,
        )
        .bind(chat_id)
        .bind(bot_id)
        .bind(text)
        .fetch_one(&db.pool)
        .await?;

        // Update chat timestamp
        sqlx::query("UPDATE chats SET updated_at = NOW() WHERE id = $1")
            .bind(chat_id)
            .execute(&db.pool)
            .await?;

        // Build the response with inline keyboard if present
        let mut response = MessageService::build_message_response_public(db, message).await?;
        
        // Add inline keyboard to response if present
        if let Some(keyboard) = inline_keyboard {
            response.inline_keyboard = Some(keyboard);
        }

        Ok(response)
    }

    /// Generate a bot response based on the input message
    fn generate_bot_response(message: &str) -> (String, Option<Vec<Vec<InlineButton>>>) {
        let message_lower = message.to_lowercase();

        if message_lower.contains("help") || message_lower == "/help" {
            let text = "🤖 *Bot Help*\n\n\
                Available commands:\n\
                • /start - Start the bot\n\
                • /help - Show this help message\n\
                • /stats - View your statistics\n\
                • /settings - Bot settings\n\n\
                You can also click the buttons below for quick actions.";
            
            let keyboard = vec![
                vec![
                    InlineButton {
                        text: "📊 Statistics".to_string(),
                        callback_data: Some("stats".to_string()),
                        url: None,
                    },
                    InlineButton {
                        text: "⚙️ Settings".to_string(),
                        callback_data: Some("settings".to_string()),
                        url: None,
                    },
                ],
                vec![
                    InlineButton {
                        text: "📚 Documentation".to_string(),
                        callback_data: None,
                        url: Some("https://docs.example.com".to_string()),
                    },
                ],
            ];
            
            (text.to_string(), Some(keyboard))
        } else if message_lower.contains("start") || message_lower == "/start" {
            let text = "👋 Welcome! I'm your assistant bot.\n\n\
                I can help you with various tasks. Use /help to see available commands.\n\n\
                What would you like to do?";
            
            let keyboard = vec![
                vec![
                    InlineButton {
                        text: "📊 View Stats".to_string(),
                        callback_data: Some("stats".to_string()),
                        url: None,
                    },
                    InlineButton {
                        text: "❓ Help".to_string(),
                        callback_data: Some("help".to_string()),
                        url: None,
                    },
                ],
            ];
            
            (text.to_string(), Some(keyboard))
        } else if message_lower.contains("stats") || message_lower == "/stats" {
            Self::generate_stats_response()
        } else if message_lower.contains("settings") || message_lower == "/settings" {
            Self::generate_settings_response()
        } else {
            // Default response
            let text = "I received your message. How can I help you?\n\n\
                Type /help to see available commands.";
            
            let keyboard = vec![
                vec![
                    InlineButton {
                        text: "❓ Help".to_string(),
                        callback_data: Some("help".to_string()),
                        url: None,
                    },
                ],
            ];
            
            (text.to_string(), Some(keyboard))
        }
    }


    /// Generate a response for inline keyboard callback
    fn generate_callback_response(callback_data: &str) -> (String, Option<Vec<Vec<InlineButton>>>) {
        match callback_data {
            "stats" => Self::generate_stats_response(),
            "daily" => Self::generate_daily_stats_response(),
            "weekly" => Self::generate_weekly_stats_response(),
            "settings" => Self::generate_settings_response(),
            "notifications_on" | "notifications_off" => {
                Self::generate_notification_toggle_response(callback_data == "notifications_on")
            }
            "help" => Self::generate_bot_response("/help"),
            "refresh" => Self::generate_stats_response(),
            "back" => Self::generate_main_menu_response(),
            _ => {
                let text = format!("Received callback: {}\n\nThis action is not yet implemented.", callback_data);
                let keyboard = vec![
                    vec![
                        InlineButton {
                            text: "🔙 Back".to_string(),
                            callback_data: Some("back".to_string()),
                            url: None,
                        },
                    ],
                ];
                (text, Some(keyboard))
            }
        }
    }

    fn generate_stats_response() -> (String, Option<Vec<Vec<InlineButton>>>) {
        let now = Utc::now();
        let text = format!(
            "📊 *Your Statistics*\n\n\
            📈 Messages sent: 142\n\
            📥 Messages received: 256\n\
            👥 Active chats: 8\n\
            ⏱️ Time active: 24h 30m\n\n\
            Last updated: {}",
            now.format("%Y-%m-%d %H:%M UTC")
        );
        
        let keyboard = vec![
            vec![
                InlineButton {
                    text: "📅 Daily".to_string(),
                    callback_data: Some("daily".to_string()),
                    url: None,
                },
                InlineButton {
                    text: "📆 Weekly".to_string(),
                    callback_data: Some("weekly".to_string()),
                    url: None,
                },
            ],
            vec![
                InlineButton {
                    text: "🔄 Refresh".to_string(),
                    callback_data: Some("refresh".to_string()),
                    url: None,
                },
                InlineButton {
                    text: "🔙 Back".to_string(),
                    callback_data: Some("back".to_string()),
                    url: None,
                },
            ],
        ];
        
        (text, Some(keyboard))
    }

    fn generate_daily_stats_response() -> (String, Option<Vec<Vec<InlineButton>>>) {
        let text = "📅 *Daily Statistics*\n\n\
            Today's activity:\n\
            • Messages: 23\n\
            • Reactions: 15\n\
            • Media shared: 3\n\n\
            Peak activity: 2:00 PM - 4:00 PM";
        
        let keyboard = vec![
            vec![
                InlineButton {
                    text: "📊 Overview".to_string(),
                    callback_data: Some("stats".to_string()),
                    url: None,
                },
                InlineButton {
                    text: "📆 Weekly".to_string(),
                    callback_data: Some("weekly".to_string()),
                    url: None,
                },
            ],
            vec![
                InlineButton {
                    text: "🔙 Back".to_string(),
                    callback_data: Some("back".to_string()),
                    url: None,
                },
            ],
        ];
        
        (text.to_string(), Some(keyboard))
    }

    fn generate_weekly_stats_response() -> (String, Option<Vec<Vec<InlineButton>>>) {
        let text = "📆 *Weekly Statistics*\n\n\
            This week's activity:\n\
            • Messages: 156\n\
            • Reactions: 89\n\
            • Media shared: 24\n\
            • New contacts: 2\n\n\
            Most active day: Wednesday";
        
        let keyboard = vec![
            vec![
                InlineButton {
                    text: "📊 Overview".to_string(),
                    callback_data: Some("stats".to_string()),
                    url: None,
                },
                InlineButton {
                    text: "📅 Daily".to_string(),
                    callback_data: Some("daily".to_string()),
                    url: None,
                },
            ],
            vec![
                InlineButton {
                    text: "🔙 Back".to_string(),
                    callback_data: Some("back".to_string()),
                    url: None,
                },
            ],
        ];
        
        (text.to_string(), Some(keyboard))
    }

    fn generate_settings_response() -> (String, Option<Vec<Vec<InlineButton>>>) {
        let text = "⚙️ *Bot Settings*\n\n\
            Configure your bot preferences:\n\n\
            🔔 Notifications: Enabled\n\
            🌐 Language: English\n\
            🕐 Timezone: UTC";
        
        let keyboard = vec![
            vec![
                InlineButton {
                    text: "🔔 Toggle Notifications".to_string(),
                    callback_data: Some("notifications_off".to_string()),
                    url: None,
                },
            ],
            vec![
                InlineButton {
                    text: "🔙 Back".to_string(),
                    callback_data: Some("back".to_string()),
                    url: None,
                },
            ],
        ];
        
        (text.to_string(), Some(keyboard))
    }

    fn generate_notification_toggle_response(enabled: bool) -> (String, Option<Vec<Vec<InlineButton>>>) {
        let status = if enabled { "Enabled ✅" } else { "Disabled ❌" };
        let toggle_text = if enabled { "🔕 Disable" } else { "🔔 Enable" };
        let toggle_callback = if enabled { "notifications_off" } else { "notifications_on" };
        
        let text = format!(
            "⚙️ *Bot Settings*\n\n\
            🔔 Notifications: {}\n\n\
            Your notification preference has been updated.",
            status
        );
        
        let keyboard = vec![
            vec![
                InlineButton {
                    text: toggle_text.to_string(),
                    callback_data: Some(toggle_callback.to_string()),
                    url: None,
                },
            ],
            vec![
                InlineButton {
                    text: "🔙 Back".to_string(),
                    callback_data: Some("back".to_string()),
                    url: None,
                },
            ],
        ];
        
        (text, Some(keyboard))
    }

    fn generate_main_menu_response() -> (String, Option<Vec<Vec<InlineButton>>>) {
        let text = "🤖 *Main Menu*\n\n\
            What would you like to do?";
        
        let keyboard = vec![
            vec![
                InlineButton {
                    text: "📊 Statistics".to_string(),
                    callback_data: Some("stats".to_string()),
                    url: None,
                },
                InlineButton {
                    text: "⚙️ Settings".to_string(),
                    callback_data: Some("settings".to_string()),
                    url: None,
                },
            ],
            vec![
                InlineButton {
                    text: "❓ Help".to_string(),
                    callback_data: Some("help".to_string()),
                    url: None,
                },
            ],
        ];
        
        (text.to_string(), Some(keyboard))
    }
}
