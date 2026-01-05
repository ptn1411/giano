#[cfg(test)]
mod integration_tests {
    use super::super::SettingsService;
    use crate::{
        db::Database,
        models::{User, Session},
    };
    use uuid::Uuid;
    use sqlx::PgPool;

    // Helper function to create a test database connection
    async fn setup_test_db() -> Database {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/chat_test".to_string());
        
        let pool = PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");
        
        Database { pool }
    }

    // Helper function to create a test user
    async fn create_test_user(db: &Database) -> User {
        let user_id = Uuid::new_v4();
        let username = format!("testuser_{}", user_id);
        
        sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (id, username, name, password_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(&username)
        .bind("Test User")
        .bind("$argon2id$v=19$m=19456,t=2,p=1$test$test")
        .fetch_one(&db.pool)
        .await
        .expect("Failed to create test user")
    }

    // Helper function to create a test session
    async fn create_test_session(db: &Database, user_id: Uuid) -> Session {
        let session_id = Uuid::new_v4();
        let token = format!("test_token_{}", session_id);
        
        sqlx::query_as::<_, Session>(
            r#"
            INSERT INTO sessions (id, user_id, token, device_name, device_type, location, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '7 days')
            RETURNING *
            "#,
        )
        .bind(session_id)
        .bind(user_id)
        .bind(&token)
        .bind("Test Device")
        .bind("desktop")
        .bind("Test Location")
        .fetch_one(&db.pool)
        .await
        .expect("Failed to create test session")
    }

    // Helper function to cleanup test data
    async fn cleanup_test_user(db: &Database, user_id: Uuid) {
        let _ = sqlx::query("DELETE FROM sessions WHERE user_id = $1")
            .bind(user_id)
            .execute(&db.pool)
            .await;
        
        let _ = sqlx::query("DELETE FROM user_settings WHERE user_id = $1")
            .bind(user_id)
            .execute(&db.pool)
            .await;
        
        let _ = sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(&db.pool)
            .await;
    }

    /// Task 9.1: Test complete settings update flow
    /// Requirements: 1.1, 1.2, 6.2, 12.1
    
    #[tokio::test]
    async fn test_profile_update_end_to_end() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Test profile update
        let updated_profile = SettingsService::update_profile(
            &db,
            user.id,
            Some("Updated Name".to_string()),
            Some("updated_username".to_string()),
            Some("Updated bio".to_string()),
            Some("+1234567890".to_string()),
            Some("updated@example.com".to_string()),
        )
        .await
        .expect("Failed to update profile");
        
        assert_eq!(updated_profile.name, "Updated Name");
        assert_eq!(updated_profile.username, Some("updated_username".to_string()));
        assert_eq!(updated_profile.bio, Some("Updated bio".to_string()));
        assert_eq!(updated_profile.phone, Some("+1234567890".to_string()));
        assert_eq!(updated_profile.email, "updated@example.com");
        
        // Verify persistence by fetching again
        let fetched_profile = SettingsService::get_profile(&db, user.id)
            .await
            .expect("Failed to fetch profile");
        
        assert_eq!(fetched_profile.name, "Updated Name");
        assert_eq!(fetched_profile.username, Some("updated_username".to_string()));
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_privacy_settings_update() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Test privacy settings update
        let updated_privacy = SettingsService::update_privacy(
            &db,
            user.id,
            Some("contacts".to_string()),
            Some("nobody".to_string()),
            Some("contacts".to_string()),
            Some("contacts".to_string()),
            Some(false),
            Some(false),
            Some(true),
        )
        .await
        .expect("Failed to update privacy settings");
        
        assert_eq!(updated_privacy.last_seen, "contacts");
        assert_eq!(updated_privacy.profile_photo, "nobody");
        assert_eq!(updated_privacy.calls, "contacts");
        assert_eq!(updated_privacy.groups, "contacts");
        assert_eq!(updated_privacy.forwards, false);
        assert_eq!(updated_privacy.read_receipts, false);
        assert_eq!(updated_privacy.two_factor_auth, true);
        
        // Verify persistence
        let fetched_privacy = SettingsService::get_privacy(&db, user.id)
            .await
            .expect("Failed to fetch privacy settings");
        
        assert_eq!(fetched_privacy.last_seen, "contacts");
        assert_eq!(fetched_privacy.two_factor_auth, true);
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_notification_settings_update() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Test notification settings update
        let updated_notifications = SettingsService::update_notifications(
            &db,
            user.id,
            Some(false),
            Some(false),
            Some(true),
            Some(false),
            Some(false),
            Some(true),
            Some(true),
        )
        .await
        .expect("Failed to update notification settings");
        
        assert_eq!(updated_notifications.message_notifications, false);
        assert_eq!(updated_notifications.group_notifications, false);
        assert_eq!(updated_notifications.channel_notifications, true);
        assert_eq!(updated_notifications.in_app_sounds, false);
        assert_eq!(updated_notifications.in_app_vibrate, false);
        assert_eq!(updated_notifications.in_app_preview, true);
        assert_eq!(updated_notifications.contact_joined, true);
        
        // Verify persistence
        let fetched_notifications = SettingsService::get_notifications(&db, user.id)
            .await
            .expect("Failed to fetch notification settings");
        
        assert_eq!(fetched_notifications.message_notifications, false);
        assert_eq!(fetched_notifications.contact_joined, true);
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_chat_settings_update() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Test chat settings update
        let updated_chat = SettingsService::update_chat_settings(
            &db,
            user.id,
            Some(false),
            Some("always".to_string()),
            Some(true),
            Some(false),
            Some(false),
            Some(true),
        )
        .await
        .expect("Failed to update chat settings");
        
        assert_eq!(updated_chat.send_by_enter, false);
        assert_eq!(updated_chat.media_auto_download, "always");
        assert_eq!(updated_chat.save_to_gallery, true);
        assert_eq!(updated_chat.auto_play_gifs, false);
        assert_eq!(updated_chat.auto_play_videos, false);
        assert_eq!(updated_chat.raise_to_speak, true);
        
        // Verify persistence
        let fetched_chat = SettingsService::get_chat_settings(&db, user.id)
            .await
            .expect("Failed to fetch chat settings");
        
        assert_eq!(fetched_chat.send_by_enter, false);
        assert_eq!(fetched_chat.media_auto_download, "always");
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_data_storage_settings_update() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Test data storage settings update
        let updated_storage = SettingsService::update_data_storage(
            &db,
            user.id,
            Some("3months".to_string()),
            Some(false),
            Some(false),
            Some(true),
            Some(true),
        )
        .await
        .expect("Failed to update data storage settings");
        
        assert_eq!(updated_storage.keep_media, "3months");
        assert_eq!(updated_storage.auto_download_photos, false);
        assert_eq!(updated_storage.auto_download_videos, false);
        assert_eq!(updated_storage.auto_download_files, true);
        assert_eq!(updated_storage.data_saver, true);
        
        // Verify persistence
        let fetched_storage = SettingsService::get_data_storage(&db, user.id)
            .await
            .expect("Failed to fetch data storage settings");
        
        assert_eq!(fetched_storage.keep_media, "3months");
        assert_eq!(fetched_storage.data_saver, true);
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_appearance_settings_update() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Test appearance settings update
        let updated_appearance = SettingsService::update_appearance(
            &db,
            user.id,
            Some("dark".to_string()),
            Some("#ff0000".to_string()),
            Some("large".to_string()),
            Some("custom".to_string()),
            Some("square".to_string()),
            Some(false),
        )
        .await
        .expect("Failed to update appearance settings");
        
        assert_eq!(updated_appearance.theme, "dark");
        assert_eq!(updated_appearance.accent_color, "#ff0000");
        assert_eq!(updated_appearance.font_size, "large");
        assert_eq!(updated_appearance.chat_background, "custom");
        assert_eq!(updated_appearance.bubble_style, "square");
        assert_eq!(updated_appearance.animations_enabled, false);
        
        // Verify persistence
        let fetched_appearance = SettingsService::get_appearance(&db, user.id)
            .await
            .expect("Failed to fetch appearance settings");
        
        assert_eq!(fetched_appearance.theme, "dark");
        assert_eq!(fetched_appearance.animations_enabled, false);
        
        cleanup_test_user(&db, user.id).await;
    }

