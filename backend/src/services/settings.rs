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

    // Data Storage
    pub async fn get_data_storage(db: &Database, user_id: Uuid) -> AppResult<DataStorageSettings> {
        let settings: UserSettings = Self::get_or_create_settings(db, user_id).await?;

        Ok(DataStorageSettings {
            storage_used: 0, // TODO: calculate actual storage
            cache_size: 0,
            keep_media: settings.keep_media,
            auto_download_photos: settings.auto_download_photos,
            auto_download_videos: settings.auto_download_videos,
            auto_download_files: settings.auto_download_files,
            data_saver: settings.data_saver,
        })
    }

    pub async fn clear_cache(db: &Database, user_id: Uuid) -> AppResult<DataStorageSettings> {
        // TODO: implement actual cache clearing
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
            .map(|s| DeviceResponse {
                id: s.id,
                name: s.device_name,
                device_type: s.device_type,
                location: s.location,
                last_active: s.last_active,
                is_current: s.token == current_token,
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
}
