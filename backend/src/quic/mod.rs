// QUIC transport module for the messaging system
// Provides QUIC protocol support using Quinn library

pub mod auth;
pub mod config;
pub mod connection_manager;
pub mod diagnostics;
pub mod message_router;
pub mod metrics;
pub mod server;
pub mod stream_allocator;

pub use auth::{AuthRequest, AuthResponse, QuicAuthError, QuicAuthenticator};
pub use config::{QuicConfig, QuicServerConfig};
pub use connection_manager::{
    Connection as ManagedConnection, ConnectionId, ConnectionManager, ConnectionManagerError,
    ConnectionStats, MigrationState, MigrationStats, QuicConnection, TransportType,
    WebSocketConnection,
};
pub use diagnostics::{DiagnosticLogger, PerformanceMonitor};
pub use message_router::{MessageRouter, MessageRouterError};
pub use metrics::{MetricsSnapshot, PerformanceMetrics, QuicMetrics};
pub use server::{QuicServer, QuicServerError, ServerState};
pub use stream_allocator::{
    MessageType, StreamAllocator, StreamAllocatorError, StreamAllocatorStats, StreamRange,
    StreamType,
};

// Re-export commonly used types
pub use quinn::{Connection, Endpoint, RecvStream, SendStream};
