/// BotFather module - System bot for managing bots via chat commands.
///
/// BotFather is a special system bot that handles commands like:
/// - /newbot - Create a new bot (interactive conversation)
/// - /mybots - List your bots
/// - /deletebot - Delete a bot
/// - /setwebhook - Set webhook URL for a bot
/// - /token - Get or regenerate bot token
/// - /help - Show available commands

use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

use crate::db::Database;
use crate::error::{AppError, AppResult};
use crate::models::CreateBotRequest;

use super::bot_service::BotEngineService;
use super::command_parser::ParsedCommand;

/// Conversation state for multi-step commands
#[derive(Debug, Clone)]
pub enum ConversationState {
    /// Waiting for bot name in /newbot flow
    AwaitingBotName,
    /// Waiting for bot username in /newbot flow (has name)
    AwaitingBotUsername { name: String },
}

/// Session data for a user's conversation with BotFather
#[derive(Debug, Clone)]
pub struct UserSession {
    pub state: ConversationState,
}

/// Global session storage (user_id -> session)
static SESSIONS: Mutex<Option<HashMap<Uuid, UserSession>>> = Mutex::new(None);

fn get_sessions() -> std::sync::MutexGuard<'static, Option<HashMap<Uuid, UserSession>>> {
    SESSIONS.lock().unwrap()
}

