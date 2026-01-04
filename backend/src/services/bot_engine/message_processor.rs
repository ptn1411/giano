/// Message Processor module - integrates Bot Engine with Message Service.
///
/// This module provides:
/// - Hook into message creation flow
/// - Command parsing on new messages
/// - BotFather command handling
/// - Dispatch to bots when command detected
///
/// Requirements covered: 6.1, 6.2

use std::sync::Arc;

use crate::db::Database;
use crate::error::AppResult;
use crate::models::MessageResponse;
use crate::ws::WsManager;

use super::bot_service::BotEngineService;
use super::botfather::{BotFather, BotFatherResponse};
use super::command_parser::ParsedCommand;
use super::dispatcher::{BotDispatcher, CommandContext};

/// Result of processing a message
#[derive(Debug)]
pub struct ProcessResult {
    /// The parsed command, if any
    pub command: Option<ParsedCommand>,
    /// BotFather response, if command was handled by BotFather
    pub botfather_response: Option<BotFatherResponse>,
}

/// MessageProcessor handles the integration between message creation and bot dispatch.
pub struct MessageProcessor;

impl MessageProcessor {
    /// Process a newly created message for bot commands.
    ///
    /// This function:
    /// 1. Checks if the message contains a command (starts with "/")
    /// 2. If it's a BotFather command, handles it and returns response
    /// 3. Otherwise, finds all active bots subscribed to the chat
    /// 4. Dispatches the message to those bots
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `ws_manager` - WebSocket manager for bot delivery
    /// * `message` - The newly created message
    ///
    /// # Returns
    /// * `AppResult<ProcessResult>` - The processing result with command and optional BotFather response
    ///
    /// # Requirements
    /// - 6.1: Check if message contains a command when saved to database
    /// - 6.2: Find all active bots subscribed to the chat
    pub async fn process_message(
        db: &Database,
        ws_manager: Arc<WsManager>,
        message: &MessageResponse,
    ) -> AppResult<ProcessResult> {
        // Only process messages with text
        let text = match &message.text {
            Some(t) if !t.is_empty() => t,
            _ => return Ok(ProcessResult { command: None, botfather_response: None }),
        };

        // Check if message is a command (Requirement 6.1)
        let parsed_command = match ParsedCommand::parse(text) {
            Some(cmd) => cmd,
            None => return Ok(ProcessResult { command: None, botfather_response: None }),
        };

        tracing::debug!(
            "Command detected in message {}: /{} {:?}",
            message.id,
            parsed_command.command,
            parsed_command.args
        );

        // Check if this is a BotFather command
        if BotFather::is_botfather_command(&parsed_command) {
            let response = BotFather::handle_command(
                db,
                message.sender_id,
                message.chat_id,
                &parsed_command,
            ).await?;

            return Ok(ProcessResult {
                command: Some(parsed_command),
                botfather_response: response,
            });
        }

        // Find all active bots subscribed to this chat (Requirement 6.2)
        let bots = BotEngineService::get_chat_bots(db, message.chat_id).await?;

        if bots.is_empty() {
            tracing::debug!("No bots subscribed to chat {}", message.chat_id);
            return Ok(ProcessResult {
                command: Some(parsed_command),
                botfather_response: None,
            });
        }

        // Create command context
        let ctx = CommandContext {
            user_id: message.sender_id,
            chat_id: message.chat_id,
            message_id: message.id,
            text: text.clone(),
        };

        // Dispatch to bots
        let dispatcher = BotDispatcher::new(ws_manager);
        if let Err(e) = dispatcher.dispatch(&ctx, bots).await {
            tracing::error!("Failed to dispatch message to bots: {}", e);
        }

        Ok(ProcessResult {
            command: Some(parsed_command),
            botfather_response: None,
        })
    }

    /// Process a message for bot dispatch without parsing commands.
    ///
    /// This is useful when you want to dispatch all messages to bots,
    /// not just commands.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `ws_manager` - WebSocket manager for bot delivery
    /// * `message` - The message to dispatch
    ///
    /// # Returns
    /// * `AppResult<()>` - Success if dispatched
    pub async fn dispatch_to_bots(
        db: &Database,
        ws_manager: Arc<WsManager>,
        message: &MessageResponse,
    ) -> AppResult<()> {
        // Only process messages with text
        let text = match &message.text {
            Some(t) if !t.is_empty() => t,
            _ => return Ok(()),
        };

        // Find all active bots subscribed to this chat
        let bots = BotEngineService::get_chat_bots(db, message.chat_id).await?;

        if bots.is_empty() {
            return Ok(());
        }

        // Create command context
        let ctx = CommandContext {
            user_id: message.sender_id,
            chat_id: message.chat_id,
            message_id: message.id,
            text: text.clone(),
        };

        // Dispatch to bots
        let dispatcher = BotDispatcher::new(ws_manager);
        dispatcher.dispatch(&ctx, bots).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_parsing_integration() {
        // Test that ParsedCommand works correctly
        let cmd = ParsedCommand::parse("/help").unwrap();
        assert_eq!(cmd.command, "help");
        assert!(cmd.args.is_empty());

        let cmd = ParsedCommand::parse("/echo hello world").unwrap();
        assert_eq!(cmd.command, "echo");
        assert_eq!(cmd.args, vec!["hello", "world"]);

        // Non-command messages should return None
        assert!(ParsedCommand::parse("hello").is_none());
        assert!(ParsedCommand::parse("hello /world").is_none());
    }

    #[test]
    fn test_botfather_command_detection() {
        // BotFather commands
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/newbot").unwrap()));
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/mybots").unwrap()));
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/deletebot").unwrap()));
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/setwebhook").unwrap()));
        assert!(BotFather::is_botfather_command(&ParsedCommand::parse("/bothelp").unwrap()));

        // Non-BotFather commands
        assert!(!BotFather::is_botfather_command(&ParsedCommand::parse("/help").unwrap()));
        assert!(!BotFather::is_botfather_command(&ParsedCommand::parse("/start").unwrap()));
        assert!(!BotFather::is_botfather_command(&ParsedCommand::parse("/echo").unwrap()));
    }
}
