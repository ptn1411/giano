use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;
use thiserror::Error;

/// Configuration errors
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing required environment variable: {0}")]
    MissingEnvVar(String),

    #[error("Invalid value for {0}: {1}")]
    InvalidValue(String, String),

    #[error("Invalid socket address: {0}")]
    InvalidSocketAddr(#[from] std::net::AddrParseError),

    #[error("Invalid number: {0}")]
    InvalidNumber(#[from] std::num::ParseIntError),
}

/// QUIC server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuicServerConfig {
    /// Whether QUIC is enabled
    pub enabled: bool,

    /// Bind address for QUIC server
    pub bind_address: String,

    /// UDP port for QUIC server
    pub port: u16,

    /// Path to TLS certificate file
    pub cert_path: PathBuf,

    /// Path to TLS private key file
    pub key_path: PathBuf,

    /// Maximum number of concurrent connections
    pub max_connections: usize,

    /// Maximum number of streams per connection
    pub max_streams_per_connection: u64,

    /// Idle timeout in milliseconds
    pub idle_timeout_ms: u64,

    /// Keep-alive interval in milliseconds
    pub keep_alive_interval_ms: u64,
}

impl Default for QuicServerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            bind_address: "0.0.0.0".to_string(),
            port: 4433,
            cert_path: PathBuf::from("./certs/server.crt"),
            key_path: PathBuf::from("./certs/server.key"),
            max_connections: 10000,
            max_streams_per_connection: 100,
            idle_timeout_ms: 30000,
            keep_alive_interval_ms: 5000,
        }
    }
}

impl QuicServerConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        let mut config = Self::default();

        // QUIC_ENABLED (optional, defaults to false)
        if let Ok(enabled) = std::env::var("QUIC_ENABLED") {
            config.enabled = enabled.to_lowercase() == "true" || enabled == "1";
        }

        // QUIC_BIND_ADDRESS (optional)
        if let Ok(bind_address) = std::env::var("QUIC_BIND_ADDRESS") {
            config.bind_address = bind_address;
        }

        // QUIC_PORT (optional)
        if let Ok(port_str) = std::env::var("QUIC_PORT") {
            config.port = port_str.parse().map_err(|e| {
                ConfigError::InvalidValue("QUIC_PORT".to_string(), format!("{}", e))
            })?;
        }

        // QUIC_CERT_PATH (optional)
        if let Ok(cert_path) = std::env::var("QUIC_CERT_PATH") {
            config.cert_path = PathBuf::from(cert_path);
        }

        // QUIC_KEY_PATH (optional)
        if let Ok(key_path) = std::env::var("QUIC_KEY_PATH") {
            config.key_path = PathBuf::from(key_path);
        }

        // QUIC_MAX_CONNECTIONS (optional)
        if let Ok(max_conn_str) = std::env::var("QUIC_MAX_CONNECTIONS") {
            config.max_connections = max_conn_str.parse()?;
        }

        // QUIC_MAX_STREAMS_PER_CONNECTION (optional)
        if let Ok(max_streams_str) = std::env::var("QUIC_MAX_STREAMS_PER_CONNECTION") {
            config.max_streams_per_connection = max_streams_str.parse()?;
        }

        // QUIC_IDLE_TIMEOUT_MS (optional)
        if let Ok(idle_timeout_str) = std::env::var("QUIC_IDLE_TIMEOUT_MS") {
            config.idle_timeout_ms = idle_timeout_str.parse()?;
        }

        // QUIC_KEEP_ALIVE_INTERVAL_MS (optional)
        if let Ok(keep_alive_str) = std::env::var("QUIC_KEEP_ALIVE_INTERVAL_MS") {
            config.keep_alive_interval_ms = keep_alive_str.parse()?;
        }

        Ok(config)
    }

    /// Get the socket address for binding
    pub fn socket_addr(&self) -> Result<SocketAddr, ConfigError> {
        let addr_str = format!("{}:{}", self.bind_address, self.port);
        Ok(addr_str.parse()?)
    }

    /// Get idle timeout as Duration
    pub fn idle_timeout(&self) -> Duration {
        Duration::from_millis(self.idle_timeout_ms)
    }

    /// Get keep-alive interval as Duration
    pub fn keep_alive_interval(&self) -> Duration {
        Duration::from_millis(self.keep_alive_interval_ms)
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<(), ConfigError> {
        // Validate port range
        if self.port == 0 {
            return Err(ConfigError::InvalidValue(
                "QUIC_PORT".to_string(),
                "Port cannot be 0".to_string(),
            ));
        }

        // Validate max connections
        if self.max_connections == 0 {
            return Err(ConfigError::InvalidValue(
                "QUIC_MAX_CONNECTIONS".to_string(),
                "Must be greater than 0".to_string(),
            ));
        }

        // Validate max streams
        if self.max_streams_per_connection == 0 {
            return Err(ConfigError::InvalidValue(
                "QUIC_MAX_STREAMS_PER_CONNECTION".to_string(),
                "Must be greater than 0".to_string(),
            ));
        }

        // Validate timeouts
        if self.idle_timeout_ms == 0 {
            return Err(ConfigError::InvalidValue(
                "QUIC_IDLE_TIMEOUT_MS".to_string(),
                "Must be greater than 0".to_string(),
            ));
        }

        if self.keep_alive_interval_ms == 0 {
            return Err(ConfigError::InvalidValue(
                "QUIC_KEEP_ALIVE_INTERVAL_MS".to_string(),
                "Must be greater than 0".to_string(),
            ));
        }

        // Validate that keep-alive is less than idle timeout
        if self.keep_alive_interval_ms >= self.idle_timeout_ms {
            return Err(ConfigError::InvalidValue(
                "QUIC_KEEP_ALIVE_INTERVAL_MS".to_string(),
                "Keep-alive interval must be less than idle timeout".to_string(),
            ));
        }

        Ok(())
    }
}

