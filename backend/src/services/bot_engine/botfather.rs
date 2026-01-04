/// BotFather module - System bot for managing bots via chat commands.
///
/// BotFather is a special system bot that handles commands like:
/// - /newbot - Create a new bot
/// - /mybots - List your bots
/// - /deletebot - Delete a bot
/// - /setwebhook - Set webhook URL for a bot
/// - /token - Get or regenerate bot token
/// - /help - Show available commands

use uuid::Uuid;

use crate::db::Database;
use crate::error::{AppError, AppResult};
use crate::models::CreateBotRequest;

use super::bot_service::BotEngineService;
use super::command_parser::ParsedCommand;

/// BotFather system bot ID (fixed UUID for the system)
pub const BOTFATHER_ID: &str = "00000000-0000-0000-0000-000000000001";

/// BotFather handles bot management commands.
pub struct BotFather;

/// Response from BotFather command execution
#[derive(Debug, Clone)]
pub struct BotFatherResponse {
    pub text: String,
    pub success: bool,
}

impl BotFatherResponse {
    pub fn success(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            success: true,
        }
    }

    pub fn error(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            success: false,
        }
    }
}

impl BotFather {
    /// Get BotFather's UUID
    pub fn id() -> Uuid {
        Uuid::parse_str(BOTFATHER_ID).expect("Invalid BotFather UUID")
    }

    /// Check if a command is a BotFather command
    pub fn is_botfather_command(cmd: &ParsedCommand) -> bool {
        matches!(
            cmd.command.as_str(),
            "newbot" | "mybots" | "deletebot" | "setwebhook" | "clearwebhook" 
            | "token" | "bothelp" | "addbot" | "removebot" | "botinfo"
        )
    }

    /// Handle a BotFather command
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - The user executing the command
    /// * `chat_id` - The chat where command was sent
    /// * `cmd` - The parsed command
    ///
    /// # Returns
    /// * `AppResult<Option<BotFatherResponse>>` - Response text if command was handled
    pub async fn handle_command(
        db: &Database,
        user_id: Uuid,
        chat_id: Uuid,
        cmd: &ParsedCommand,
    ) -> AppResult<Option<BotFatherResponse>> {
        let response = match cmd.command.as_str() {
            "newbot" => Some(Self::cmd_newbot(db, user_id, cmd).await?),
            "mybots" => Some(Self::cmd_mybots(db, user_id).await?),
            "deletebot" => Some(Self::cmd_deletebot(db, user_id, cmd).await?),
            "setwebhook" => Some(Self::cmd_setwebhook(db, user_id, cmd).await?),
            "clearwebhook" => Some(Self::cmd_clearwebhook(db, user_id, cmd).await?),
            "token" => Some(Self::cmd_token(db, user_id, cmd).await?),
            "bothelp" => Some(Self::cmd_help()),
            "addbot" => Some(Self::cmd_addbot(db, user_id, chat_id, cmd).await?),
            "removebot" => Some(Self::cmd_removebot(db, user_id, chat_id, cmd).await?),
            "botinfo" => Some(Self::cmd_botinfo(db, user_id, cmd).await?),
            _ => None,
        };

        Ok(response)
    }

    /// /newbot <name> - Create a new bot
    async fn cmd_newbot(db: &Database, user_id: Uuid, cmd: &ParsedCommand) -> AppResult<BotFatherResponse> {
        let name = match cmd.first_arg() {
            Some(n) if !n.is_empty() => n.to_string(),
            _ => {
                return Ok(BotFatherResponse::error(
                    "❌ Usage: /newbot <name>\n\nExample: /newbot MyAwesomeBot"
                ));
            }
        };

        // Validate name length
        if name.len() < 3 || name.len() > 32 {
            return Ok(BotFatherResponse::error(
                "❌ Bot name must be between 3 and 32 characters."
            ));
        }

        let request = CreateBotRequest { name: name.clone() };
        let bot = BotEngineService::create_bot(db, user_id, request).await?;

        Ok(BotFatherResponse::success(format!(
            "✅ Bot created successfully!\n\n\
            🤖 Name: {}\n\
            🔑 Token: {}\n\n\
            ⚠️ Keep your token secret! Anyone with this token can control your bot.\n\n\
            Use /setwebhook to configure webhook URL.",
            bot.name, bot.token
        )))
    }

