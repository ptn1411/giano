pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod routes;
pub mod services;
pub mod ws;

use anyhow::Result;
use axum::{routing::get, Router};
use config::Config;
use db::Database;
use std::sync::Arc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use ws::WsManager;

pub struct AppState {
    pub db: Database,
    pub config: Config,
    pub ws_manager: Arc<WsManager>,
}

pub async fn create_app(config: Config) -> Result<Router> {
    // Initialize database
    let db = Database::new(&config.database_url).await?;
    
    // Run migrations
    db.run_migrations().await?;

    // Initialize WebSocket manager
    let ws_manager = WsManager::new();

    let state = Arc::new(AppState { 
        db, 
        config,
        ws_manager: ws_manager.clone(),
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(ws::ws_handler))
        .nest("/api/v1", routes::api_routes())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    Ok(app)
}

async fn health_check() -> &'static str {
    "OK"
}
