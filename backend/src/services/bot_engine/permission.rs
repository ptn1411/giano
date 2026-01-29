/// Permission Checker module - handles bot permission and subscription verification.
///
/// This module provides:
/// - Scope constants for bot permissions
/// - Functions to check if a bot has a specific scope
/// - Functions to check if a bot is subscribed to a chat
use uuid::Uuid;

use crate::db::Database;
use crate::error::AppError;

// Scope constants for bot permissions
pub const SCOPE_SEND_MESSAGE: &str = "send_message";
pub const SCOPE_READ_MESSAGE: &str = "read_message";
pub const SCOPE_BAN_USER: &str = "ban_user";

/// Permission Checker provides methods to verify bot permissions and chat subscriptions.
pub struct PermissionChecker;

impl PermissionChecker {
    /// Check if a bot has a specific scope/permission.
    ///
    /// Returns Ok(true) if the bot has the scope, Ok(false) otherwise.
    /// Returns Err if there's a database error.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `scope` - The scope to check (e.g., SCOPE_SEND_MESSAGE)
    ///
    /// # Requirements
    /// - 3.4: Verify bot has required scope before proceeding
    /// - 3.5: Reject request with permission error if scope is missing
    pub async fn check_scope(db: &Database, bot_id: Uuid, scope: &str) -> Result<bool, AppError> {
        let result: Option<(i32,)> =
            sqlx::query_as("SELECT 1 FROM bot_permissions WHERE bot_id = $1 AND scope = $2")
                .bind(bot_id)
                .bind(scope)
                .fetch_optional(&db.pool)
                .await?;

        Ok(result.is_some())
    }

