use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

use crate::quic::connection_manager::{ConnectionManager, ConnectionStats, MigrationStats};

/// QUIC metrics collector
///
/// # Requirements
/// - 8.1: Track active connection counts by type
/// - 8.1: Measure throughput and latency
/// - 8.4: Calculate QUIC vs WebSocket ratio
pub struct QuicMetrics {
    /// Connection manager reference
    connection_manager: Arc<ConnectionManager>,
    /// Performance metrics
    performance: Arc<RwLock<PerformanceMetrics>>,
    /// Start time for uptime calculation
    start_time: Instant,
}

/// Performance metrics for QUIC connections
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    /// Total bytes sent over QUIC
    pub bytes_sent: u64,
    /// Total bytes received over QUIC
    pub bytes_received: u64,
    /// Total messages sent over QUIC
    pub messages_sent: u64,
    /// Total messages received over QUIC
    pub messages_received: u64,
    /// Average latency in milliseconds
    pub avg_latency_ms: f64,
    /// Peak latency in milliseconds
    pub peak_latency_ms: f64,
    /// Latency samples collected
    latency_samples: Vec<f64>,
    /// Maximum number of latency samples to keep
    max_latency_samples: usize,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            bytes_sent: 0,
            bytes_received: 0,
            messages_sent: 0,
            messages_received: 0,
            avg_latency_ms: 0.0,
            peak_latency_ms: 0.0,
            latency_samples: Vec::new(),
            max_latency_samples: 1000,
        }
    }
}

impl PerformanceMetrics {
    /// Record bytes sent
    ///
    /// # Requirements
    /// - 8.1: Measure throughput
    pub fn record_bytes_sent(&mut self, bytes: u64) {
        self.bytes_sent += bytes;
    }

    /// Record bytes received
    ///
    /// # Requirements
    /// - 8.1: Measure throughput
    pub fn record_bytes_received(&mut self, bytes: u64) {
        self.bytes_received += bytes;
    }

    /// Record a message sent
    ///
    /// # Requirements
    /// - 8.1: Track active connection counts by type
    pub fn record_message_sent(&mut self) {
        self.messages_sent += 1;
    }

    /// Record a message received
    ///
    /// # Requirements
    /// - 8.1: Track active connection counts by type
    pub fn record_message_received(&mut self) {
        self.messages_received += 1;
    }

    /// Record a latency sample
    ///
    /// # Requirements
    /// - 8.1: Measure latency
    pub fn record_latency(&mut self, latency_ms: f64) {
        // Update peak latency
        if latency_ms > self.peak_latency_ms {
            self.peak_latency_ms = latency_ms;
        }

        // Add sample
        self.latency_samples.push(latency_ms);

        // Keep only the most recent samples
        if self.latency_samples.len() > self.max_latency_samples {
            self.latency_samples.remove(0);
        }

        // Recalculate average
        if !self.latency_samples.is_empty() {
            let sum: f64 = self.latency_samples.iter().sum();
            self.avg_latency_ms = sum / self.latency_samples.len() as f64;
        }
    }

    /// Get throughput in bytes per second
    ///
    /// # Requirements
    /// - 8.1: Measure throughput
    pub fn throughput_bps(&self, duration: Duration) -> f64 {
        let total_bytes = self.bytes_sent + self.bytes_received;
        let seconds = duration.as_secs_f64();
        if seconds > 0.0 {
            total_bytes as f64 / seconds
        } else {
            0.0
        }
    }

    /// Get messages per second
    ///
    /// # Requirements
    /// - 8.1: Measure throughput
    pub fn messages_per_second(&self, duration: Duration) -> f64 {
        let total_messages = self.messages_sent + self.messages_received;
        let seconds = duration.as_secs_f64();
        if seconds > 0.0 {
            total_messages as f64 / seconds
        } else {
            0.0
        }
    }
}

/// Complete metrics snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    /// Connection statistics
    pub connections: ConnectionStats,
    /// Migration statistics
    pub migrations: MigrationStats,
    /// Performance metrics
    pub performance: PerformanceMetrics,
    /// QUIC to WebSocket ratio
    ///
    /// # Requirements
    /// - 8.4: Calculate QUIC vs WebSocket ratio
    pub quic_to_websocket_ratio: f64,
    /// Uptime in seconds
    pub uptime_seconds: u64,
    /// Timestamp of this snapshot
    pub timestamp: String,
}

