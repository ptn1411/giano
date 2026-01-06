pub mod auth;
pub mod users;
pub mod chats;
pub mod settings;
pub mod upload;
pub mod ws;
pub mod bots;
pub mod bot_api;
pub mod botfather;
pub mod metrics;
pub mod invite_links;

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
        .nest("/botfather", botfather::routes())
        .nest("/metrics", metrics::routes())
        .nest("/invite-links", invite_links::routes())
}

/// Bot API routes (Telegram-style /bot:token/* endpoints)
pub use bot_api::bot_api_routes;
