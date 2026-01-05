use std::time::Duration;
use uuid::Uuid;
use crate::quic::connection_manager::ConnectionId;

/// Diagnostic logger for QUIC connections
///
/// # Requirements
/// - 8.2: Log connection lifecycle events
/// - 8.2: Log performance issues with details
/// - 8.2: Log errors with full context
pub struct DiagnosticLogger;

impl DiagnosticLogger {
    /// Log connection establishment
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_connection_established(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        remote_addr: std::net::SocketAddr,
    ) {
        tracing::info!(
            connection_id = %connection_id,
            user_id = ?user_id,
            remote_addr = %remote_addr,
            event = "connection_established",
            "QUIC connection established"
        );
    }

    /// Log connection closed
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_connection_closed(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        reason: &str,
        duration: Duration,
    ) {
        tracing::info!(
            connection_id = %connection_id,
            user_id = ?user_id,
            reason = reason,
            duration_secs = duration.as_secs(),
            event = "connection_closed",
            "QUIC connection closed"
        );
    }

    /// Log connection timeout
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    /// - 8.2: Log performance issues with details
    pub fn log_connection_timeout(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        idle_duration: Duration,
    ) {
        tracing::warn!(
            connection_id = %connection_id,
            user_id = ?user_id,
            idle_duration_secs = idle_duration.as_secs(),
            event = "connection_timeout",
            "QUIC connection timed out due to inactivity"
        );
    }

    /// Log connection migration started
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_migration_started(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        old_addr: std::net::SocketAddr,
        new_addr: std::net::SocketAddr,
    ) {
        tracing::info!(
            connection_id = %connection_id,
            user_id = ?user_id,
            old_addr = %old_addr,
            new_addr = %new_addr,
            event = "migration_started",
            "QUIC connection migration started"
        );
    }

    /// Log connection migration completed
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_migration_completed(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        duration: Duration,
        migration_count: u32,
    ) {
        tracing::info!(
            connection_id = %connection_id,
            user_id = ?user_id,
            duration_ms = duration.as_millis(),
            migration_count = migration_count,
            event = "migration_completed",
            "QUIC connection migration completed successfully"
        );
    }

    /// Log connection migration failed
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    /// - 8.2: Log errors with full context
    pub fn log_migration_failed(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        reason: &str,
        duration: Duration,
    ) {
        tracing::error!(
            connection_id = %connection_id,
            user_id = ?user_id,
            reason = reason,
            duration_ms = duration.as_millis(),
            event = "migration_failed",
            "QUIC connection migration failed"
        );
    }

    /// Log high latency detected
    ///
    /// # Requirements
    /// - 8.2: Log performance issues with details
    pub fn log_high_latency(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        latency_ms: f64,
        threshold_ms: f64,
    ) {
        tracing::warn!(
            connection_id = %connection_id,
            user_id = ?user_id,
            latency_ms = latency_ms,
            threshold_ms = threshold_ms,
            event = "high_latency",
            "High latency detected on QUIC connection"
        );
    }

    /// Log low throughput detected
    ///
    /// # Requirements
    /// - 8.2: Log performance issues with details
    pub fn log_low_throughput(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        throughput_bps: f64,
        threshold_bps: f64,
    ) {
        tracing::warn!(
            connection_id = %connection_id,
            user_id = ?user_id,
            throughput_bps = throughput_bps,
            threshold_bps = threshold_bps,
            event = "low_throughput",
            "Low throughput detected on QUIC connection"
        );
    }

    /// Log stream allocation
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_stream_allocated(
        connection_id: ConnectionId,
        stream_id: u64,
        stream_type: &str,
    ) {
        tracing::debug!(
            connection_id = %connection_id,
            stream_id = stream_id,
            stream_type = stream_type,
            event = "stream_allocated",
            "Stream allocated for QUIC connection"
        );
    }

    /// Log stream released
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_stream_released(
        connection_id: ConnectionId,
        stream_id: u64,
        duration: Duration,
    ) {
        tracing::debug!(
            connection_id = %connection_id,
            stream_id = stream_id,
            duration_ms = duration.as_millis(),
            event = "stream_released",
            "Stream released for QUIC connection"
        );
    }

    /// Log authentication attempt
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_auth_attempt(
        connection_id: ConnectionId,
        remote_addr: std::net::SocketAddr,
    ) {
        tracing::info!(
            connection_id = %connection_id,
            remote_addr = %remote_addr,
            event = "auth_attempt",
            "QUIC authentication attempt"
        );
    }

