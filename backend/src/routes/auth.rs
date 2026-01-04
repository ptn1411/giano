use axum::{
    extract::State,
    http::{header, HeaderMap},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::UserSession,
    services::AuthService,
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/session", get(get_session))
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    email: String,
    password: String,
    name: String,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    session: UserSession,
}

async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<Json<SessionResponse>> {
    let session = AuthService::register(
        &state.db,
        &req.email,
        &req.password,
        &req.name,
        &state.config.jwt_secret,
        state.config.jwt_expiration_hours,
    )
    .await?;

    Ok(Json(SessionResponse { session }))
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<SessionResponse>> {
    let session = AuthService::login(
        &state.db,
        &req.email,
        &req.password,
        &state.config.jwt_secret,
        state.config.jwt_expiration_hours,
    )
    .await?;

    Ok(Json(SessionResponse { session }))
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    message: String,
}

async fn logout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<MessageResponse>> {
    let token = extract_token(&headers)?;
    AuthService::logout(&state.db, &token).await?;

    Ok(Json(MessageResponse {
        message: "Logged out successfully".to_string(),
    }))
}

async fn get_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<SessionResponse>> {
    let token = extract_token(&headers)?;
    let claims = AuthService::verify_token(&token, &state.config.jwt_secret)?;
    let user_id: Uuid = claims.sub.parse().map_err(|_| AppError::InvalidToken)?;

    let session = AuthService::get_session(&state.db, user_id, &token).await?;

    Ok(Json(SessionResponse { session }))
}

pub fn extract_token(headers: &HeaderMap) -> AppResult<String> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::InvalidToken)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(AppError::InvalidToken);
    }

    Ok(auth_header[7..].to_string())
}

pub async fn get_current_user_id(
    state: &AppState,
    headers: &HeaderMap,
) -> AppResult<Uuid> {
    let token = extract_token(headers)?;
    let claims = AuthService::verify_token(&token, &state.config.jwt_secret)?;
    let user_id: Uuid = claims.sub.parse().map_err(|_| AppError::InvalidToken)?;
    Ok(user_id)
}