    /// /mybots - List user's bots
    async fn cmd_mybots(db: &Database, user_id: Uuid) -> AppResult<BotFatherResponse> {
        let bots = BotEngineService::get_bots_by_owner(db, user_id).await?;

        if bots.is_empty() {
            return Ok(BotFatherResponse::success(
                "📭 You don't have any bots yet.\n\nUse /newbot <name> to create one!"
            ));
        }

        let mut text = format!("🤖 Your bots ({}):\n\n", bots.len());
        for bot in bots {
            let status = if bot.is_active { "✅" } else { "⏸️" };
            let webhook = bot.webhook_url.as_deref().unwrap_or("Not set");
            text.push_str(&format!(
                "{} {} (ID: {})\n   Webhook: {}\n\n",
                status,
                bot.name,
                bot.id,
                if webhook.len() > 30 { &webhook[..30] } else { webhook }
            ));
        }

        Ok(BotFatherResponse::success(text))
    }

    /// /deletebot <bot_id> - Delete a bot
    async fn cmd_deletebot(db: &Database, user_id: Uuid, cmd: &ParsedCommand) -> AppResult<BotFatherResponse> {
        let bot_id_str = match cmd.first_arg() {
            Some(id) => id,
            None => {
                return Ok(BotFatherResponse::error(
                    "❌ Usage: /deletebot <bot_id>\n\nUse /mybots to see your bot IDs."
                ));
            }
        };

        let bot_id = match Uuid::parse_str(bot_id_str) {
            Ok(id) => id,
            Err(_) => {
                return Ok(BotFatherResponse::error("❌ Invalid bot ID format."));
            }
        };

        match BotEngineService::delete_bot(db, bot_id, user_id).await {
            Ok(_) => Ok(BotFatherResponse::success("✅ Bot deleted successfully.")),
            Err(AppError::BotNotFound) => {
                Ok(BotFatherResponse::error("❌ Bot not found."))
            }
            Err(AppError::AccessDenied) => {
                Ok(BotFatherResponse::error("❌ You don't own this bot."))
            }
            Err(e) => Err(e),
        }
    }

    /// /setwebhook <bot_id> <url> - Set webhook URL
    async fn cmd_setwebhook(db: &Database, user_id: Uuid, cmd: &ParsedCommand) -> AppResult<BotFatherResponse> {
        if cmd.args.len() < 2 {
            return Ok(BotFatherResponse::error(
                "❌ Usage: /setwebhook <bot_id> <url>\n\n\
                Example: /setwebhook 123e4567-e89b-12d3-a456-426614174000 https://myserver.com/webhook"
            ));
        }

        let bot_id = match Uuid::parse_str(&cmd.args[0]) {
            Ok(id) => id,
            Err(_) => {
                return Ok(BotFatherResponse::error("❌ Invalid bot ID format."));
            }
        };

        let url = &cmd.args[1];

        // Verify ownership
        let bot = BotEngineService::get_bot_by_id(db, bot_id).await?;
        if bot.owner_id != user_id {
            return Ok(BotFatherResponse::error("❌ You don't own this bot."));
        }

        match BotEngineService::set_webhook(db, bot_id, url).await {
            Ok(_) => Ok(BotFatherResponse::success(format!(
                "✅ Webhook set successfully!\n\nURL: {}",
                url
            ))),
            Err(AppError::InvalidWebhookUrl) => {
                Ok(BotFatherResponse::error(
                    "❌ Invalid webhook URL. Must be a valid HTTPS URL."
                ))
            }
            Err(AppError::WebhookError(msg)) => {
                Ok(BotFatherResponse::error(format!(
                    "❌ Webhook error: {}\n\nMake sure the URL is reachable.",
                    msg
                )))
            }
            Err(e) => Err(e),
        }
    }

