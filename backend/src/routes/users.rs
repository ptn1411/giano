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

async fn get_users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<Json<UsersResponse>> {
    // Verify authentication
    let _ = get_current_user_id(&state, &headers).await?;

    let users = UserService::get_all_users(&state.db).await?;

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
    email: String,
}

async fn search_user_by_email(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> AppResult<Json<UserResponse>> {
    // Verify authentication
    let _ = get_current_user_id(&state, &headers).await?;

    let user = UserService::get_user_by_email(&state.db, &query.email).await?;

    Ok(Json(UserResponse { user }))
}