    /// Log authentication success
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_auth_success(
        connection_id: ConnectionId,
        user_id: Uuid,
        user_name: &str,
        duration: Duration,
    ) {
        tracing::info!(
            connection_id = %connection_id,
            user_id = %user_id,
            user_name = user_name,
            duration_ms = duration.as_millis(),
            event = "auth_success",
            "QUIC authentication successful"
        );
    }

    /// Log authentication failure
    ///
    /// # Requirements
    /// - 8.2: Log errors with full context
    pub fn log_auth_failure(
        connection_id: ConnectionId,
        remote_addr: std::net::SocketAddr,
        reason: &str,
        duration: Duration,
    ) {
        tracing::warn!(
            connection_id = %connection_id,
            remote_addr = %remote_addr,
            reason = reason,
            duration_ms = duration.as_millis(),
            event = "auth_failure",
            "QUIC authentication failed"
        );
    }

    /// Log message sent
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_message_sent(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        message_type: &str,
        size_bytes: usize,
    ) {
        tracing::debug!(
            connection_id = %connection_id,
            user_id = ?user_id,
            message_type = message_type,
            size_bytes = size_bytes,
            event = "message_sent",
            "Message sent over QUIC"
        );
    }

    /// Log message received
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_message_received(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        message_type: &str,
        size_bytes: usize,
    ) {
        tracing::debug!(
            connection_id = %connection_id,
            user_id = ?user_id,
            message_type = message_type,
            size_bytes = size_bytes,
            event = "message_received",
            "Message received over QUIC"
        );
    }

    /// Log error with full context
    ///
    /// # Requirements
    /// - 8.2: Log errors with full context
    pub fn log_error(
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        error_type: &str,
        error_message: &str,
        context: Option<&str>,
    ) {
        tracing::error!(
            connection_id = %connection_id,
            user_id = ?user_id,
            error_type = error_type,
            error_message = error_message,
            context = ?context,
            event = "error",
            "QUIC error occurred"
        );
    }

    /// Log keep-alive sent
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_keepalive_sent(
        connection_id: ConnectionId,
        idle_duration: Duration,
    ) {
        tracing::trace!(
            connection_id = %connection_id,
            idle_duration_secs = idle_duration.as_secs(),
            event = "keepalive_sent",
            "Keep-alive sent for QUIC connection"
        );
    }

    /// Log server started
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_server_started(
        bind_addr: std::net::SocketAddr,
        max_connections: usize,
    ) {
        tracing::info!(
            bind_addr = %bind_addr,
            max_connections = max_connections,
            event = "server_started",
            "QUIC server started"
        );
    }

    /// Log server stopped
    ///
    /// # Requirements
    /// - 8.2: Log connection lifecycle events
    pub fn log_server_stopped(
        uptime: Duration,
        total_connections: usize,
    ) {
        tracing::info!(
            uptime_secs = uptime.as_secs(),
            total_connections = total_connections,
            event = "server_stopped",
            "QUIC server stopped"
        );
    }

    /// Log performance metrics snapshot
    ///
    /// # Requirements
    /// - 8.2: Log performance issues with details
    pub fn log_metrics_snapshot(
        total_connections: usize,
        quic_connections: usize,
        websocket_connections: usize,
        throughput_bps: f64,
        avg_latency_ms: f64,
        peak_latency_ms: f64,
    ) {
        tracing::info!(
            total_connections = total_connections,
            quic_connections = quic_connections,
            websocket_connections = websocket_connections,
            throughput_bps = throughput_bps,
            avg_latency_ms = avg_latency_ms,
            peak_latency_ms = peak_latency_ms,
            event = "metrics_snapshot",
            "QUIC metrics snapshot"
        );
    }
}

/// Performance monitor that checks for issues and logs them
///
/// # Requirements
/// - 8.2: Log performance issues with details
pub struct PerformanceMonitor {
    /// Latency threshold in milliseconds
    latency_threshold_ms: f64,
    /// Throughput threshold in bytes per second
    throughput_threshold_bps: f64,
}

impl PerformanceMonitor {
    /// Create a new performance monitor with default thresholds
    pub fn new() -> Self {
        Self {
            latency_threshold_ms: 100.0, // 100ms
            throughput_threshold_bps: 1_000_000.0, // 1 Mbps
        }
    }

