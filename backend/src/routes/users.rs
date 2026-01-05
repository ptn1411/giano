use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::UserPublic,
    routes::auth::get_current_user_id,
    services::UserService,
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_users))
        .route("/search", get(search_user_by_email))
        .route("/:user_id", get(get_user))
}

#[derive(Debug, Serialize)]
pub struct UsersResponse {
    users: Vec<UserPublic>,
}

#[derive(Debug, Deserialize)]
pub struct UsersQuery {
    search: Option<String>,
    limit: Option<i64>,
    connected_only: Option<bool>,
}

async fn get_users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<UsersQuery>,
) -> AppResult<Json<UsersResponse>> {
    // Verify authentication
    let current_user_id = get_current_user_id(&state, &headers).await?;

    let limit = query.limit.unwrap_or(50).min(100); // Max 100 users
    
    let users = if query.connected_only.unwrap_or(true) {
        // Return only users that current user has chats with
        UserService::get_connected_users(&state.db, current_user_id, query.search.as_deref(), limit).await?
    } else if let Some(search) = query.search {
        // Search all users with limit
        UserService::search_users(&state.db, &search, limit).await?
    } else {
        // Return empty list if no search query and not connected_only
        vec![]
    };

    Ok(Json(UsersResponse { users }))
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    user: UserPublic,
}

async fn get_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<UserResponse>> {
    // Verify authentication
    let _ = get_current_user_id(&state, &headers).await?;

    let user = UserService::get_user_by_id(&state.db, user_id).await?;

    Ok(Json(UserResponse { user }))
}


#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    email: Option<String>,
    username: Option<String>,
}

async fn search_user_by_email(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> AppResult<Json<UserResponse>> {
    // Verify authentication
    let _ = get_current_user_id(&state, &headers).await?;

    let user = if let Some(email) = query.email {
        UserService::get_user_by_email(&state.db, &email).await?
    } else if let Some(username) = query.username {
        UserService::get_user_by_username(&state.db, &username).await?
    } else {
        return Err(crate::error::AppError::InvalidEmail);
    };

    Ok(Json(UserResponse { user }))
}
