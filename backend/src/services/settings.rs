use crate::{
    db::Database,
    error::{AppError, AppResult},
    models::{
        AppearanceSettings, ChatSettings, DataStorageSettings, DeviceResponse,
        NotificationSettings, PrivacySettings, ProfileResponse, Session, User, UserSettings,
    },
};
use uuid::Uuid;

pub struct SettingsService;

impl SettingsService {
    // Profile
    pub async fn get_profile(db: &Database, user_id: Uuid) -> AppResult<ProfileResponse> {
        let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&db.pool)
            .await?;

        Ok(ProfileResponse {
            id: user.id,
            name: user.name,
            username: user.username,
            bio: user.bio,
            phone: user.phone,
            email: user.email,
            avatar: user.avatar,
        })
    }

    pub async fn update_profile(
        db: &Database,
        user_id: Uuid,
        name: Option<String>,
        username: Option<String>,
        bio: Option<String>,
        phone: Option<String>,
        email: Option<String>,
    ) -> AppResult<ProfileResponse> {
        let user: User = sqlx::query_as(
            r#"
            UPDATE users SET
                name = COALESCE($2, name),
                username = COALESCE($3, username),
                bio = COALESCE($4, bio),
                phone = COALESCE($5, phone),
                email = COALESCE($6, email),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(name)
        .bind(username)
        .bind(bio)
        .bind(phone)
        .bind(email)
        .fetch_one(&db.pool)
        .await?;

        Ok(ProfileResponse {
            id: user.id,
            name: user.name,
            username: user.username,
            bio: user.bio,
            phone: user.phone,
            email: user.email,
            avatar: user.avatar,
        })
    }

    // Privacy
    pub async fn get_privacy(db: &Database, user_id: Uuid) -> AppResult<PrivacySettings> {
        let settings: UserSettings = Self::get_or_create_settings(db, user_id).await?;

        Ok(PrivacySettings {
            last_seen: settings.last_seen_visibility,
            profile_photo: settings.profile_photo_visibility,
            calls: settings.calls_visibility,
            groups: settings.groups_visibility,
            forwards: settings.forwards_enabled,
            read_receipts: settings.read_receipts_enabled,
            two_factor_auth: settings.two_factor_enabled,
        })
    }

    pub async fn update_privacy(
        db: &Database,
        user_id: Uuid,
        last_seen: Option<String>,
        profile_photo: Option<String>,
        calls: Option<String>,
        groups: Option<String>,
        forwards: Option<bool>,
        read_receipts: Option<bool>,
        two_factor_auth: Option<bool>,
    ) -> AppResult<PrivacySettings> {
        let settings: UserSettings = sqlx::query_as(
            r#"
            UPDATE user_settings SET
                last_seen_visibility = COALESCE($2, last_seen_visibility),
                profile_photo_visibility = COALESCE($3, profile_photo_visibility),
                calls_visibility = COALESCE($4, calls_visibility),
                groups_visibility = COALESCE($5, groups_visibility),
                forwards_enabled = COALESCE($6, forwards_enabled),
                read_receipts_enabled = COALESCE($7, read_receipts_enabled),
                two_factor_enabled = COALESCE($8, two_factor_enabled),
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(last_seen)
        .bind(profile_photo)
        .bind(calls)
        .bind(groups)
        .bind(forwards)
        .bind(read_receipts)
        .bind(two_factor_auth)
        .fetch_one(&db.pool)
        .await?;

        Ok(PrivacySettings {
            last_seen: settings.last_seen_visibility,
            profile_photo: settings.profile_photo_visibility,
            calls: settings.calls_visibility,
            groups: settings.groups_visibility,
            forwards: settings.forwards_enabled,
            read_receipts: settings.read_receipts_enabled,
            two_factor_auth: settings.two_factor_enabled,
        })
    }

    // Notifications
    pub async fn get_notifications(db: &Database, user_id: Uuid) -> AppResult<NotificationSettings> {
        let settings: UserSettings = Self::get_or_create_settings(db, user_id).await?;

        Ok(NotificationSettings {
            message_notifications: settings.message_notifications,
            group_notifications: settings.group_notifications,
            channel_notifications: settings.channel_notifications,
            in_app_sounds: settings.in_app_sounds,
            in_app_vibrate: settings.in_app_vibrate,
            in_app_preview: settings.in_app_preview,
            contact_joined: settings.contact_joined_notify,
        })
    }

    pub async fn update_notifications(
        db: &Database,
        user_id: Uuid,
        message_notifications: Option<bool>,
        group_notifications: Option<bool>,
        channel_notifications: Option<bool>,
        in_app_sounds: Option<bool>,
        in_app_vibrate: Option<bool>,
        in_app_preview: Option<bool>,
        contact_joined: Option<bool>,
    ) -> AppResult<NotificationSettings> {
        let settings: UserSettings = sqlx::query_as(
            r#"
            UPDATE user_settings SET
                message_notifications = COALESCE($2, message_notifications),
                group_notifications = COALESCE($3, group_notifications),
                channel_notifications = COALESCE($4, channel_notifications),
                in_app_sounds = COALESCE($5, in_app_sounds),
                in_app_vibrate = COALESCE($6, in_app_vibrate),
                in_app_preview = COALESCE($7, in_app_preview),
                contact_joined_notify = COALESCE($8, contact_joined_notify),
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(message_notifications)
        .bind(group_notifications)
        .bind(channel_notifications)
        .bind(in_app_sounds)
        .bind(in_app_vibrate)
        .bind(in_app_preview)
        .bind(contact_joined)
        .fetch_one(&db.pool)
        .await?;

        Ok(NotificationSettings {
            message_notifications: settings.message_notifications,
            group_notifications: settings.group_notifications,
            channel_notifications: settings.channel_notifications,
            in_app_sounds: settings.in_app_sounds,
            in_app_vibrate: settings.in_app_vibrate,
            in_app_preview: settings.in_app_preview,
            contact_joined: settings.contact_joined_notify,
        })
    }

    // Chat Settings
    pub async fn get_chat_settings(db: &Database, user_id: Uuid) -> AppResult<ChatSettings> {
        let settings: UserSettings = Self::get_or_create_settings(db, user_id).await?;

        Ok(ChatSettings {
            send_by_enter: settings.send_by_enter,
            media_auto_download: settings.media_auto_download,
            save_to_gallery: settings.save_to_gallery,
            auto_play_gifs: settings.auto_play_gifs,
            auto_play_videos: settings.auto_play_videos,
            raise_to_speak: settings.raise_to_speak,
        })
    }

    pub async fn update_chat_settings(
        db: &Database,
        user_id: Uuid,
        send_by_enter: Option<bool>,
        media_auto_download: Option<String>,
        save_to_gallery: Option<bool>,
        auto_play_gifs: Option<bool>,
        auto_play_videos: Option<bool>,
        raise_to_speak: Option<bool>,
    ) -> AppResult<ChatSettings> {
        let settings: UserSettings = sqlx::query_as(
            r#"
            UPDATE user_settings SET
                send_by_enter = COALESCE($2, send_by_enter),
                media_auto_download = COALESCE($3, media_auto_download),
                save_to_gallery = COALESCE($4, save_to_gallery),
                auto_play_gifs = COALESCE($5, auto_play_gifs),
                auto_play_videos = COALESCE($6, auto_play_videos),
                raise_to_speak = COALESCE($7, raise_to_speak),
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(send_by_enter)
        .bind(media_auto_download)
        .bind(save_to_gallery)
        .bind(auto_play_gifs)
        .bind(auto_play_videos)
        .bind(raise_to_speak)
        .fetch_one(&db.pool)
        .await?;

        Ok(ChatSettings {
            send_by_enter: settings.send_by_enter,
            media_auto_download: settings.media_auto_download,
            save_to_gallery: settings.save_to_gallery,
            auto_play_gifs: settings.auto_play_gifs,
            auto_play_videos: settings.auto_play_videos,
            raise_to_speak: settings.raise_to_speak,
        })
    }

    // Data Storage
    pub async fn get_data_storage(db: &Database, user_id: Uuid) -> AppResult<DataStorageSettings> {
        let settings: UserSettings = Self::get_or_create_settings(db, user_id).await?;

        // Calculate actual storage used
        let storage_used = Self::calculate_storage_used(user_id).await.unwrap_or(0);
        let cache_size = Self::calculate_cache_size(user_id).await.unwrap_or(0);

        Ok(DataStorageSettings {
            storage_used,
            cache_size,
            keep_media: settings.keep_media,
            auto_download_photos: settings.auto_download_photos,
            auto_download_videos: settings.auto_download_videos,
            auto_download_files: settings.auto_download_files,
            data_saver: settings.data_saver,
        })
    }

    pub async fn update_data_storage(
        db: &Database,
        user_id: Uuid,
        keep_media: Option<String>,
        auto_download_photos: Option<bool>,
        auto_download_videos: Option<bool>,
        auto_download_files: Option<bool>,
        data_saver: Option<bool>,
    ) -> AppResult<DataStorageSettings> {
        let settings: UserSettings = sqlx::query_as(
            r#"
            UPDATE user_settings SET
                keep_media = COALESCE($2, keep_media),
                auto_download_photos = COALESCE($3, auto_download_photos),
                auto_download_videos = COALESCE($4, auto_download_videos),
                auto_download_files = COALESCE($5, auto_download_files),
                data_saver = COALESCE($6, data_saver),
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(keep_media)
        .bind(auto_download_photos)
        .bind(auto_download_videos)
        .bind(auto_download_files)
        .bind(data_saver)
        .fetch_one(&db.pool)
        .await?;

        // Calculate actual storage used
        let storage_used = Self::calculate_storage_used(user_id).await.unwrap_or(0);
        let cache_size = Self::calculate_cache_size(user_id).await.unwrap_or(0);

        Ok(DataStorageSettings {
            storage_used,
            cache_size,
            keep_media: settings.keep_media,
            auto_download_photos: settings.auto_download_photos,
            auto_download_videos: settings.auto_download_videos,
            auto_download_files: settings.auto_download_files,
            data_saver: settings.data_saver,
        })
    }

    pub async fn clear_cache(db: &Database, user_id: Uuid) -> AppResult<DataStorageSettings> {
        // Clear cache directory for this user
        let cache_dir = format!("uploads/cache/{}", user_id);
        if tokio::fs::metadata(&cache_dir).await.is_ok() {
            tokio::fs::remove_dir_all(&cache_dir).await.map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Failed to clear cache: {}", e))
            })?;
            
            // Recreate the cache directory
            tokio::fs::create_dir_all(&cache_dir).await.map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Failed to recreate cache directory: {}", e))
            })?;
        }

        // Return updated storage settings with cache_size = 0
        Self::get_data_storage(db, user_id).await
    }

    // Appearance
    pub async fn get_appearance(db: &Database, user_id: Uuid) -> AppResult<AppearanceSettings> {
        let settings: UserSettings = Self::get_or_create_settings(db, user_id).await?;

        Ok(AppearanceSettings {
            theme: settings.theme,
            accent_color: settings.accent_color,
            font_size: settings.font_size,
            chat_background: settings.chat_background,
            bubble_style: settings.bubble_style,
            animations_enabled: settings.animations_enabled,
        })
    }

    pub async fn update_appearance(
        db: &Database,
        user_id: Uuid,
        theme: Option<String>,
        accent_color: Option<String>,
        font_size: Option<String>,
        chat_background: Option<String>,
        bubble_style: Option<String>,
        animations_enabled: Option<bool>,
    ) -> AppResult<AppearanceSettings> {
        let settings: UserSettings = sqlx::query_as(
            r#"
            UPDATE user_settings SET
                theme = COALESCE($2, theme),
                accent_color = COALESCE($3, accent_color),
                font_size = COALESCE($4, font_size),
                chat_background = COALESCE($5, chat_background),
                bubble_style = COALESCE($6, bubble_style),
                animations_enabled = COALESCE($7, animations_enabled),
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(theme)
        .bind(accent_color)
        .bind(font_size)
        .bind(chat_background)
        .bind(bubble_style)
        .bind(animations_enabled)
        .fetch_one(&db.pool)
        .await?;

        Ok(AppearanceSettings {
            theme: settings.theme,
            accent_color: settings.accent_color,
            font_size: settings.font_size,
            chat_background: settings.chat_background,
            bubble_style: settings.bubble_style,
            animations_enabled: settings.animations_enabled,
        })
    }

    // Devices
    pub async fn get_devices(
        db: &Database,
        user_id: Uuid,
        current_token: &str,
    ) -> AppResult<Vec<DeviceResponse>> {
        let sessions: Vec<Session> = sqlx::query_as(
            "SELECT * FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY last_active DESC",
        )
        .bind(user_id)
        .fetch_all(&db.pool)
        .await?;

        Ok(sessions
            .into_iter()
            .map(|s| {
                let is_current = s.token == current_token;
                
                // Provide default device name if not set
                let name = s.device_name.unwrap_or_else(|| {
                    let device_type = s.device_type.as_deref().unwrap_or("Unknown");
                    format!("{} Device", device_type)
                });
                
                // Provide default device type if not set
                let device_type = s.device_type.unwrap_or_else(|| "Unknown".to_string());
                
                // Provide default location if not set
                let location = s.location.unwrap_or_else(|| "Unknown Location".to_string());
                
                DeviceResponse {
                    id: s.id,
                    name,
                    device_type,
                    location,
                    last_active: s.last_active,
                    is_current,
                }
            })
            .collect())
    }

    pub async fn terminate_device(
        db: &Database,
        user_id: Uuid,
        device_id: Uuid,
        current_token: &str,
    ) -> AppResult<()> {
        let session: Session = sqlx::query_as(
            "SELECT * FROM sessions WHERE id = $1 AND user_id = $2",
        )
        .bind(device_id)
        .bind(user_id)
        .fetch_optional(&db.pool)
        .await?
        .ok_or(AppError::Internal(anyhow::anyhow!("Session not found")))?;

        if session.token == current_token {
            return Err(AppError::CannotTerminateCurrent);
        }

        sqlx::query("DELETE FROM sessions WHERE id = $1")
            .bind(device_id)
            .execute(&db.pool)
            .await?;

        Ok(())
    }

    pub async fn terminate_all_other_devices(
        db: &Database,
        user_id: Uuid,
        current_token: &str,
    ) -> AppResult<()> {
        sqlx::query("DELETE FROM sessions WHERE user_id = $1 AND token != $2")
            .bind(user_id)
            .bind(current_token)
            .execute(&db.pool)
            .await?;

        Ok(())
    }

    async fn get_or_create_settings(db: &Database, user_id: Uuid) -> AppResult<UserSettings> {
        let settings: Option<UserSettings> =
            sqlx::query_as("SELECT * FROM user_settings WHERE user_id = $1")
                .bind(user_id)
                .fetch_optional(&db.pool)
                .await?;

        if let Some(s) = settings {
            return Ok(s);
        }

        let settings: UserSettings =
            sqlx::query_as("INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *")
                .bind(user_id)
                .fetch_one(&db.pool)
                .await?;

        Ok(settings)
    }

    async fn calculate_storage_used(user_id: Uuid) -> Result<i64, std::io::Error> {
        let user_dir = format!("uploads/{}", user_id);
        Self::calculate_directory_size(&user_dir).await
    }

    async fn calculate_cache_size(user_id: Uuid) -> Result<i64, std::io::Error> {
        let cache_dir = format!("uploads/cache/{}", user_id);
        Self::calculate_directory_size(&cache_dir).await
    }

    async fn calculate_directory_size(path: &str) -> Result<i64, std::io::Error> {
        use std::pin::Pin;
        use std::future::Future;
        
        fn calculate_size_recursive(
            path: String,
        ) -> Pin<Box<dyn Future<Output = Result<i64, std::io::Error>> + Send>> {
            Box::pin(async move {
                let mut total_size: i64 = 0;
                
                // Check if directory exists
                if tokio::fs::metadata(&path).await.is_err() {
                    return Ok(0);
                }

                let mut entries = tokio::fs::read_dir(&path).await?;
                
                while let Some(entry) = entries.next_entry().await? {
                    let metadata = entry.metadata().await?;
                    if metadata.is_file() {
                        total_size += metadata.len() as i64;
                    } else if metadata.is_dir() {
                        // Recursively calculate subdirectory size
                        let subdir_path = entry.path();
                        if let Some(subdir_str) = subdir_path.to_str() {
                            total_size += calculate_size_recursive(subdir_str.to_string()).await?;
                        }
                    }
                }
                
                Ok(total_size)
            })
        }
        
        calculate_size_recursive(path.to_string()).await
    }
}

#[cfg(test)]
#[path = "settings_integration_tests.rs"]
mod settings_integration_tests;