    /// /clearwebhook <bot_id> - Clear webhook URL
    async fn cmd_clearwebhook(db: &Database, user_id: Uuid, cmd: &ParsedCommand) -> AppResult<BotFatherResponse> {
        let bot_id_str = match cmd.first_arg() {
            Some(id) => id,
            None => {
                return Ok(BotFatherResponse::error(
                    "❌ Usage: /clearwebhook <bot_id>"
                ));
            }
        };

        let bot_id = match Uuid::parse_str(bot_id_str) {
            Ok(id) => id,
            Err(_) => {
                return Ok(BotFatherResponse::error("❌ Invalid bot ID format."));
            }
        };

        // Verify ownership
        let bot = BotEngineService::get_bot_by_id(db, bot_id).await?;
        if bot.owner_id != user_id {
            return Ok(BotFatherResponse::error("❌ You don't own this bot."));
        }

        BotEngineService::clear_webhook(db, bot_id).await?;
        Ok(BotFatherResponse::success("✅ Webhook cleared."))
    }

    /// /token <bot_id> [regenerate] - Get or regenerate token
    async fn cmd_token(db: &Database, user_id: Uuid, cmd: &ParsedCommand) -> AppResult<BotFatherResponse> {
        let bot_id_str = match cmd.first_arg() {
            Some(id) => id,
            None => {
                return Ok(BotFatherResponse::error(
                    "❌ Usage: /token <bot_id> [regenerate]\n\n\
                    Use 'regenerate' to create a new token (invalidates old one)."
                ));
            }
        };

        let bot_id = match Uuid::parse_str(bot_id_str) {
            Ok(id) => id,
            Err(_) => {
                return Ok(BotFatherResponse::error("❌ Invalid bot ID format."));
            }
        };

        // Verify ownership
        let bot = BotEngineService::get_bot_by_id(db, bot_id).await?;
        if bot.owner_id != user_id {
            return Ok(BotFatherResponse::error("❌ You don't own this bot."));
        }

        // Check if regenerate requested
        let regenerate = cmd.args.get(1).map(|s| s.to_lowercase()) == Some("regenerate".to_string());

        if regenerate {
            let bot = BotEngineService::regenerate_token(db, bot_id, user_id).await?;
            Ok(BotFatherResponse::success(format!(
                "🔄 Token regenerated!\n\n\
                🤖 Bot: {}\n\
                🔑 New Token: {}\n\n\
                ⚠️ The old token is now invalid.",
                bot.name, bot.token
            )))
        } else {
            Ok(BotFatherResponse::success(format!(
                "🤖 Bot: {}\n🔑 Token: {}\n\n\
                Use '/token {} regenerate' to create a new token.",
                bot.name, bot.token, bot_id
            )))
        }
    }

    /// /addbot <bot_id> - Add a bot to current chat
    async fn cmd_addbot(
        db: &Database,
        _user_id: Uuid,
        chat_id: Uuid,
        cmd: &ParsedCommand,
    ) -> AppResult<BotFatherResponse> {
        let bot_id_str = match cmd.first_arg() {
            Some(id) => id,
            None => {
                return Ok(BotFatherResponse::error(
                    "❌ Usage: /addbot <bot_id>\n\nUse /mybots to see your bot IDs."
                ));
            }
        };

        let bot_id = match Uuid::parse_str(bot_id_str) {
            Ok(id) => id,
            Err(_) => {
                return Ok(BotFatherResponse::error("❌ Invalid bot ID format."));
            }
        };

        // Get bot info
        let bot = match BotEngineService::get_bot_by_id(db, bot_id).await {
            Ok(b) => b,
            Err(AppError::BotNotFound) => {
                return Ok(BotFatherResponse::error("❌ Bot not found."));
            }
            Err(e) => return Err(e),
        };

        // Add bot to chat
        match BotEngineService::add_bot_to_chat(db, bot_id, chat_id).await {
            Ok(_) => Ok(BotFatherResponse::success(format!(
                "✅ Bot '{}' added to this chat!\n\n\
                The bot will now receive messages from this chat.",
                bot.name
            ))),
            Err(e) => Err(e),
        }
    }

