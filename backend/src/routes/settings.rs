use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::{
        AppearanceSettings, ChatSettings, DataStorageSettings, DeviceResponse,
        NotificationSettings, PrivacySettings, ProfileResponse,
    },
    routes::auth::{extract_token, get_current_user_id},
    services::SettingsService,
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/profile", get(get_profile).put(update_profile))
        .route("/privacy", get(get_privacy).put(update_privacy))
        .route("/notifications", get(get_notifications).put(update_notifications))
        .route("/chat", get(get_chat_settings).put(update_chat_settings))
        .route("/data-storage", get(get_data_storage).put(update_data_storage))
        .route("/clear-cache", post(clear_cache))
        .route("/appearance", get(get_appearance).put(update_appearance))
        .route("/devices", get(get_devices).delete(terminate_all_devices))
        .route("/devices/:device_id", delete(terminate_device))
}

// Profile
#[derive(Debug, Serialize)]
pub struct ProfileResponseWrapper {
    profile: ProfileResponse,
}

async fn get_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<ProfileResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let profile = SettingsService::get_profile(&state.db, user_id).await?;
    Ok(Json(ProfileResponseWrapper { profile }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    name: Option<String>,
    username: Option<String>,
    bio: Option<String>,
    phone: Option<String>,
    email: Option<String>,
}

async fn update_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<UpdateProfileRequest>,
) -> AppResult<Json<ProfileResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let profile = SettingsService::update_profile(
        &state.db,
        user_id,
        req.name,
        req.username,
        req.bio,
        req.phone,
        req.email,
    )
    .await?;
    Ok(Json(ProfileResponseWrapper { profile }))
}

// Privacy
#[derive(Debug, Serialize)]
pub struct PrivacyResponseWrapper {
    privacy: PrivacySettings,
}

async fn get_privacy(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<PrivacyResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let privacy = SettingsService::get_privacy(&state.db, user_id).await?;
    Ok(Json(PrivacyResponseWrapper { privacy }))
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrivacyRequest {
    #[serde(rename = "lastSeen")]
    last_seen: Option<String>,
    #[serde(rename = "profilePhoto")]
    profile_photo: Option<String>,
    calls: Option<String>,
    groups: Option<String>,
    forwards: Option<bool>,
    #[serde(rename = "readReceipts")]
    read_receipts: Option<bool>,
    #[serde(rename = "twoFactorAuth")]
    two_factor_auth: Option<bool>,
}

async fn update_privacy(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<UpdatePrivacyRequest>,
) -> AppResult<Json<PrivacyResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let privacy = SettingsService::update_privacy(
        &state.db,
        user_id,
        req.last_seen,
        req.profile_photo,
        req.calls,
        req.groups,
        req.forwards,
        req.read_receipts,
        req.two_factor_auth,
    )
    .await?;
    Ok(Json(PrivacyResponseWrapper { privacy }))
}

// Notifications
#[derive(Debug, Serialize)]
pub struct NotificationsResponseWrapper {
    notifications: NotificationSettings,
}

async fn get_notifications(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<NotificationsResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let notifications = SettingsService::get_notifications(&state.db, user_id).await?;
    Ok(Json(NotificationsResponseWrapper { notifications }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateNotificationsRequest {
    #[serde(rename = "messageNotifications")]
    message_notifications: Option<bool>,
    #[serde(rename = "groupNotifications")]
    group_notifications: Option<bool>,
    #[serde(rename = "channelNotifications")]
    channel_notifications: Option<bool>,
    #[serde(rename = "inAppSounds")]
    in_app_sounds: Option<bool>,
    #[serde(rename = "inAppVibrate")]
    in_app_vibrate: Option<bool>,
    #[serde(rename = "inAppPreview")]
    in_app_preview: Option<bool>,
    #[serde(rename = "contactJoined")]
    contact_joined: Option<bool>,
}

async fn update_notifications(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<UpdateNotificationsRequest>,
) -> AppResult<Json<NotificationsResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let notifications = SettingsService::update_notifications(
        &state.db,
        user_id,
        req.message_notifications,
        req.group_notifications,
        req.channel_notifications,
        req.in_app_sounds,
        req.in_app_vibrate,
        req.in_app_preview,
        req.contact_joined,
    )
    .await?;
    Ok(Json(NotificationsResponseWrapper { notifications }))
}

// Chat Settings
#[derive(Debug, Serialize)]
pub struct ChatSettingsResponseWrapper {
    #[serde(rename = "chatSettings")]
    chat_settings: ChatSettings,
}

async fn get_chat_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<ChatSettingsResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let chat_settings = SettingsService::get_chat_settings(&state.db, user_id).await?;
    Ok(Json(ChatSettingsResponseWrapper { chat_settings }))
}

async fn update_chat_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<ChatSettingsResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let chat_settings = SettingsService::get_chat_settings(&state.db, user_id).await?;
    Ok(Json(ChatSettingsResponseWrapper { chat_settings }))
}