impl QuicMetrics {
    /// Create a new metrics collector
    ///
    /// # Requirements
    /// - 8.1: Track active connection counts by type
    pub fn new(connection_manager: Arc<ConnectionManager>) -> Self {
        Self {
            connection_manager,
            performance: Arc::new(RwLock::new(PerformanceMetrics::default())),
            start_time: Instant::now(),
        }
    }

    /// Record bytes sent
    ///
    /// # Requirements
    /// - 8.1: Measure throughput
    pub async fn record_bytes_sent(&self, bytes: u64) {
        let mut perf = self.performance.write().await;
        perf.record_bytes_sent(bytes);
    }

    /// Record bytes received
    ///
    /// # Requirements
    /// - 8.1: Measure throughput
    pub async fn record_bytes_received(&self, bytes: u64) {
        let mut perf = self.performance.write().await;
        perf.record_bytes_received(bytes);
    }

    /// Record a message sent
    ///
    /// # Requirements
    /// - 8.1: Track active connection counts by type
    pub async fn record_message_sent(&self) {
        let mut perf = self.performance.write().await;
        perf.record_message_sent();
    }

    /// Record a message received
    ///
    /// # Requirements
    /// - 8.1: Track active connection counts by type
    pub async fn record_message_received(&self) {
        let mut perf = self.performance.write().await;
        perf.record_message_received();
    }

    /// Record a latency sample
    ///
    /// # Requirements
    /// - 8.1: Measure latency
    pub async fn record_latency(&self, latency_ms: f64) {
        let mut perf = self.performance.write().await;
        perf.record_latency(latency_ms);
    }

