use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use std::sync::Arc;

use crate::AppState;
use crate::quic::MetricsSnapshot;

/// Get QUIC metrics
///
/// # Requirements
/// - 8.3: Expose QUIC metrics via HTTP endpoint
/// - 8.3: Return JSON with connection stats
/// - 8.3: Include performance metrics
///
/// # Returns
/// JSON response with:
/// - Connection statistics (total, QUIC, WebSocket counts)
/// - Migration statistics
/// - Performance metrics (throughput, latency)
/// - QUIC to WebSocket ratio
/// - Uptime
async fn get_metrics(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<MetricsSnapshot>, (StatusCode, String)> {
    // Check if QUIC metrics are available
    // For now, we'll return a placeholder response since QUIC server
    // integration with AppState will be done in task 10
    
    // TODO: Once QUIC server is integrated into AppState (task 10),
    // retrieve metrics from the QUIC metrics collector
    
    // Return a placeholder error for now
    Err((
        StatusCode::SERVICE_UNAVAILABLE,
        "QUIC metrics not available - QUIC server not yet integrated".to_string(),
    ))
}

/// Health check endpoint for QUIC server
///
/// # Requirements
/// - 8.3: Expose QUIC metrics via HTTP endpoint
async fn quic_health(
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // TODO: Once QUIC server is integrated into AppState (task 10),
    // check if QUIC server is running
    
    // For now, return service unavailable
    (
        StatusCode::SERVICE_UNAVAILABLE,
        "QUIC server not yet integrated",
    )
}

/// Metrics routes
///
/// # Requirements
/// - 8.3: Expose QUIC metrics via HTTP endpoint
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/quic", get(get_metrics))
        .route("/quic/health", get(quic_health))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_compile() {
        // This test just ensures the routes function compiles correctly
        // Actual integration testing will be done when QUIC is fully integrated
        let _routes = routes();
    }
}
