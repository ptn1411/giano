pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod quic;
pub mod routes;
pub mod services;
pub mod ws;

use anyhow::Result;
use axum::{extract::DefaultBodyLimit, routing::get, Router};
use config::Config;
use db::Database;
use std::sync::Arc;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};

use quic::{ConnectionManager, StreamAllocator};
use services::bot_engine::{BotDispatcher, RateLimiter};
use ws::WsManager;

pub struct AppState {
    pub db: Database,
    pub config: Config,
    pub ws_manager: Arc<WsManager>,
    pub rate_limiter: Option<RateLimiter>,
    pub bot_dispatcher: Arc<BotDispatcher>,
    pub connection_manager: Arc<ConnectionManager>,
    pub stream_allocator: Arc<StreamAllocator>,
}

pub async fn create_app(config: Config) -> Result<(Router, Arc<AppState>)> {
    // Initialize database
    let db = Database::new(&config.database_url).await?;

    // Run migrations
    db.run_migrations().await?;

    // Initialize WebSocket manager
    let ws_manager = WsManager::new();

    // Initialize rate limiter with Redis (optional - gracefully handle connection failures)
    let rate_limiter = match redis::Client::open(config.redis_url.as_str()) {
        Ok(client) => match client.get_connection_manager().await {
            Ok(conn_manager) => {
                tracing::info!("Redis connected for rate limiting");
                Some(RateLimiter::with_defaults(conn_manager))
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to connect to Redis for rate limiting: {}. Rate limiting disabled.",
                    e
                );
                None
            }
        },
        Err(e) => {
            tracing::warn!("Invalid Redis URL: {}. Rate limiting disabled.", e);
            None
        }
    };

    // Initialize bot dispatcher
    let bot_dispatcher = Arc::new(BotDispatcher::new(ws_manager.clone()));

    // Initialize connection manager (shared between QUIC and WebSocket)
    let connection_manager = Arc::new(ConnectionManager::new());

    // Initialize stream allocator (for QUIC stream management)
    let stream_allocator = Arc::new(StreamAllocator::new());

    let state = Arc::new(AppState {
        db,
        config,
        ws_manager: ws_manager.clone(),
        rate_limiter,
        bot_dispatcher,
        connection_manager,
        stream_allocator,
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(ws::ws_handler))
        .route("/bot/ws", get(ws::bot_ws_handler))
        .nest("/api/v1", routes::api_routes())
        .merge(routes::bot_api_routes()) // Bot API routes at root level (/bot:token/*)
        // Serve static files from uploads directory
        .nest_service("/uploads", ServeDir::new("uploads"))
        .layer(DefaultBodyLimit::max(500 * 1024 * 1024)) // 500MB body limit
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
                .expose_headers(Any)
                .allow_credentials(false),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state.clone());

    Ok((app, state))
}

async fn health_check() -> &'static str {
    "OK"
}