    /// /removebot <bot_id> - Remove a bot from current chat
    async fn cmd_removebot(
        db: &Database,
        _user_id: Uuid,
        chat_id: Uuid,
        cmd: &ParsedCommand,
    ) -> AppResult<BotFatherResponse> {
        let bot_id_str = match cmd.first_arg() {
            Some(id) => id,
            None => {
                return Ok(BotFatherResponse::error(
                    "❌ Usage: /removebot <bot_id>"
                ));
            }
        };

        let bot_id = match Uuid::parse_str(bot_id_str) {
            Ok(id) => id,
            Err(_) => {
                return Ok(BotFatherResponse::error("❌ Invalid bot ID format."));
            }
        };

        match BotEngineService::remove_bot_from_chat(db, bot_id, chat_id).await {
            Ok(true) => Ok(BotFatherResponse::success("✅ Bot removed from this chat.")),
            Ok(false) => Ok(BotFatherResponse::error("❌ Bot was not in this chat.")),
            Err(e) => Err(e),
        }
    }

    /// /botinfo <bot_id> - Get bot information
    async fn cmd_botinfo(db: &Database, user_id: Uuid, cmd: &ParsedCommand) -> AppResult<BotFatherResponse> {
        let bot_id_str = match cmd.first_arg() {
            Some(id) => id,
            None => {
                return Ok(BotFatherResponse::error("❌ Usage: /botinfo <bot_id>"));
            }
        };

        let bot_id = match Uuid::parse_str(bot_id_str) {
            Ok(id) => id,
            Err(_) => {
                return Ok(BotFatherResponse::error("❌ Invalid bot ID format."));
            }
        };

        let bot = match BotEngineService::get_bot_by_id(db, bot_id).await {
            Ok(b) => b,
            Err(AppError::BotNotFound) => {
                return Ok(BotFatherResponse::error("❌ Bot not found."));
            }
            Err(e) => return Err(e),
        };

        let is_owner = bot.owner_id == user_id;
        let status = if bot.is_active { "✅ Active" } else { "⏸️ Inactive" };
        let webhook = bot.webhook_url.as_deref().unwrap_or("Not configured");

        let mut text = format!(
            "🤖 Bot Information\n\n\
            Name: {}\n\
            ID: {}\n\
            Status: {}\n",
            bot.name, bot.id, status
        );

        if is_owner {
            text.push_str(&format!(
                "Webhook: {}\n\
                Created: {}\n",
                webhook,
                bot.created_at.format("%Y-%m-%d %H:%M UTC")
            ));
        }

        Ok(BotFatherResponse::success(text))
    }

    /// /bothelp - Show available commands
    fn cmd_help() -> BotFatherResponse {
        BotFatherResponse::success(
            "🤖 BotFather Commands\n\n\
            📝 Bot Management:\n\
            /newbot <name> - Create a new bot\n\
            /mybots - List your bots\n\
            /deletebot <bot_id> - Delete a bot\n\
            /botinfo <bot_id> - Get bot info\n\n\
            🔧 Configuration:\n\
            /setwebhook <bot_id> <url> - Set webhook URL\n\
            /clearwebhook <bot_id> - Clear webhook\n\
            /token <bot_id> [regenerate] - Get/regenerate token\n\n\
            💬 Chat Integration:\n\
            /addbot <bot_id> - Add bot to this chat\n\
            /removebot <bot_id> - Remove bot from this chat"
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_botfather_id() {
        let id = BotFather::id();
        assert_eq!(id.to_string(), "00000000-0000-0000-0000-000000000001");
    }

    #[test]
    fn test_is_botfather_command() {
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/newbot").unwrap()));
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/mybots").unwrap()));
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/bothelp").unwrap()));
        assert!(!BotFather::is_botfather_command(&ParsedCommand::parse("/help").unwrap()));
        assert!(!BotFather::is_botfather_command(&ParsedCommand::parse("/start").unwrap()));
    }

    #[test]
    fn test_help_command() {
        let response = BotFather::cmd_help();
        assert!(response.success);
        assert!(response.text.contains("BotFather Commands"));
        assert!(response.text.contains("/newbot"));
        assert!(response.text.contains("/mybots"));
    }
}