fn ensure_sessions_init(guard: &mut std::sync::MutexGuard<'_, Option<HashMap<Uuid, UserSession>>>) {
    if guard.is_none() {
        **guard = Some(HashMap::new());
    }
}

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
            | "token" | "bothelp" | "addbot" | "removebot" | "botinfo" | "cancel"
        )
    }

    /// Get user's current session
    fn get_session(user_id: Uuid) -> Option<UserSession> {
        let guard = get_sessions();
        guard.as_ref()?.get(&user_id).cloned()
    }

    /// Set user's session
    fn set_session(user_id: Uuid, session: UserSession) {
        let mut guard = get_sessions();
        ensure_sessions_init(&mut guard);
        if let Some(sessions) = guard.as_mut() {
            sessions.insert(user_id, session);
        }
    }

    /// Clear user's session
    fn clear_session(user_id: Uuid) {
        let mut guard = get_sessions();
        if let Some(sessions) = guard.as_mut() {
            sessions.remove(&user_id);
        }
    }

    /// Check if user has an active conversation session
    pub fn has_active_session(user_id: Uuid) -> bool {
        Self::get_session(user_id).is_some()
    }

    /// Handle a plain text message (not a command) - for conversation flow
    pub async fn handle_message(
        db: &Database,
        user_id: Uuid,
        text: &str,
    ) -> AppResult<Option<BotFatherResponse>> {
        let session = match Self::get_session(user_id) {
            Some(s) => s,
            None => return Ok(None), // No active session
        };

        match session.state {
            ConversationState::AwaitingBotName => {
                Self::handle_bot_name_input(user_id, text).await
            }
            ConversationState::AwaitingBotUsername { name } => {
                Self::handle_bot_username_input(db, user_id, &name, text).await
            }
        }
    }

    /// Handle bot name input in /newbot flow
    async fn handle_bot_name_input(
        user_id: Uuid,
        name: &str,
    ) -> AppResult<Option<BotFatherResponse>> {
        let name = name.trim().to_string();

        // Validate name length
        if name.len() < 3 || name.len() > 32 {
            return Ok(Some(BotFatherResponse::error(
                "❌ Bot name must be between 3 and 32 characters.\n\nPlease enter a valid name:"
            )));
        }

        // Move to next step - ask for username
        Self::set_session(user_id, UserSession {
            state: ConversationState::AwaitingBotUsername { name: name.clone() },
        });

        Ok(Some(BotFatherResponse::success(format!(
            "✅ Great! Bot name: \"{}\"\n\n\
            Now, please choose a username for your bot.\n\
            ⚠️ Username must:\n\
            • Be 5-32 characters\n\
            • End with 'bot' (e.g., myawesome_bot)\n\
            • Only contain letters, numbers, and underscores\n\n\
            Enter username:",
            name
        ))))
    }

    /// Handle bot username input in /newbot flow
    async fn handle_bot_username_input(
        db: &Database,
        user_id: Uuid,
        name: &str,
        username: &str,
    ) -> AppResult<Option<BotFatherResponse>> {
        let username = username.trim().to_lowercase();

        // Validate username
        if let Err(msg) = Self::validate_username(&username) {
            return Ok(Some(BotFatherResponse::error(format!(
                "{}\n\nPlease enter a valid username:",
                msg
            ))));
        }

        // Check if username is already taken
        if BotEngineService::is_username_taken(db, &username).await? {
            return Ok(Some(BotFatherResponse::error(
                "❌ This username is already taken.\n\nPlease choose another username:"
            )));
        }

        // Create the bot
        let request = CreateBotRequest {
            name: name.to_string(),
            username: Some(username.clone()),
        };
        let bot = BotEngineService::create_bot(db, user_id, request).await?;

        // Clear session - conversation complete
        Self::clear_session(user_id);

        Ok(Some(BotFatherResponse::success(format!(
            "🎉 Done! Your bot has been created.\n\n\
            🤖 Name: {}\n\
            👤 Username: @{}\n\
            🔑 Token: {}\n\n\
            ⚠️ Keep your token secret! Anyone with this token can control your bot.\n\n\
            Use /setwebhook to configure webhook URL.",
            bot.name, username, bot.token
        ))))
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
        // Handle /cancel first - it clears any active session
        if cmd.command == "cancel" {
            Self::clear_session(user_id);
            return Ok(Some(BotFatherResponse::success("✅ Cancelled. What would you like to do?")));
        }

        // If user starts a new command, clear any existing session
        Self::clear_session(user_id);

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

    /// /newbot - Start interactive bot creation
    async fn cmd_newbot(db: &Database, user_id: Uuid, cmd: &ParsedCommand) -> AppResult<BotFatherResponse> {
        // If args provided, try quick creation (backward compatible)
        if cmd.args.len() >= 2 {
            return Self::cmd_newbot_quick(db, user_id, cmd).await;
        }

        // Start interactive flow
        Self::set_session(user_id, UserSession {
            state: ConversationState::AwaitingBotName,
        });

        Ok(BotFatherResponse::success(
            "🤖 Let's create a new bot!\n\n\
            Please enter a name for your bot (3-32 characters):\n\n\
            (Send /cancel to abort)"
        ))
    }

    /// Quick /newbot <name> <username> - Create bot with args (backward compatible)
    async fn cmd_newbot_quick(db: &Database, user_id: Uuid, cmd: &ParsedCommand) -> AppResult<BotFatherResponse> {
        let name = cmd.args[0].clone();
        let username = cmd.args[1].to_lowercase();

        // Validate name length
        if name.len() < 3 || name.len() > 32 {
            return Ok(BotFatherResponse::error(
                "❌ Bot name must be between 3 and 32 characters."
            ));
        }

        // Validate username
        if let Err(msg) = Self::validate_username(&username) {
            return Ok(BotFatherResponse::error(msg));
        }

        // Check if username is already taken
        if BotEngineService::is_username_taken(db, &username).await? {
            return Ok(BotFatherResponse::error(
                "❌ This username is already taken. Please choose another one."
            ));
        }

        let request = CreateBotRequest { 
            name: name.clone(),
            username: Some(username.clone()),
        };
        let bot = BotEngineService::create_bot(db, user_id, request).await?;

        Ok(BotFatherResponse::success(format!(
            "✅ Bot created successfully!\n\n\
            🤖 Name: {}\n\
            👤 Username: @{}\n\
            🔑 Token: {}\n\n\
            ⚠️ Keep your token secret! Anyone with this token can control your bot.\n\n\
            Use /setwebhook to configure webhook URL.",
            bot.name, username, bot.token
        )))
    }

    /// Validate bot username
    fn validate_username(username: &str) -> Result<(), &'static str> {
        // Must be 5-32 characters
        if username.len() < 5 || username.len() > 32 {
            return Err("❌ Username must be between 5 and 32 characters.");
        }

        // Must end with 'bot'
        if !username.ends_with("bot") && !username.ends_with("_bot") {
            return Err("❌ Username must end with 'bot' (e.g., myawesome_bot, coolbot).");
        }

        // Must contain only alphanumeric and underscore
        if !username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            return Err("❌ Username can only contain letters, numbers, and underscores.");
        }

        // Must start with a letter
        if !username.chars().next().map(|c| c.is_ascii_alphabetic()).unwrap_or(false) {
            return Err("❌ Username must start with a letter.");
        }

        Ok(())
    }

    /// /mybots - List user's bots
    async fn cmd_mybots(db: &Database, user_id: Uuid) -> AppResult<BotFatherResponse> {
        let bots = BotEngineService::get_bots_by_owner(db, user_id).await?;

        if bots.is_empty() {
            return Ok(BotFatherResponse::success(
                "📭 You don't have any bots yet.\n\nUse /newbot <name> <username> to create one!"
            ));
        }

        let mut text = format!("🤖 Your bots ({}):\n\n", bots.len());
        for bot in bots {
            let status = if bot.is_active { "✅" } else { "⏸️" };
            let username = bot.username.as_deref().map(|u| format!("@{}", u)).unwrap_or_else(|| "No username".to_string());
            text.push_str(&format!(
                "{} {} ({})\n   ID: {}\n\n",
                status,
                bot.name,
                username,
                bot.id,
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
            /newbot - Create a new bot (interactive)\n\
            /mybots - List your bots\n\
            /deletebot <bot_id> - Delete a bot\n\
            /botinfo <bot_id> - Get bot info\n\n\
            🔧 Configuration:\n\
            /setwebhook <bot_id> <url> - Set webhook URL\n\
            /clearwebhook <bot_id> - Clear webhook\n\
            /token <bot_id> [regenerate] - Get/regenerate token\n\n\
            💬 Chat Integration:\n\
            /addbot <bot_id> - Add bot to this chat\n\
            /removebot <bot_id> - Remove bot from this chat\n\n\
            /cancel - Cancel current operation"
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
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/cancel").unwrap()));
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
        assert!(response.text.contains("/cancel"));
    }

    #[test]
    fn test_validate_username() {
        // Valid usernames
        assert!(BotFather::validate_username("mybot").is_ok());
        assert!(BotFather::validate_username("my_bot").is_ok());
        assert!(BotFather::validate_username("awesome_bot").is_ok());
        assert!(BotFather::validate_username("test123bot").is_ok());

        // Invalid - too short
        assert!(BotFather::validate_username("bot").is_err());
        
        // Invalid - doesn't end with bot
        assert!(BotFather::validate_username("myapp").is_err());
        
        // Invalid - special characters
        assert!(BotFather::validate_username("my-bot").is_err());
        
        // Invalid - starts with number
        assert!(BotFather::validate_username("123bot").is_err());
    }
}
