use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserSettings {
    pub id: Uuid,
    pub user_id: Uuid,
    // Privacy
    pub last_seen_visibility: String,
    pub profile_photo_visibility: String,
    pub calls_visibility: String,
    pub groups_visibility: String,
    pub forwards_enabled: bool,
    pub read_receipts_enabled: bool,
    pub two_factor_enabled: bool,
    // Notifications
    pub message_notifications: bool,
    pub group_notifications: bool,
    pub channel_notifications: bool,
    pub in_app_sounds: bool,
    pub in_app_vibrate: bool,
    pub in_app_preview: bool,
    pub contact_joined_notify: bool,
    // Chat
    pub send_by_enter: bool,
    pub media_auto_download: String,
    pub save_to_gallery: bool,
    pub auto_play_gifs: bool,
    pub auto_play_videos: bool,
    pub raise_to_speak: bool,
    // Data Storage
    pub keep_media: String,
    pub auto_download_photos: bool,
    pub auto_download_videos: bool,
    pub auto_download_files: bool,
    pub data_saver: bool,
    // Appearance
    pub theme: String,
    pub accent_color: String,
    pub font_size: String,
    pub chat_background: String,
    pub bubble_style: String,
    pub animations_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProfileResponse {
    pub id: Uuid,
    pub name: String,
    pub username: Option<String>,
    pub bio: Option<String>,
    pub phone: Option<String>,
    pub email: String,
    pub avatar: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrivacySettings {
    #[serde(rename = "lastSeen")]
    pub last_seen: String,
    #[serde(rename = "profilePhoto")]
    pub profile_photo: String,
    pub calls: String,
    pub groups: String,
    pub forwards: bool,
    #[serde(rename = "readReceipts")]
    pub read_receipts: bool,
    #[serde(rename = "twoFactorAuth")]
    pub two_factor_auth: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationSettings {
    #[serde(rename = "messageNotifications")]
    pub message_notifications: bool,
    #[serde(rename = "groupNotifications")]
    pub group_notifications: bool,
    #[serde(rename = "channelNotifications")]
    pub channel_notifications: bool,
    #[serde(rename = "inAppSounds")]
    pub in_app_sounds: bool,
    #[serde(rename = "inAppVibrate")]
    pub in_app_vibrate: bool,
    #[serde(rename = "inAppPreview")]
    pub in_app_preview: bool,
    #[serde(rename = "contactJoined")]
    pub contact_joined: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatSettings {
    #[serde(rename = "sendByEnter")]
    pub send_by_enter: bool,
    #[serde(rename = "mediaAutoDownload")]
    pub media_auto_download: String,
    #[serde(rename = "saveToGallery")]
    pub save_to_gallery: bool,
    #[serde(rename = "autoPlayGifs")]
    pub auto_play_gifs: bool,
    #[serde(rename = "autoPlayVideos")]
    pub auto_play_videos: bool,
    #[serde(rename = "raiseToSpeak")]
    pub raise_to_speak: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataStorageSettings {
    #[serde(rename = "storageUsed")]
    pub storage_used: i64,
    #[serde(rename = "cacheSize")]
    pub cache_size: i64,
    #[serde(rename = "keepMedia")]
    pub keep_media: String,
    #[serde(rename = "autoDownloadPhotos")]
    pub auto_download_photos: bool,
    #[serde(rename = "autoDownloadVideos")]
    pub auto_download_videos: bool,
    #[serde(rename = "autoDownloadFiles")]
    pub auto_download_files: bool,
    #[serde(rename = "dataSaver")]
    pub data_saver: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppearanceSettings {
    pub theme: String,
    #[serde(rename = "accentColor")]
    pub accent_color: String,
    #[serde(rename = "fontSize")]
    pub font_size: String,
    #[serde(rename = "chatBackground")]
    pub chat_background: String,
    #[serde(rename = "bubbleStyle")]
    pub bubble_style: String,
    #[serde(rename = "animationsEnabled")]
    pub animations_enabled: bool,
}