    /// Create a new performance monitor with custom thresholds
    pub fn with_thresholds(latency_threshold_ms: f64, throughput_threshold_bps: f64) -> Self {
        Self {
            latency_threshold_ms,
            throughput_threshold_bps,
        }
    }

    /// Check latency and log if it exceeds threshold
    ///
    /// # Requirements
    /// - 8.2: Log performance issues with details
    pub fn check_latency(
        &self,
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        latency_ms: f64,
    ) {
        if latency_ms > self.latency_threshold_ms {
            DiagnosticLogger::log_high_latency(
                connection_id,
                user_id,
                latency_ms,
                self.latency_threshold_ms,
            );
        }
    }

    /// Check throughput and log if it's below threshold
    ///
    /// # Requirements
    /// - 8.2: Log performance issues with details
    pub fn check_throughput(
        &self,
        connection_id: ConnectionId,
        user_id: Option<Uuid>,
        throughput_bps: f64,
    ) {
        if throughput_bps < self.throughput_threshold_bps {
            DiagnosticLogger::log_low_throughput(
                connection_id,
                user_id,
                throughput_bps,
                self.throughput_threshold_bps,
            );
        }
    }
}

impl Default for PerformanceMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_performance_monitor_new() {
        let monitor = PerformanceMonitor::new();
        assert_eq!(monitor.latency_threshold_ms, 100.0);
        assert_eq!(monitor.throughput_threshold_bps, 1_000_000.0);
    }

    #[test]
    fn test_performance_monitor_with_thresholds() {
        let monitor = PerformanceMonitor::with_thresholds(50.0, 500_000.0);
        assert_eq!(monitor.latency_threshold_ms, 50.0);
        assert_eq!(monitor.throughput_threshold_bps, 500_000.0);
    }

    #[test]
    fn test_diagnostic_logger_methods_compile() {
        // This test just ensures all the logging methods compile correctly
        // The actual logging output is not tested as it goes to tracing
        let connection_id = ConnectionId::new();
        let user_id = Some(Uuid::new_v4());
        let remote_addr = "127.0.0.1:8080".parse().unwrap();
        
        DiagnosticLogger::log_connection_established(connection_id, user_id, remote_addr);
        DiagnosticLogger::log_connection_closed(connection_id, user_id, "test", Duration::from_secs(1));
        DiagnosticLogger::log_connection_timeout(connection_id, user_id, Duration::from_secs(30));
        DiagnosticLogger::log_high_latency(connection_id, user_id, 150.0, 100.0);
        DiagnosticLogger::log_low_throughput(connection_id, user_id, 500_000.0, 1_000_000.0);
        DiagnosticLogger::log_stream_allocated(connection_id, 1, "control");
        DiagnosticLogger::log_stream_released(connection_id, 1, Duration::from_secs(1));
        DiagnosticLogger::log_auth_attempt(connection_id, remote_addr);
        DiagnosticLogger::log_auth_success(connection_id, user_id.unwrap(), "test_user", Duration::from_millis(50));
        DiagnosticLogger::log_auth_failure(connection_id, remote_addr, "invalid token", Duration::from_millis(50));
        DiagnosticLogger::log_message_sent(connection_id, user_id, "chat", 100);
        DiagnosticLogger::log_message_received(connection_id, user_id, "chat", 100);
        DiagnosticLogger::log_error(connection_id, user_id, "connection_error", "test error", Some("test context"));
        DiagnosticLogger::log_keepalive_sent(connection_id, Duration::from_secs(5));
        DiagnosticLogger::log_server_started(remote_addr, 1000);
        DiagnosticLogger::log_server_stopped(Duration::from_secs(3600), 100);
        DiagnosticLogger::log_metrics_snapshot(100, 50, 50, 1_000_000.0, 50.0, 100.0);
        
        let old_addr = "127.0.0.1:8080".parse().unwrap();
        let new_addr = "127.0.0.1:8081".parse().unwrap();
        DiagnosticLogger::log_migration_started(connection_id, user_id, old_addr, new_addr);
        DiagnosticLogger::log_migration_completed(connection_id, user_id, Duration::from_millis(100), 1);
        DiagnosticLogger::log_migration_failed(connection_id, user_id, "timeout", Duration::from_secs(5));
    }
}