// Data Storage
#[derive(Debug, Serialize)]
pub struct DataStorageResponseWrapper {
    #[serde(rename = "dataStorage")]
    data_storage: DataStorageSettings,
}

async fn get_data_storage(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<DataStorageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let data_storage = SettingsService::get_data_storage(&state.db, user_id).await?;
    Ok(Json(DataStorageResponseWrapper { data_storage }))
}

async fn update_data_storage(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<DataStorageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let data_storage = SettingsService::get_data_storage(&state.db, user_id).await?;
    Ok(Json(DataStorageResponseWrapper { data_storage }))
}

async fn clear_cache(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<DataStorageResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let data_storage = SettingsService::clear_cache(&state.db, user_id).await?;
    Ok(Json(DataStorageResponseWrapper { data_storage }))
}

// Appearance
#[derive(Debug, Serialize)]
pub struct AppearanceResponseWrapper {
    appearance: AppearanceSettings,
}

async fn get_appearance(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<AppearanceResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let appearance = SettingsService::get_appearance(&state.db, user_id).await?;
    Ok(Json(AppearanceResponseWrapper { appearance }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateAppearanceRequest {
    theme: Option<String>,
    #[serde(rename = "accentColor")]
    accent_color: Option<String>,
    #[serde(rename = "fontSize")]
    font_size: Option<String>,
    #[serde(rename = "chatBackground")]
    chat_background: Option<String>,
    #[serde(rename = "bubbleStyle")]
    bubble_style: Option<String>,
    #[serde(rename = "animationsEnabled")]
    animations_enabled: Option<bool>,
}

async fn update_appearance(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<UpdateAppearanceRequest>,
) -> AppResult<Json<AppearanceResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let appearance = SettingsService::update_appearance(
        &state.db,
        user_id,
        req.theme,
        req.accent_color,
        req.font_size,
        req.chat_background,
        req.bubble_style,
        req.animations_enabled,
    )
    .await?;
    Ok(Json(AppearanceResponseWrapper { appearance }))
}

// Devices
#[derive(Debug, Serialize)]
pub struct DevicesResponseWrapper {
    devices: Vec<DeviceResponse>,
}

async fn get_devices(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<DevicesResponseWrapper>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let token = extract_token(&headers)?;
    let devices = SettingsService::get_devices(&state.db, user_id, &token).await?;
    Ok(Json(DevicesResponseWrapper { devices }))
}

#[derive(Debug, Serialize)]
pub struct SimpleMessage {
    message: String,
}

async fn terminate_device(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(device_id): Path<Uuid>,
) -> AppResult<Json<SimpleMessage>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let token = extract_token(&headers)?;
    SettingsService::terminate_device(&state.db, user_id, device_id, &token).await?;
    Ok(Json(SimpleMessage {
        message: "Device session terminated".to_string(),
    }))
}

async fn terminate_all_devices(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<SimpleMessage>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let token = extract_token(&headers)?;
    SettingsService::terminate_all_other_devices(&state.db, user_id, &token).await?;
    Ok(Json(SimpleMessage {
        message: "All other sessions terminated".to_string(),
    }))
}
