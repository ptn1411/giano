/// Bot Service module - handles bot CRUD operations and management.
///
/// This module provides:
/// - Bot creation with token generation
/// - Bot retrieval by ID or token
/// - Bot update and deletion
/// - Bot activation/deactivation
/// - Default permission assignment
///
/// Requirements covered: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1

use rand::Rng;
use uuid::Uuid;

use crate::db::Database;
use crate::error::{AppError, AppResult};
use crate::models::{Bot, BotChat, BotPermission, BotResponse, CreateBotRequest, UpdateBotRequest};

use super::permission::SCOPE_SEND_MESSAGE;

/// BotEngineService handles all bot CRUD operations.
pub struct BotEngineService;

impl BotEngineService {
    /// Generate a unique bot token.
    /// Format: {bot_id}:{random_hex_string}
    fn generate_token(bot_id: Uuid) -> String {
        let random_part: String = rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(32)
            .map(char::from)
            .collect();
        format!("{}:{}", bot_id, random_part)
    }

    /// Create a new bot with the given name for the specified owner.
    ///
    /// This function:
    /// 1. Generates a unique token for the bot
    /// 2. Creates the bot record in the database
    /// 3. Assigns the default "send_message" permission
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `owner_id` - UUID of the user creating the bot
    /// * `request` - CreateBotRequest containing the bot name and optional username
    ///
    /// # Returns
    /// * `AppResult<BotResponse>` - The created bot information
    ///
    /// # Requirements
    /// - 1.1: Generate unique token and store bot in database
    /// - 1.2: Associate bot with owner_id
    /// - 3.1: Assign default permissions (send_message only)
    pub async fn create_bot(
        db: &Database,
        owner_id: Uuid,
        request: CreateBotRequest,
    ) -> AppResult<BotResponse> {
        // Generate a new UUID for the bot
        let bot_id = Uuid::new_v4();
        
        // Generate unique token
        let token = Self::generate_token(bot_id);

        // Create the bot record
        let bot: Bot = sqlx::query_as(
            r#"
            INSERT INTO bots (id, name, username, token, owner_id, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
            RETURNING *
            "#,
        )
        .bind(bot_id)
        .bind(&request.name)
        .bind(&request.username)
        .bind(&token)
        .bind(owner_id)
        .fetch_one(&db.pool)
        .await?;

        // Assign default permission (send_message)
        sqlx::query(
            "INSERT INTO bot_permissions (bot_id, scope) VALUES ($1, $2)"
        )
        .bind(bot_id)
        .bind(SCOPE_SEND_MESSAGE)
        .execute(&db.pool)
        .await?;

        Ok(BotResponse::from(bot))
    }


    /// Get a bot by its ID.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The bot if found
    /// * `AppError::BotNotFound` - If the bot doesn't exist
    pub async fn get_bot_by_id(db: &Database, bot_id: Uuid) -> AppResult<Bot> {
        let bot: Option<Bot> = sqlx::query_as(
            "SELECT * FROM bots WHERE id = $1"
        )
        .bind(bot_id)
        .fetch_optional(&db.pool)
        .await?;

        bot.ok_or(AppError::BotNotFound)
    }

    /// Get a bot by its token.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `token` - The bot's authentication token
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The bot if found
    /// * `AppError::BotNotFound` - If no bot with this token exists
    ///
    /// # Requirements
    /// - 7.2: Identify bot by extracting and validating token
    pub async fn get_bot_by_token(db: &Database, token: &str) -> AppResult<Bot> {
        let bot: Option<Bot> = sqlx::query_as(
            "SELECT * FROM bots WHERE token = $1"
        )
        .bind(token)
        .fetch_optional(&db.pool)
        .await?;

        bot.ok_or(AppError::BotNotFound)
    }

    /// Get all bots owned by a user.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `owner_id` - The owner's UUID
    ///
    /// # Returns
    /// * `AppResult<Vec<Bot>>` - List of bots owned by the user
    pub async fn get_bots_by_owner(db: &Database, owner_id: Uuid) -> AppResult<Vec<Bot>> {
        let bots: Vec<Bot> = sqlx::query_as(
            "SELECT * FROM bots WHERE owner_id = $1 ORDER BY created_at DESC"
        )
        .bind(owner_id)
        .fetch_all(&db.pool)
        .await?;

        Ok(bots)
    }

    /// Update a bot's settings.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `owner_id` - The owner's UUID (for authorization)
    /// * `request` - UpdateBotRequest containing fields to update
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The updated bot
    /// * `AppError::BotNotFound` - If the bot doesn't exist
    /// * `AppError::AccessDenied` - If the user is not the owner
    pub async fn update_bot(
        db: &Database,
        bot_id: Uuid,
        owner_id: Uuid,
        request: UpdateBotRequest,
    ) -> AppResult<Bot> {
        // First verify the bot exists and belongs to the owner
        let existing_bot = Self::get_bot_by_id(db, bot_id).await?;
        if existing_bot.owner_id != owner_id {
            return Err(AppError::AccessDenied);
        }

        // Build dynamic update query
        let name = request.name.unwrap_or(existing_bot.name);
        let is_active = request.is_active.unwrap_or(existing_bot.is_active);

        let bot: Bot = sqlx::query_as(
            r#"
            UPDATE bots 
            SET name = $1, is_active = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(&name)
        .bind(is_active)
        .bind(bot_id)
        .fetch_one(&db.pool)
        .await?;

        Ok(bot)
    }


    /// Delete a bot and all associated data.
    ///
    /// This function removes:
    /// - The bot record
    /// - All bot_permissions records (via CASCADE)
    /// - All bot_chats records (via CASCADE)
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `owner_id` - The owner's UUID (for authorization)
    ///
    /// # Returns
    /// * `AppResult<()>` - Success if deleted
    /// * `AppError::BotNotFound` - If the bot doesn't exist
    /// * `AppError::AccessDenied` - If the user is not the owner
    ///
    /// # Requirements
    /// - 1.5: Remove bot and all associated permissions and chat subscriptions
    pub async fn delete_bot(db: &Database, bot_id: Uuid, owner_id: Uuid) -> AppResult<()> {
        // First verify the bot exists and belongs to the owner
        let existing_bot = Self::get_bot_by_id(db, bot_id).await?;
        if existing_bot.owner_id != owner_id {
            return Err(AppError::AccessDenied);
        }

        // Delete the bot (CASCADE will handle permissions and chat subscriptions)
        let result = sqlx::query("DELETE FROM bots WHERE id = $1")
            .bind(bot_id)
            .execute(&db.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::BotNotFound);
        }

        Ok(())
    }

    /// Deactivate a bot (stop processing messages).
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `owner_id` - The owner's UUID (for authorization)
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The updated bot with is_active = false
    ///
    /// # Requirements
    /// - 1.3: Set is_active to false and stop processing messages
    pub async fn deactivate_bot(db: &Database, bot_id: Uuid, owner_id: Uuid) -> AppResult<Bot> {
        // First verify the bot exists and belongs to the owner
        let existing_bot = Self::get_bot_by_id(db, bot_id).await?;
        if existing_bot.owner_id != owner_id {
            return Err(AppError::AccessDenied);
        }

        let bot: Bot = sqlx::query_as(
            r#"
            UPDATE bots 
            SET is_active = false, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(bot_id)
        .fetch_one(&db.pool)
        .await?;

        Ok(bot)
    }

    /// Reactivate a bot (resume processing messages).
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `owner_id` - The owner's UUID (for authorization)
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The updated bot with is_active = true
    ///
    /// # Requirements
    /// - 1.4: Set is_active to true and resume processing messages
    pub async fn activate_bot(db: &Database, bot_id: Uuid, owner_id: Uuid) -> AppResult<Bot> {
        // First verify the bot exists and belongs to the owner
        let existing_bot = Self::get_bot_by_id(db, bot_id).await?;
        if existing_bot.owner_id != owner_id {
            return Err(AppError::AccessDenied);
        }

        let bot: Bot = sqlx::query_as(
            r#"
            UPDATE bots 
            SET is_active = true, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(bot_id)
        .fetch_one(&db.pool)
        .await?;

        Ok(bot)
    }


    /// Regenerate a bot's token.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `owner_id` - The owner's UUID (for authorization)
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The updated bot with new token
    pub async fn regenerate_token(db: &Database, bot_id: Uuid, owner_id: Uuid) -> AppResult<Bot> {
        // First verify the bot exists and belongs to the owner
        let existing_bot = Self::get_bot_by_id(db, bot_id).await?;
        if existing_bot.owner_id != owner_id {
            return Err(AppError::AccessDenied);
        }

        let new_token = Self::generate_token(bot_id);

        let bot: Bot = sqlx::query_as(
            r#"
            UPDATE bots 
            SET token = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
            "#,
        )
        .bind(&new_token)
        .bind(bot_id)
        .fetch_one(&db.pool)
        .await?;

        Ok(bot)
    }

    /// Get bot permissions.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    ///
    /// # Returns
    /// * `AppResult<Vec<BotPermission>>` - List of permissions for the bot
    pub async fn get_bot_permissions(db: &Database, bot_id: Uuid) -> AppResult<Vec<BotPermission>> {
        let permissions: Vec<BotPermission> = sqlx::query_as(
            "SELECT * FROM bot_permissions WHERE bot_id = $1"
        )
        .bind(bot_id)
        .fetch_all(&db.pool)
        .await?;

        Ok(permissions)
    }

    /// Check if a bot has a specific permission scope.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `scope` - The permission scope to check
    ///
    /// # Returns
    /// * `AppResult<bool>` - True if the bot has the permission
    pub async fn has_permission(db: &Database, bot_id: Uuid, scope: &str) -> AppResult<bool> {
        let result: Option<(i64,)> = sqlx::query_as(
            "SELECT 1 FROM bot_permissions WHERE bot_id = $1 AND scope = $2"
        )
        .bind(bot_id)
        .bind(scope)
        .fetch_optional(&db.pool)
        .await?;

        Ok(result.is_some())
    }

    // ==================== Permission Management ====================
    // Requirements: 3.2, 3.3

    /// Grant a permission scope to a bot.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `scope` - The permission scope to grant
    ///
    /// # Returns
    /// * `AppResult<BotPermission>` - The created permission record
    ///
    /// # Requirements
    /// - 3.2: Add the scope to bot_permissions
    pub async fn grant_permission(
        db: &Database,
        bot_id: Uuid,
        scope: &str,
    ) -> AppResult<BotPermission> {
        // Verify bot exists
        Self::get_bot_by_id(db, bot_id).await?;

        // Insert permission (ON CONFLICT DO NOTHING for idempotency)
        let permission: BotPermission = sqlx::query_as(
            r#"
            INSERT INTO bot_permissions (bot_id, scope)
            VALUES ($1, $2)
            ON CONFLICT (bot_id, scope) DO UPDATE SET scope = EXCLUDED.scope
            RETURNING *
            "#,
        )
        .bind(bot_id)
        .bind(scope)
        .fetch_one(&db.pool)
        .await?;

        Ok(permission)
    }

    /// Revoke a permission scope from a bot.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `scope` - The permission scope to revoke
    ///
    /// # Returns
    /// * `AppResult<bool>` - True if the permission was revoked, false if it didn't exist
    ///
    /// # Requirements
    /// - 3.3: Remove the scope from bot_permissions
    pub async fn revoke_permission(
        db: &Database,
        bot_id: Uuid,
        scope: &str,
    ) -> AppResult<bool> {
        // Verify bot exists
        Self::get_bot_by_id(db, bot_id).await?;

        let result = sqlx::query(
            "DELETE FROM bot_permissions WHERE bot_id = $1 AND scope = $2"
        )
        .bind(bot_id)
        .bind(scope)
        .execute(&db.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    // ==================== Chat Subscription Management ====================
    // Requirements: 4.1, 4.2

    /// Add a bot to a chat (subscribe).
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `chat_id` - The chat's UUID
    ///
    /// # Returns
    /// * `AppResult<BotChat>` - The created subscription record
    ///
    /// # Requirements
    /// - 4.1: Create a bot_chats record linking the bot and chat
    pub async fn add_bot_to_chat(
        db: &Database,
        bot_id: Uuid,
        chat_id: Uuid,
    ) -> AppResult<BotChat> {
        // Verify bot exists
        Self::get_bot_by_id(db, bot_id).await?;

        // Insert subscription (ON CONFLICT DO UPDATE for idempotency)
        let bot_chat: BotChat = sqlx::query_as(
            r#"
            INSERT INTO bot_chats (bot_id, chat_id, added_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (bot_id, chat_id) DO UPDATE SET added_at = bot_chats.added_at
            RETURNING *
            "#,
        )
        .bind(bot_id)
        .bind(chat_id)
        .fetch_one(&db.pool)
        .await?;

        Ok(bot_chat)
    }

    /// Remove a bot from a chat (unsubscribe).
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `chat_id` - The chat's UUID
    ///
    /// # Returns
    /// * `AppResult<bool>` - True if the subscription was removed, false if it didn't exist
    ///
    /// # Requirements
    /// - 4.2: Delete the bot_chats record
    pub async fn remove_bot_from_chat(
        db: &Database,
        bot_id: Uuid,
        chat_id: Uuid,
    ) -> AppResult<bool> {
        let result = sqlx::query(
            "DELETE FROM bot_chats WHERE bot_id = $1 AND chat_id = $2"
        )
        .bind(bot_id)
        .bind(chat_id)
        .execute(&db.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Get all chats a bot is subscribed to.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    ///
    /// # Returns
    /// * `AppResult<Vec<BotChat>>` - List of chat subscriptions for the bot
    pub async fn get_bot_chats(db: &Database, bot_id: Uuid) -> AppResult<Vec<BotChat>> {
        let bot_chats: Vec<BotChat> = sqlx::query_as(
            "SELECT * FROM bot_chats WHERE bot_id = $1 ORDER BY added_at DESC"
        )
        .bind(bot_id)
        .fetch_all(&db.pool)
        .await?;

        Ok(bot_chats)
    }

    /// Get all bots subscribed to a chat.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `chat_id` - The chat's UUID
    ///
    /// # Returns
    /// * `AppResult<Vec<Bot>>` - List of bots subscribed to the chat
    pub async fn get_chat_bots(db: &Database, chat_id: Uuid) -> AppResult<Vec<Bot>> {
        let bots: Vec<Bot> = sqlx::query_as(
            r#"
            SELECT b.* FROM bots b
            INNER JOIN bot_chats bc ON b.id = bc.bot_id
            WHERE bc.chat_id = $1
            ORDER BY bc.added_at DESC
            "#,
        )
        .bind(chat_id)
        .fetch_all(&db.pool)
        .await?;

        Ok(bots)
    }

    /// Check if a bot is subscribed to a chat.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `chat_id` - The chat's UUID
    ///
    /// # Returns
    /// * `AppResult<bool>` - True if the bot is subscribed to the chat
    pub async fn is_bot_in_chat(db: &Database, bot_id: Uuid, chat_id: Uuid) -> AppResult<bool> {
        let result: Option<(i64,)> = sqlx::query_as(
            "SELECT 1 FROM bot_chats WHERE bot_id = $1 AND chat_id = $2"
        )
        .bind(bot_id)
        .bind(chat_id)
        .fetch_optional(&db.pool)
        .await?;

        Ok(result.is_some())
    }

    // ==================== Username Management ====================

    /// Check if a username is already taken.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `username` - The username to check
    ///
    /// # Returns
    /// * `AppResult<bool>` - True if the username is taken
    pub async fn is_username_taken(db: &Database, username: &str) -> AppResult<bool> {
        let result: Option<(i64,)> = sqlx::query_as(
            "SELECT 1 FROM bots WHERE LOWER(username) = LOWER($1)"
        )
        .bind(username)
        .fetch_optional(&db.pool)
        .await?;

        Ok(result.is_some())
    }

    /// Get a bot by its username.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `username` - The bot's username
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The bot if found
    pub async fn get_bot_by_username(db: &Database, username: &str) -> AppResult<Bot> {
        let bot: Option<Bot> = sqlx::query_as(
            "SELECT * FROM bots WHERE LOWER(username) = LOWER($1)"
        )
        .bind(username)
        .fetch_optional(&db.pool)
        .await?;

        bot.ok_or(AppError::BotNotFound)
    }

    // ==================== Webhook Management ====================
    // Requirements: 2.1, 2.2, 2.3, 2.4

    /// Validate a webhook URL.
    ///
    /// # Arguments
    /// * `url` - The URL to validate
    ///
    /// # Returns
    /// * `AppResult<()>` - Ok if valid, error if invalid
    ///
    /// # Requirements
    /// - 2.3: Validate URL format before storing
    fn validate_webhook_url(url: &str) -> AppResult<()> {
        // Parse URL
        let parsed = url::Url::parse(url).map_err(|_| AppError::InvalidWebhookUrl)?;

        // Must be HTTPS (security requirement)
        if parsed.scheme() != "https" {
            return Err(AppError::InvalidWebhookUrl);
        }

        // Must have a host
        if parsed.host().is_none() {
            return Err(AppError::InvalidWebhookUrl);
        }

        Ok(())
    }

    /// Test webhook connectivity by sending a test request.
    ///
    /// # Arguments
    /// * `url` - The webhook URL to test
    ///
    /// # Returns
    /// * `AppResult<()>` - Ok if reachable, error if not
    ///
    /// # Requirements
    /// - 2.4: Send a test request to verify connectivity
    async fn test_webhook_connectivity(url: &str) -> AppResult<()> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| AppError::WebhookError(e.to_string()))?;

        // Send a GET request to test connectivity (some webhooks may not accept POST without payload)
        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| AppError::WebhookError(format!("Webhook unreachable: {}", e)))?;

        // Accept any 2xx or 4xx response (4xx means server is reachable but may require auth/POST)
        // Only fail on 5xx or connection errors
        if response.status().is_server_error() {
            return Err(AppError::WebhookError(format!(
                "Webhook returned server error: {}",
                response.status()
            )));
        }

        Ok(())
    }

    /// Set webhook URL for a bot.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `url` - The webhook URL to set
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The updated bot
    ///
    /// # Requirements
    /// - 2.1: Store the webhook_url for the bot
    /// - 2.3: Validate URL format
    /// - 2.4: Test connectivity before storing
    pub async fn set_webhook(db: &Database, bot_id: Uuid, url: &str) -> AppResult<Bot> {
        // Verify bot exists
        Self::get_bot_by_id(db, bot_id).await?;

        // Validate URL format
        Self::validate_webhook_url(url)?;

        // Test connectivity
        Self::test_webhook_connectivity(url).await?;

        // Update webhook URL
        let bot: Bot = sqlx::query_as(
            r#"
            UPDATE bots 
            SET webhook_url = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
            "#,
        )
        .bind(url)
        .bind(bot_id)
        .fetch_one(&db.pool)
        .await?;

        tracing::info!("Set webhook for bot {}: {}", bot_id, url);
        Ok(bot)
    }

    /// Clear webhook URL for a bot.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The updated bot with webhook_url = None
    ///
    /// # Requirements
    /// - 2.2: Clear the webhook_url for the bot
    pub async fn clear_webhook(db: &Database, bot_id: Uuid) -> AppResult<Bot> {
        // Verify bot exists
        Self::get_bot_by_id(db, bot_id).await?;

        // Clear webhook URL
        let bot: Bot = sqlx::query_as(
            r#"
            UPDATE bots 
            SET webhook_url = NULL, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(bot_id)
        .fetch_one(&db.pool)
        .await?;

        tracing::info!("Cleared webhook for bot {}", bot_id);
        Ok(bot)
    }

    /// Set or clear webhook URL based on input.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `url` - Optional webhook URL (None or empty string to clear)
    ///
    /// # Returns
    /// * `AppResult<Bot>` - The updated bot
    pub async fn set_or_clear_webhook(
        db: &Database,
        bot_id: Uuid,
        url: Option<&str>,
    ) -> AppResult<Bot> {
        match url {
            Some(u) if !u.trim().is_empty() => Self::set_webhook(db, bot_id, u.trim()).await,
            _ => Self::clear_webhook(db, bot_id).await,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_token_format() {
        let bot_id = Uuid::new_v4();
        let token = BotEngineService::generate_token(bot_id);
        
        // Token should contain the bot_id followed by a colon and random string
        assert!(token.starts_with(&bot_id.to_string()));
        assert!(token.contains(':'));
        
        // The random part should be 32 characters
        let parts: Vec<&str> = token.split(':').collect();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[1].len(), 32);
    }

    #[test]
    fn test_generate_token_uniqueness() {
        let bot_id = Uuid::new_v4();
        let token1 = BotEngineService::generate_token(bot_id);
        let token2 = BotEngineService::generate_token(bot_id);
        
        // Even for the same bot_id, tokens should be different
        assert_ne!(token1, token2);
    }
}
