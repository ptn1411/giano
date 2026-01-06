use crate::error::AppResult;
use crate::models::CreateInviteLinkRequest;
use crate::routes::auth::get_current_user_id;
use crate::services::invite_link;
use crate::AppState;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use uuid::Uuid;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(create_invite_link))
        .route("/my", get(get_my_invite_links))
        .route("/:code", get(get_invite_link))
        .route("/:code/use", post(use_invite_link))
        .route("/:id/revoke", post(revoke_invite_link))
}

/// Create a new invite link
async fn create_invite_link(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<CreateInviteLinkRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let link = invite_link::create_invite_link(&state.db.pool, user_id, request).await?;
    Ok(Json(serde_json::json!(link)))
}

/// Get invite link by code
async fn get_invite_link(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let link = invite_link::get_invite_link_by_code(&state.db.pool, &code).await?;
    Ok(Json(serde_json::json!(link)))
}

/// Use an invite link
async fn use_invite_link(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let result = invite_link::use_invite_link(&state.db.pool, user_id, &code).await?;
    Ok(Json(serde_json::json!(result)))
}

/// Get all invite links created by the current user
async fn get_my_invite_links(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = get_current_user_id(&state, &headers).await?;
    let links = invite_link::get_user_invite_links(&state.db.pool, user_id).await?;
    Ok(Json(serde_json::json!(links)))
}

/// Revoke an invite link
async fn revoke_invite_link(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let user_id = get_current_user_id(&state, &headers).await?;
    invite_link::revoke_invite_link(&state.db.pool, user_id, id).await?;
    Ok(StatusCode::OK)
}