    /// Get a complete metrics snapshot
    ///
    /// # Requirements
    /// - 8.1: Track active connection counts by type
    /// - 8.1: Measure throughput and latency
    /// - 8.4: Calculate QUIC vs WebSocket ratio
    pub async fn snapshot(&self) -> MetricsSnapshot {
        let connections = self.connection_manager.get_stats().await;
        let migrations = self.connection_manager.get_migration_stats().await;
        let performance = self.performance.read().await.clone();
        let uptime = self.start_time.elapsed();

        // Calculate QUIC to WebSocket ratio
        let quic_to_websocket_ratio = if connections.websocket_connections > 0 {
            connections.quic_connections as f64 / connections.websocket_connections as f64
        } else if connections.quic_connections > 0 {
            f64::INFINITY
        } else {
            0.0
        };

        MetricsSnapshot {
            connections,
            migrations,
            performance,
            quic_to_websocket_ratio,
            uptime_seconds: uptime.as_secs(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Get connection statistics
    ///
    /// # Requirements
    /// - 8.1: Track active connection counts by type
    pub async fn get_connection_stats(&self) -> ConnectionStats {
        self.connection_manager.get_stats().await
    }

    /// Get migration statistics
    ///
    /// # Requirements
    /// - 8.1: Track active connection counts by type
    pub async fn get_migration_stats(&self) -> MigrationStats {
        self.connection_manager.get_migration_stats().await
    }

    /// Get performance metrics
    ///
    /// # Requirements
    /// - 8.1: Measure throughput and latency
    pub async fn get_performance_metrics(&self) -> PerformanceMetrics {
        self.performance.read().await.clone()
    }

    /// Get QUIC to WebSocket ratio
    ///
    /// # Requirements
    /// - 8.4: Calculate QUIC vs WebSocket ratio
    pub async fn get_quic_to_websocket_ratio(&self) -> f64 {
        let stats = self.connection_manager.get_stats().await;
        if stats.websocket_connections > 0 {
            stats.quic_connections as f64 / stats.websocket_connections as f64
        } else if stats.quic_connections > 0 {
            f64::INFINITY
        } else {
            0.0
        }
    }

    /// Get uptime in seconds
    pub fn uptime_seconds(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Reset performance metrics
    pub async fn reset_performance_metrics(&self) {
        let mut perf = self.performance.write().await;
        *perf = PerformanceMetrics::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_performance_metrics_default() {
        let metrics = PerformanceMetrics::default();
        assert_eq!(metrics.bytes_sent, 0);
        assert_eq!(metrics.bytes_received, 0);
        assert_eq!(metrics.messages_sent, 0);
        assert_eq!(metrics.messages_received, 0);
        assert_eq!(metrics.avg_latency_ms, 0.0);
        assert_eq!(metrics.peak_latency_ms, 0.0);
    }

    #[test]
    fn test_record_bytes() {
        let mut metrics = PerformanceMetrics::default();
        metrics.record_bytes_sent(100);
        metrics.record_bytes_received(200);
        assert_eq!(metrics.bytes_sent, 100);
        assert_eq!(metrics.bytes_received, 200);
    }

    #[test]
    fn test_record_messages() {
        let mut metrics = PerformanceMetrics::default();
        metrics.record_message_sent();
        metrics.record_message_sent();
        metrics.record_message_received();
        assert_eq!(metrics.messages_sent, 2);
        assert_eq!(metrics.messages_received, 1);
    }

    #[test]
    fn test_record_latency() {
        let mut metrics = PerformanceMetrics::default();
        metrics.record_latency(10.0);
        metrics.record_latency(20.0);
        metrics.record_latency(30.0);
        
        assert_eq!(metrics.avg_latency_ms, 20.0);
        assert_eq!(metrics.peak_latency_ms, 30.0);
        assert_eq!(metrics.latency_samples.len(), 3);
    }

    #[test]
    fn test_latency_sample_limit() {
        let mut metrics = PerformanceMetrics::default();
        metrics.max_latency_samples = 5;
        
        for i in 1..=10 {
            metrics.record_latency(i as f64);
        }
        
        // Should only keep the last 5 samples
        assert_eq!(metrics.latency_samples.len(), 5);
        assert_eq!(metrics.latency_samples[0], 6.0);
        assert_eq!(metrics.latency_samples[4], 10.0);
    }

    #[test]
    fn test_throughput_bps() {
        let mut metrics = PerformanceMetrics::default();
        metrics.record_bytes_sent(1000);
        metrics.record_bytes_received(2000);
        
        let duration = Duration::from_secs(1);
        let throughput = metrics.throughput_bps(duration);
        assert_eq!(throughput, 3000.0);
    }

    #[test]
    fn test_messages_per_second() {
        let mut metrics = PerformanceMetrics::default();
        metrics.record_message_sent();
        metrics.record_message_sent();
        metrics.record_message_received();
        
        let duration = Duration::from_secs(1);
        let mps = metrics.messages_per_second(duration);
        assert_eq!(mps, 3.0);
    }

    #[tokio::test]
    async fn test_quic_metrics_new() {
        let connection_manager = Arc::new(ConnectionManager::new());
        let metrics = QuicMetrics::new(connection_manager);
        
        assert_eq!(metrics.uptime_seconds(), 0);
    }

    #[tokio::test]
    async fn test_quic_metrics_record_operations() {
        let connection_manager = Arc::new(ConnectionManager::new());
        let metrics = QuicMetrics::new(connection_manager);
        
        metrics.record_bytes_sent(100).await;
        metrics.record_bytes_received(200).await;
        metrics.record_message_sent().await;
        metrics.record_message_received().await;
        metrics.record_latency(15.0).await;
        
        let perf = metrics.get_performance_metrics().await;
        assert_eq!(perf.bytes_sent, 100);
        assert_eq!(perf.bytes_received, 200);
        assert_eq!(perf.messages_sent, 1);
        assert_eq!(perf.messages_received, 1);
        assert_eq!(perf.avg_latency_ms, 15.0);
    }

    #[tokio::test]
    async fn test_quic_metrics_snapshot() {
        let connection_manager = Arc::new(ConnectionManager::new());
        let metrics = QuicMetrics::new(connection_manager);
        
        metrics.record_bytes_sent(1000).await;
        metrics.record_message_sent().await;
        
        let snapshot = metrics.snapshot().await;
        assert_eq!(snapshot.performance.bytes_sent, 1000);
        assert_eq!(snapshot.performance.messages_sent, 1);
        assert!(!snapshot.timestamp.is_empty());
    }

    #[tokio::test]
    async fn test_quic_to_websocket_ratio() {
        let connection_manager = Arc::new(ConnectionManager::new());
        let metrics = QuicMetrics::new(connection_manager);
        
        // With no connections, ratio should be 0
        let ratio = metrics.get_quic_to_websocket_ratio().await;
        assert_eq!(ratio, 0.0);
    }

    #[tokio::test]
    async fn test_reset_performance_metrics() {
        let connection_manager = Arc::new(ConnectionManager::new());
        let metrics = QuicMetrics::new(connection_manager);
        
        metrics.record_bytes_sent(1000).await;
        metrics.record_message_sent().await;
        
        metrics.reset_performance_metrics().await;
        
        let perf = metrics.get_performance_metrics().await;
        assert_eq!(perf.bytes_sent, 0);
        assert_eq!(perf.messages_sent, 0);
    }
}