/// Alias for backward compatibility
pub type QuicConfig = QuicServerConfig;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = QuicServerConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.bind_address, "0.0.0.0");
        assert_eq!(config.port, 4433);
        assert_eq!(config.max_connections, 10000);
        assert_eq!(config.max_streams_per_connection, 100);
        assert_eq!(config.idle_timeout_ms, 30000);
        assert_eq!(config.keep_alive_interval_ms, 5000);
    }

    #[test]
    fn test_socket_addr() {
        let config = QuicServerConfig::default();
        let addr = config.socket_addr().unwrap();
        assert_eq!(addr.to_string(), "0.0.0.0:4433");
    }

    #[test]
    fn test_durations() {
        let config = QuicServerConfig::default();
        assert_eq!(config.idle_timeout(), Duration::from_millis(30000));
        assert_eq!(
            config.keep_alive_interval(),
            Duration::from_millis(5000)
        );
    }

    #[test]
    fn test_validate_success() {
        let config = QuicServerConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_validate_zero_port() {
        let mut config = QuicServerConfig::default();
        config.port = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_zero_max_connections() {
        let mut config = QuicServerConfig::default();
        config.max_connections = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_zero_max_streams() {
        let mut config = QuicServerConfig::default();
        config.max_streams_per_connection = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_zero_idle_timeout() {
        let mut config = QuicServerConfig::default();
        config.idle_timeout_ms = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_zero_keep_alive() {
        let mut config = QuicServerConfig::default();
        config.keep_alive_interval_ms = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_keep_alive_greater_than_idle() {
        let mut config = QuicServerConfig::default();
        config.keep_alive_interval_ms = 40000;
        config.idle_timeout_ms = 30000;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_keep_alive_equal_to_idle() {
        let mut config = QuicServerConfig::default();
        config.keep_alive_interval_ms = 30000;
        config.idle_timeout_ms = 30000;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_from_env_with_defaults() {
        // Clear any existing env vars
        std::env::remove_var("QUIC_ENABLED");
        std::env::remove_var("QUIC_PORT");
        
        let config = QuicServerConfig::from_env().unwrap();
        assert!(!config.enabled); // Default is false
        assert_eq!(config.port, 4433); // Default port
    }

    #[test]
    fn test_from_env_with_custom_values() {
        // Set custom env vars
        std::env::set_var("QUIC_ENABLED", "true");
        std::env::set_var("QUIC_PORT", "5000");
        std::env::set_var("QUIC_MAX_CONNECTIONS", "5000");
        
        let config = QuicServerConfig::from_env().unwrap();
        assert!(config.enabled);
        assert_eq!(config.port, 5000);
        assert_eq!(config.max_connections, 5000);
        
        // Clean up
        std::env::remove_var("QUIC_ENABLED");
        std::env::remove_var("QUIC_PORT");
        std::env::remove_var("QUIC_MAX_CONNECTIONS");
    }

    #[test]
    fn test_from_env_invalid_port() {
        std::env::set_var("QUIC_PORT", "invalid");
        
        let result = QuicServerConfig::from_env();
        assert!(result.is_err());
        
        // Clean up
        std::env::remove_var("QUIC_PORT");
    }
}