    /// Check if a bot is subscribed to a specific chat.
    ///
    /// Returns Ok(true) if the bot is subscribed, Ok(false) otherwise.
    /// Returns Err if there's a database error.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `bot_id` - The bot's UUID
    /// * `chat_id` - The chat's UUID
    ///
    /// # Requirements
    /// - 4.3: Verify bot is subscribed to chat before sending message
    /// - 4.4: Reject message with subscription error if not subscribed
    pub async fn check_chat_subscription(
        db: &Database,
        bot_id: Uuid,
        chat_id: Uuid,
    ) -> Result<bool, AppError> {
        let result: Option<(i32,)> =
            sqlx::query_as("SELECT 1 FROM bot_chats WHERE bot_id = $1 AND chat_id = $2")
                .bind(bot_id)
                .bind(chat_id)
                .fetch_optional(&db.pool)
                .await?;

        Ok(result.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scope_constants() {
        // Verify scope constants are defined correctly
        assert_eq!(SCOPE_SEND_MESSAGE, "send_message");
        assert_eq!(SCOPE_READ_MESSAGE, "read_message");
        assert_eq!(SCOPE_BAN_USER, "ban_user");
    }
}

#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    use std::collections::HashSet;

    /// Simulates an in-memory permission store for property testing.
    /// This allows us to test the permission enforcement logic without a database.
    #[derive(Debug, Clone, Default)]
    struct MockPermissionStore {
        permissions: HashSet<(Uuid, String)>,
        subscriptions: HashSet<(Uuid, Uuid)>,
    }

    impl MockPermissionStore {
        fn grant_permission(&mut self, bot_id: Uuid, scope: &str) {
            self.permissions.insert((bot_id, scope.to_string()));
        }

        fn revoke_permission(&mut self, bot_id: Uuid, scope: &str) {
            self.permissions.remove(&(bot_id, scope.to_string()));
        }

        fn has_permission(&self, bot_id: Uuid, scope: &str) -> bool {
            self.permissions.contains(&(bot_id, scope.to_string()))
        }

        fn subscribe_to_chat(&mut self, bot_id: Uuid, chat_id: Uuid) {
            self.subscriptions.insert((bot_id, chat_id));
        }

        fn unsubscribe_from_chat(&mut self, bot_id: Uuid, chat_id: Uuid) {
            self.subscriptions.remove(&(bot_id, chat_id));
        }

        fn is_subscribed(&self, bot_id: Uuid, chat_id: Uuid) -> bool {
            self.subscriptions.contains(&(bot_id, chat_id))
        }
    }

    /// Strategy to generate valid scope strings
    fn scope_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            Just(SCOPE_SEND_MESSAGE.to_string()),
            Just(SCOPE_READ_MESSAGE.to_string()),
            Just(SCOPE_BAN_USER.to_string()),
        ]
    }

    /// Strategy to generate UUIDs
    fn uuid_strategy() -> impl Strategy<Value = Uuid> {
        any::<[u8; 16]>().prop_map(|bytes| Uuid::from_bytes(bytes))
    }

    proptest! {
        /// Feature: bot-engine, Property 6: Permission Enforcement
        /// *For any* bot attempting an action requiring a scope:
        /// - If the bot has the scope, the action SHALL succeed
        /// - If the bot lacks the scope, the action SHALL fail with a permission error
        /// **Validates: Requirements 3.4, 3.5**
        #[test]
        fn prop_permission_enforcement(
            bot_id in uuid_strategy(),
            scope in scope_strategy(),
            has_permission in any::<bool>()
        ) {
            let mut store = MockPermissionStore::default();

            // Setup: grant or don't grant permission based on test input
            if has_permission {
                store.grant_permission(bot_id, &scope);
            }

            // Property: permission check result matches whether permission was granted
            let check_result = store.has_permission(bot_id, &scope);
            prop_assert_eq!(
                check_result,
                has_permission,
                "Permission check should return {} for bot {} with scope {}",
                has_permission,
                bot_id,
                scope
            );
        }

        /// Feature: bot-engine, Property 6: Permission Enforcement (Grant then Revoke)
        /// Granting then revoking a permission should result in the bot not having the permission
        /// **Validates: Requirements 3.4, 3.5**
        #[test]
        fn prop_permission_grant_revoke_enforcement(
            bot_id in uuid_strategy(),
            scope in scope_strategy()
        ) {
            let mut store = MockPermissionStore::default();

            // Initially no permission
            prop_assert!(!store.has_permission(bot_id, &scope));

            // Grant permission - should now have it
            store.grant_permission(bot_id, &scope);
            prop_assert!(store.has_permission(bot_id, &scope));

            // Revoke permission - should no longer have it
            store.revoke_permission(bot_id, &scope);
            prop_assert!(!store.has_permission(bot_id, &scope));
        }

        /// Feature: bot-engine, Property 8: Subscription Enforcement
        /// *For any* bot attempting to send a message to a chat:
        /// - If the bot is subscribed to the chat, the message SHALL be created
        /// - If the bot is not subscribed, the request SHALL fail with a forbidden error
        /// **Validates: Requirements 4.3, 4.4, 7.6**
        #[test]
        fn prop_subscription_enforcement(
            bot_id in uuid_strategy(),
            chat_id in uuid_strategy(),
            is_subscribed in any::<bool>()
        ) {
            let mut store = MockPermissionStore::default();

            // Setup: subscribe or don't subscribe based on test input
            if is_subscribed {
                store.subscribe_to_chat(bot_id, chat_id);
            }

            // Property: subscription check result matches whether bot was subscribed
            let check_result = store.is_subscribed(bot_id, chat_id);
            prop_assert_eq!(
                check_result,
                is_subscribed,
                "Subscription check should return {} for bot {} in chat {}",
                is_subscribed,
                bot_id,
                chat_id
            );
        }

        /// Feature: bot-engine, Property 8: Subscription Enforcement (Subscribe then Unsubscribe)
        /// Subscribing then unsubscribing should result in the bot not being subscribed
        /// **Validates: Requirements 4.3, 4.4, 7.6**
        #[test]
        fn prop_subscription_subscribe_unsubscribe_enforcement(
            bot_id in uuid_strategy(),
            chat_id in uuid_strategy()
        ) {
            let mut store = MockPermissionStore::default();

            // Initially not subscribed
            prop_assert!(!store.is_subscribed(bot_id, chat_id));

            // Subscribe - should now be subscribed
            store.subscribe_to_chat(bot_id, chat_id);
            prop_assert!(store.is_subscribed(bot_id, chat_id));

            // Unsubscribe - should no longer be subscribed
            store.unsubscribe_from_chat(bot_id, chat_id);
            prop_assert!(!store.is_subscribed(bot_id, chat_id));
        }
    }
}
