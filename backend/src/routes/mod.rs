pub mod auth;
pub mod users;
pub mod chats;
pub mod settings;
pub mod upload;
pub mod ws;
pub mod bots;

use axum::Router;
use std::sync::Arc;
use crate::AppState;

pub fn api_routes() -> Router<Arc<AppState>> {
    Router::new()
        .nest("/auth", auth::routes())
        .nest("/users", users::routes())
        .nest("/chats", chats::routes())
        .nest("/settings", settings::routes())
        .nest("/upload", upload::routes())
        .nest("/ws", ws::routes())
        .nest("/bots", bots::routes())
}