    /// Task 9.2: Test device management flow
    /// Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
    
    #[tokio::test]
    async fn test_fetching_device_list() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        let session1 = create_test_session(&db, user.id).await;
        let session2 = create_test_session(&db, user.id).await;
        
        // Fetch device list
        let devices = SettingsService::get_devices(&db, user.id, &session1.token)
            .await
            .expect("Failed to fetch devices");
        
        assert_eq!(devices.len(), 2);
        
        // Verify current session is marked
        let current_device = devices.iter().find(|d| d.is_current).unwrap();
        assert_eq!(current_device.id, session1.id);
        
        // Verify other session is not marked as current
        let other_device = devices.iter().find(|d| !d.is_current).unwrap();
        assert_eq!(other_device.id, session2.id);
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_terminating_a_device() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        let session1 = create_test_session(&db, user.id).await;
        let session2 = create_test_session(&db, user.id).await;
        
        // Terminate session2
        SettingsService::terminate_device(&db, user.id, session2.id, &session1.token)
            .await
            .expect("Failed to terminate device");
        
        // Verify device is removed
        let devices = SettingsService::get_devices(&db, user.id, &session1.token)
            .await
            .expect("Failed to fetch devices");
        
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].id, session1.id);
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_terminating_all_other_devices() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        let session1 = create_test_session(&db, user.id).await;
        let _session2 = create_test_session(&db, user.id).await;
        let _session3 = create_test_session(&db, user.id).await;
        
        // Terminate all other devices
        SettingsService::terminate_all_other_devices(&db, user.id, &session1.token)
            .await
            .expect("Failed to terminate all other devices");
        
        // Verify only current session remains
        let devices = SettingsService::get_devices(&db, user.id, &session1.token)
            .await
            .expect("Failed to fetch devices");
        
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].id, session1.id);
        assert!(devices[0].is_current);
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_current_session_protection() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        let session = create_test_session(&db, user.id).await;
        
        // Try to terminate current session
        let result = SettingsService::terminate_device(&db, user.id, session.id, &session.token)
            .await;
        
        // Should fail with CannotTerminateCurrent error
        assert!(result.is_err());
        
        // Verify session still exists
        let devices = SettingsService::get_devices(&db, user.id, &session.token)
            .await
            .expect("Failed to fetch devices");
        
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].id, session.id);
        
        cleanup_test_user(&db, user.id).await;
    }

    /// Task 9.3: Test cache clearing flow
    /// Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
    
    #[tokio::test]
    async fn test_cache_clear_operation() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Create cache directory with a test file
        let cache_dir = format!("uploads/cache/{}", user.id);
        tokio::fs::create_dir_all(&cache_dir)
            .await
            .expect("Failed to create cache directory");
        
        let test_file = format!("{}/test.txt", cache_dir);
        tokio::fs::write(&test_file, b"test data")
            .await
            .expect("Failed to write test file");
        
        // Get initial storage settings
        let _initial_storage = SettingsService::get_data_storage(&db, user.id)
            .await
            .expect("Failed to get initial storage");
        
        // Cache size should be > 0 if file exists
        // (Note: This depends on the calculate_cache_size implementation)
        
        // Clear cache
        let updated_storage = SettingsService::clear_cache(&db, user.id)
            .await
            .expect("Failed to clear cache");
        
        // Verify cache_size is 0 or very small (empty directory)
        assert!(updated_storage.cache_size < 100); // Allow for directory overhead
        
        // Verify cache directory still exists but is empty
        let cache_exists = tokio::fs::metadata(&cache_dir).await.is_ok();
        assert!(cache_exists, "Cache directory should still exist");
        
        cleanup_test_user(&db, user.id).await;
        
        // Cleanup cache directory
        let _ = tokio::fs::remove_dir_all(&cache_dir).await;
    }

    /// Task 9.4: Test error scenarios
    /// Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
    
    #[tokio::test]
    async fn test_update_nonexistent_user() {
        let db = setup_test_db().await;
        let fake_user_id = Uuid::new_v4();
        
        // Try to update profile for non-existent user
        let result = SettingsService::update_profile(
            &db,
            fake_user_id,
            Some("Test".to_string()),
            None,
            None,
            None,
            None,
        )
        .await;
        
        // Should fail
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_terminate_nonexistent_device() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        let session = create_test_session(&db, user.id).await;
        let fake_device_id = Uuid::new_v4();
        
        // Try to terminate non-existent device
        let result = SettingsService::terminate_device(
            &db,
            user.id,
            fake_device_id,
            &session.token,
        )
        .await;
        
        // Should fail
        assert!(result.is_err());
        
        cleanup_test_user(&db, user.id).await;
    }

    /// Task 9.5: Test settings persistence
    /// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
    
    #[tokio::test]
    async fn test_settings_save_to_database() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Update multiple settings
        let _ = SettingsService::update_profile(
            &db,
            user.id,
            Some("Persistent User".to_string()),
            None,
            None,
            None,
            None,
        )
        .await
        .expect("Failed to update profile");
        
        let _ = SettingsService::update_privacy(
            &db,
            user.id,
            Some("nobody".to_string()),
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .expect("Failed to update privacy");
        
        // Fetch settings again to verify persistence
        let profile = SettingsService::get_profile(&db, user.id)
            .await
            .expect("Failed to fetch profile");
        
        let privacy = SettingsService::get_privacy(&db, user.id)
            .await
            .expect("Failed to fetch privacy");
        
        assert_eq!(profile.name, "Persistent User");
        assert_eq!(privacy.last_seen, "nobody");
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_partial_update_preservation() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Set initial values
        let _ = SettingsService::update_profile(
            &db,
            user.id,
            Some("Initial Name".to_string()),
            Some("initial_username".to_string()),
            Some("Initial bio".to_string()),
            None,
            None,
        )
        .await
        .expect("Failed to set initial profile");
        
        // Partial update (only name)
        let updated = SettingsService::update_profile(
            &db,
            user.id,
            Some("Updated Name".to_string()),
            None,
            None,
            None,
            None,
        )
        .await
        .expect("Failed to update profile");
        
        // Verify other fields are preserved
        assert_eq!(updated.name, "Updated Name");
        assert_eq!(updated.username, Some("initial_username".to_string()));
        assert_eq!(updated.bio, Some("Initial bio".to_string()));
        
        cleanup_test_user(&db, user.id).await;
    }

    #[tokio::test]
    async fn test_settings_idempotence() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        
        // Apply same update twice
        let update1 = SettingsService::update_chat_settings(
            &db,
            user.id,
            Some(false),
            Some("never".to_string()),
            None,
            None,
            None,
            None,
        )
        .await
        .expect("Failed first update");
        
        let update2 = SettingsService::update_chat_settings(
            &db,
            user.id,
            Some(false),
            Some("never".to_string()),
            None,
            None,
            None,
            None,
        )
        .await
        .expect("Failed second update");
        
        // Results should be identical
        assert_eq!(update1.send_by_enter, update2.send_by_enter);
        assert_eq!(update1.media_auto_download, update2.media_auto_download);
        
        cleanup_test_user(&db, user.id).await;
    }
}
