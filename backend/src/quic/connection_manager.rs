use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use uuid::Uuid;
use quinn::Connection as QuinnConnection;
use thiserror::Error;

/// Callback for sending messages via WebSocket
/// This allows the ConnectionManager to delegate WebSocket sends to WsManager
pub type WebSocketSendCallback = Arc<dyn Fn(Uuid, Vec<u8>) -> Result<(), String> + Send + Sync>;

/// Connection manager errors
#[derive(Debug, Error)]
pub enum ConnectionManagerError {
    #[error("Connection not found: {0}")]
    ConnectionNotFound(ConnectionId),

    #[error("User not found: {0}")]
    UserNotFound(Uuid),

    #[error("Send error: {0}")]
    SendError(String),

    #[error("Connection closed")]
    ConnectionClosed,

    #[error("Invalid connection type")]
    InvalidConnectionType,
}

/// Unique identifier for a connection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ConnectionId(Uuid);

impl ConnectionId {
    /// Create a new random connection ID
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Get the inner UUID
    pub fn as_uuid(&self) -> Uuid {
        self.0
    }
}

impl Default for ConnectionId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for ConnectionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Type of transport connection
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportType {
    /// QUIC connection
    Quic,
    /// WebSocket connection
    WebSocket,
}

/// Represents a QUIC connection with its state
#[derive(Debug)]
pub struct QuicConnection {
    /// Connection ID
    pub connection_id: ConnectionId,
    /// User ID (if authenticated)
    pub user_id: Option<Uuid>,
    /// Quinn connection handle
    pub quinn_connection: QuinnConnection,
    /// Last activity timestamp
    pub last_activity: Instant,
    /// Connection established timestamp
    pub connected_at: Instant,
    /// Migration state
    pub migration_state: MigrationState,
    /// Number of successful migrations
    pub migration_count: u32,
    /// Last migration timestamp
    pub last_migration: Option<Instant>,
    /// Migration start timestamp (for timeout detection)
    pub migration_started_at: Option<Instant>,
}

/// Connection migration state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrationState {
    /// No migration in progress
    Stable,
    /// Migration in progress
    Migrating,
    /// Migration completed successfully
    MigrationCompleted,
    /// Migration failed
    MigrationFailed,
}

impl QuicConnection {
    /// Create a new QUIC connection
    pub fn new(connection_id: ConnectionId, quinn_connection: QuinnConnection) -> Self {
        let now = Instant::now();
        Self {
            connection_id,
            user_id: None,
            quinn_connection,
            last_activity: now,
            connected_at: now,
            migration_state: MigrationState::Stable,
            migration_count: 0,
            last_migration: None,
            migration_started_at: None,
        }
    }

    /// Update the last activity timestamp
    pub fn update_activity(&mut self) {
        self.last_activity = Instant::now();
    }

    /// Set the authenticated user ID
    pub fn set_user_id(&mut self, user_id: Uuid) {
        self.user_id = Some(user_id);
    }

    /// Check if the connection is authenticated
    pub fn is_authenticated(&self) -> bool {
        self.user_id.is_some()
    }

    /// Get time since last activity
    pub fn time_since_activity(&self) -> std::time::Duration {
        self.last_activity.elapsed()
    }

    /// Start a migration
    ///
    /// # Requirements
    /// - 4.1: Detect the change and initiate connection migration
    pub fn start_migration(&mut self) {
        self.migration_state = MigrationState::Migrating;
        self.migration_started_at = Some(Instant::now());
        tracing::info!("Connection {} starting migration", self.connection_id);
    }

    /// Complete a migration successfully
    ///
    /// # Requirements
    /// - 4.2: Maintain session state and message ordering
    /// - 4.3: Resume message transmission without data loss
    pub fn complete_migration(&mut self) {
        self.migration_state = MigrationState::MigrationCompleted;
        self.migration_count += 1;
        self.last_migration = Some(Instant::now());
        self.migration_started_at = None;
        tracing::info!(
            "Connection {} completed migration (total migrations: {})",
            self.connection_id,
            self.migration_count
        );
        // Reset to stable state after recording the completion
        self.migration_state = MigrationState::Stable;
    }

    /// Mark a migration as failed
    ///
    /// # Requirements
    /// - 4.4: Notify the application layer to handle reconnection
    pub fn fail_migration(&mut self) {
        self.migration_state = MigrationState::MigrationFailed;
        self.migration_started_at = None;
        tracing::error!("Connection {} migration failed", self.connection_id);
    }

    /// Check if migration is in progress
    pub fn is_migrating(&self) -> bool {
        self.migration_state == MigrationState::Migrating
    }

    /// Check if migration has failed
    pub fn has_migration_failed(&self) -> bool {
        self.migration_state == MigrationState::MigrationFailed
    }

    /// Get the current migration state
    pub fn migration_state(&self) -> MigrationState {
        self.migration_state
    }

    /// Get the number of successful migrations
    pub fn migration_count(&self) -> u32 {
        self.migration_count
    }

    /// Get the time since last migration
    pub fn time_since_migration(&self) -> Option<std::time::Duration> {
        self.last_migration.map(|t| t.elapsed())
    }

    /// Get the time since migration started
    ///
    /// # Requirements
    /// - 4.4: Detect migration timeout
    pub fn time_since_migration_started(&self) -> Option<std::time::Duration> {
        self.migration_started_at.map(|t| t.elapsed())
    }

    /// Check if migration has timed out
    ///
    /// # Requirements
    /// - 4.4: Detect migration timeout
    ///
    /// # Arguments
    /// * `timeout` - Maximum time allowed for migration
    pub fn has_migration_timed_out(&self, timeout: Duration) -> bool {
        if let Some(duration) = self.time_since_migration_started() {
            duration > timeout
        } else {
            false
        }
    }
}

/// Represents a WebSocket connection reference
/// This is a placeholder for WebSocket connections managed by WsManager
#[derive(Debug, Clone)]
pub struct WebSocketConnection {
    /// Connection ID
    pub connection_id: ConnectionId,
    /// User ID
    pub user_id: Uuid,
    /// Last activity timestamp
    pub last_activity: Instant,
    /// Connection established timestamp
    pub connected_at: Instant,
}

impl WebSocketConnection {
    /// Create a new WebSocket connection reference
    pub fn new(connection_id: ConnectionId, user_id: Uuid) -> Self {
        let now = Instant::now();
        Self {
            connection_id,
            user_id,
            last_activity: now,
            connected_at: now,
        }
    }

    /// Update the last activity timestamp
    pub fn update_activity(&mut self) {
        self.last_activity = Instant::now();
    }

    /// Get time since last activity
    pub fn time_since_activity(&self) -> std::time::Duration {
        self.last_activity.elapsed()
    }
}

/// Unified connection type that can be either QUIC or WebSocket
#[derive(Debug)]
pub enum Connection {
    /// QUIC connection
    Quic(QuicConnection),
    /// WebSocket connection reference
    WebSocket(WebSocketConnection),
}

impl Connection {
    /// Get the connection ID
    pub fn connection_id(&self) -> ConnectionId {
        match self {
            Connection::Quic(conn) => conn.connection_id,
            Connection::WebSocket(conn) => conn.connection_id,
        }
    }

    /// Get the user ID (if authenticated)
    pub fn user_id(&self) -> Option<Uuid> {
        match self {
            Connection::Quic(conn) => conn.user_id,
            Connection::WebSocket(conn) => Some(conn.user_id),
        }
    }

    /// Get the transport type
    pub fn transport_type(&self) -> TransportType {
        match self {
            Connection::Quic(_) => TransportType::Quic,
            Connection::WebSocket(_) => TransportType::WebSocket,
        }
    }

    /// Update the last activity timestamp
    pub fn update_activity(&mut self) {
        match self {
            Connection::Quic(conn) => conn.update_activity(),
            Connection::WebSocket(conn) => conn.update_activity(),
        }
    }

    /// Get time since last activity
    pub fn time_since_activity(&self) -> std::time::Duration {
        match self {
            Connection::Quic(conn) => conn.time_since_activity(),
            Connection::WebSocket(conn) => conn.time_since_activity(),
        }
    }

    /// Get the last activity timestamp
    pub fn last_activity(&self) -> Instant {
        match self {
            Connection::Quic(conn) => conn.last_activity,
            Connection::WebSocket(conn) => conn.last_activity,
        }
    }

    /// Get the connected at timestamp
    pub fn connected_at(&self) -> Instant {
        match self {
            Connection::Quic(conn) => conn.connected_at,
            Connection::WebSocket(conn) => conn.connected_at,
        }
    }
}

/// Manages all active connections (QUIC and WebSocket)
pub struct ConnectionManager {
    /// Map of connection_id to Connection
    connections: Arc<RwLock<HashMap<ConnectionId, Connection>>>,
    /// Map of user_id to list of their connection IDs
    user_connections: Arc<RwLock<HashMap<Uuid, Vec<ConnectionId>>>>,
    /// Keep-alive interval
    keep_alive_interval: Duration,
    /// Idle timeout duration
    idle_timeout: Duration,
    /// Optional callback for sending WebSocket messages
    websocket_send_callback: Option<WebSocketSendCallback>,
}

impl ConnectionManager {
    /// Create a new connection manager with default timeouts
    pub fn new() -> Self {
        Self::with_timeouts(
            Duration::from_secs(5),  // 5 second keep-alive
            Duration::from_secs(30), // 30 second idle timeout
        )
    }

    /// Create a new connection manager with custom timeouts
    ///
    /// # Requirements
    /// - 1.4: Implement keep-alive packet handling
    /// - 1.4: Handle connection timeout detection
    pub fn with_timeouts(keep_alive_interval: Duration, idle_timeout: Duration) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            user_connections: Arc::new(RwLock::new(HashMap::new())),
            keep_alive_interval,
            idle_timeout,
            websocket_send_callback: None,
        }
    }

    /// Set the WebSocket send callback
    ///
    /// # Requirements
    /// - 5.4: Support both QUIC and WebSocket connections
    pub fn set_websocket_callback(&mut self, callback: WebSocketSendCallback) {
        self.websocket_send_callback = Some(callback);
    }

    /// Get the keep-alive interval
    pub fn keep_alive_interval(&self) -> Duration {
        self.keep_alive_interval
    }

    /// Get the idle timeout
    pub fn idle_timeout(&self) -> Duration {
        self.idle_timeout
    }

    /// Register a new connection
    ///
    /// # Requirements
    /// - 1.3: Track connections with user mappings
    /// - 1.4: Maintain connection state
    pub async fn register_connection(&self, connection: Connection) -> Result<ConnectionId, ConnectionManagerError> {
        let connection_id = connection.connection_id();
        let user_id = connection.user_id();

        // Add to connections map
        let mut connections = self.connections.write().await;
        connections.insert(connection_id, connection);

        // Add to user_connections map if authenticated
        if let Some(user_id) = user_id {
            let mut user_connections = self.user_connections.write().await;
            user_connections
                .entry(user_id)
                .or_insert_with(Vec::new)
                .push(connection_id);
        }

        tracing::info!(
            "Connection registered: connection_id={}, user_id={:?}",
            connection_id,
            user_id
        );

        Ok(connection_id)
    }

    /// Unregister a connection
    ///
    /// # Requirements
    /// - 1.3: Track connections with user mappings
    /// - 1.4: Maintain connection state
    pub async fn unregister_connection(&self, connection_id: ConnectionId) -> Result<(), ConnectionManagerError> {
        let mut connections = self.connections.write().await;
        
        // Get the connection to find the user_id
        let connection = connections
            .remove(&connection_id)
            .ok_or(ConnectionManagerError::ConnectionNotFound(connection_id))?;

        // Remove from user_connections map if authenticated
        if let Some(user_id) = connection.user_id() {
            let mut user_connections = self.user_connections.write().await;
            if let Some(conn_ids) = user_connections.get_mut(&user_id) {
                conn_ids.retain(|id| *id != connection_id);
                if conn_ids.is_empty() {
                    user_connections.remove(&user_id);
                }
            }
        }

        tracing::info!(
            "Connection unregistered: connection_id={}, user_id={:?}",
            connection_id,
            connection.user_id()
        );

        Ok(())
    }

    /// Get a connection by ID
    pub async fn get_connection(&self, connection_id: ConnectionId) -> Option<ConnectionId> {
        let connections = self.connections.read().await;
        connections.get(&connection_id).map(|_| connection_id)
    }

    /// Get all connection IDs for a user
    ///
    /// # Requirements
    /// - 1.3: Track user-to-connection mappings
    pub async fn get_user_connections(&self, user_id: Uuid) -> Vec<ConnectionId> {
        let user_connections = self.user_connections.read().await;
        user_connections
            .get(&user_id)
            .map(|ids| ids.clone())
            .unwrap_or_default()
    }

    /// Check if a user has any active connections
    pub async fn is_user_connected(&self, user_id: Uuid) -> bool {
        let user_connections = self.user_connections.read().await;
        user_connections
            .get(&user_id)
            .map(|ids| !ids.is_empty())
            .unwrap_or(false)
    }

    /// Get the number of active connections
    pub async fn connection_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections.len()
    }

    /// Get the number of active QUIC connections
    pub async fn quic_connection_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections
            .values()
            .filter(|conn| matches!(conn, Connection::Quic(_)))
            .count()
    }

    /// Get the number of active WebSocket connections
    pub async fn websocket_connection_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections
            .values()
            .filter(|conn| matches!(conn, Connection::WebSocket(_)))
            .count()
    }

    /// Update the last activity timestamp for a connection
    ///
    /// # Requirements
    /// - 1.4: Track connection activity timestamps
    pub async fn update_activity(&self, connection_id: ConnectionId) -> Result<(), ConnectionManagerError> {
        let mut connections = self.connections.write().await;
        let connection = connections
            .get_mut(&connection_id)
            .ok_or(ConnectionManagerError::ConnectionNotFound(connection_id))?;

        connection.update_activity();
        Ok(())
    }

    /// Get connections that have been inactive for longer than the specified duration
    ///
    /// # Requirements
    /// - 1.4: Handle connection timeout detection
    pub async fn get_inactive_connections(&self, timeout: std::time::Duration) -> Vec<ConnectionId> {
        let connections = self.connections.read().await;
        connections
            .iter()
            .filter(|(_, conn)| conn.time_since_activity() > timeout)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Get connections that need a keep-alive packet
    ///
    /// # Requirements
    /// - 1.4: Implement keep-alive packet handling
    pub async fn get_connections_needing_keepalive(&self) -> Vec<ConnectionId> {
        let connections = self.connections.read().await;
        connections
            .iter()
            .filter(|(_, conn)| {
                // Only QUIC connections need keep-alive
                matches!(conn, Connection::Quic(_))
                    && conn.time_since_activity() >= self.keep_alive_interval
            })
            .map(|(id, _)| *id)
            .collect()
    }

    /// Send a keep-alive packet to a QUIC connection
    ///
    /// # Requirements
    /// - 1.4: Implement keep-alive packet handling
    pub async fn send_keepalive(&self, connection_id: ConnectionId) -> Result<(), ConnectionManagerError> {
        let connections = self.connections.read().await;
        let connection = connections
            .get(&connection_id)
            .ok_or(ConnectionManagerError::ConnectionNotFound(connection_id))?;

        match connection {
            Connection::Quic(quic_conn) => {
                // Send a keep-alive by opening and immediately closing a unidirectional stream
                // This is a lightweight way to keep the connection alive
                let mut send_stream = quic_conn
                    .quinn_connection
                    .open_uni()
                    .await
                    .map_err(|e| ConnectionManagerError::SendError(e.to_string()))?;

                // Immediately finish the stream (empty keep-alive)
                send_stream
                    .finish()
                    .map_err(|e| ConnectionManagerError::SendError(e.to_string()))?;

                // Update activity timestamp
                drop(connections);
                self.update_activity(connection_id).await?;

                tracing::debug!("Sent keep-alive to connection: {}", connection_id);
                Ok(())
            }
            Connection::WebSocket(_) => {
                // WebSocket keep-alive is handled by the WebSocket protocol itself
                Ok(())
            }
        }
    }

    /// Check for timed-out connections and return their IDs
    ///
    /// # Requirements
    /// - 1.4: Handle connection timeout detection
    pub async fn check_timeouts(&self) -> Vec<ConnectionId> {
        self.get_inactive_connections(self.idle_timeout).await
    }

    /// Run the keep-alive loop for all connections
    /// This should be spawned as a background task
    ///
    /// # Requirements
    /// - 1.4: Implement keep-alive packet handling
    pub async fn run_keepalive_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(self.keep_alive_interval);
        
        loop {
            interval.tick().await;

            // Get connections that need keep-alive
            let conn_ids = self.get_connections_needing_keepalive().await;

            for conn_id in conn_ids {
                if let Err(e) = self.send_keepalive(conn_id).await {
                    tracing::warn!("Failed to send keep-alive to {}: {}", conn_id, e);
                }
            }
        }
    }

    /// Run the timeout check loop
    /// This should be spawned as a background task
    ///
    /// # Requirements
    /// - 1.4: Handle connection timeout detection
    pub async fn run_timeout_loop(self: Arc<Self>) -> Vec<ConnectionId> {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        let mut timed_out = Vec::new();
        
        loop {
            interval.tick().await;

            // Check for timed-out connections
            let timeout_ids = self.check_timeouts().await;

            if !timeout_ids.is_empty() {
                tracing::info!("Found {} timed-out connections", timeout_ids.len());
                
                for conn_id in &timeout_ids {
                    tracing::info!("Connection timed out: {}", conn_id);
                    
                    // Unregister the connection
                    if let Err(e) = self.unregister_connection(*conn_id).await {
                        tracing::error!("Failed to unregister timed-out connection {}: {}", conn_id, e);
                    }
                }

                timed_out.extend(timeout_ids);
            }
        }
    }

    /// Send a message via a specific connection
    ///
    /// # Requirements
    /// - 5.4: Unified send interface for both transports
    /// - 5.4: Handle send errors gracefully
    pub async fn send_message(
        &self,
        connection_id: ConnectionId,
        data: &[u8],
    ) -> Result<(), ConnectionManagerError> {
        let connections = self.connections.read().await;
        let connection = connections
            .get(&connection_id)
            .ok_or(ConnectionManagerError::ConnectionNotFound(connection_id))?;

        match connection {
            Connection::Quic(quic_conn) => {
                // Open a new unidirectional stream for sending
                let mut send_stream = quic_conn
                    .quinn_connection
                    .open_uni()
                    .await
                    .map_err(|e| ConnectionManagerError::SendError(e.to_string()))?;

                // Send the data
                send_stream
                    .write_all(data)
                    .await
                    .map_err(|e| ConnectionManagerError::SendError(e.to_string()))?;

                // Finish the stream
                send_stream
                    .finish()
                    .map_err(|e| ConnectionManagerError::SendError(e.to_string()))?;

                Ok(())
            }
            Connection::WebSocket(ws_conn) => {
                // Use the callback to send via WebSocket
                if let Some(callback) = &self.websocket_send_callback {
                    callback(ws_conn.user_id, data.to_vec())
                        .map_err(|e| ConnectionManagerError::SendError(e))?;
                    Ok(())
                } else {
                    // If no callback is set, return an error
                    Err(ConnectionManagerError::SendError(
                        "WebSocket send callback not configured".to_string(),
                    ))
                }
            }
        }
    }

    /// Broadcast a message to all connections of a user
    ///
    /// # Requirements
    /// - 5.4: Support both QUIC and WebSocket connections
    pub async fn broadcast_to_user(
        &self,
        user_id: Uuid,
        data: &[u8],
    ) -> Result<usize, ConnectionManagerError> {
        let connection_ids = self.get_user_connections(user_id).await;
        
        if connection_ids.is_empty() {
            return Err(ConnectionManagerError::UserNotFound(user_id));
        }

        let mut sent_count = 0;
        let mut errors = Vec::new();

        for connection_id in connection_ids {
            match self.send_message(connection_id, data).await {
                Ok(()) => sent_count += 1,
                Err(e) => {
                    tracing::warn!("Failed to send to connection {}: {}", connection_id, e);
                    errors.push(e);
                }
            }
        }

        // If we sent to at least one connection, consider it a success
        if sent_count > 0 {
            Ok(sent_count)
        } else {
            // If all sends failed, return the first error
            Err(errors.into_iter().next().unwrap_or(
                ConnectionManagerError::SendError("All sends failed".to_string())
            ))
        }
    }

    /// Send a message to all connections of a specific transport type
    ///
    /// # Requirements
    /// - 5.4: Support both QUIC and WebSocket connections
    pub async fn send_to_transport_type(
        &self,
        user_id: Uuid,
        transport_type: TransportType,
        data: &[u8],
    ) -> Result<usize, ConnectionManagerError> {
        let connection_ids = self.get_user_connections(user_id).await;
        
        if connection_ids.is_empty() {
            return Err(ConnectionManagerError::UserNotFound(user_id));
        }

        // Filter connection IDs by transport type
        let mut matching_ids = Vec::new();
        {
            let connections = self.connections.read().await;
            for connection_id in connection_ids {
                if let Some(connection) = connections.get(&connection_id) {
                    if connection.transport_type() == transport_type {
                        matching_ids.push(connection_id);
                    }
                }
            }
        }

        // Send to matching connections
        let mut sent_count = 0;
        for connection_id in matching_ids {
            if self.send_message(connection_id, data).await.is_ok() {
                sent_count += 1;
            }
        }

        if sent_count > 0 {
            Ok(sent_count)
        } else {
            Err(ConnectionManagerError::SendError(
                format!("No {} connections found for user", match transport_type {
                    TransportType::Quic => "QUIC",
                    TransportType::WebSocket => "WebSocket",
                })
            ))
        }
    }

    /// Get all connection IDs
    pub async fn get_all_connection_ids(&self) -> Vec<ConnectionId> {
        let connections = self.connections.read().await;
        connections.keys().copied().collect()
    }

    /// Get connection statistics
    pub async fn get_stats(&self) -> ConnectionStats {
        let connections = self.connections.read().await;
        let user_connections = self.user_connections.read().await;

        let total = connections.len();
        let quic = connections
            .values()
            .filter(|conn| matches!(conn, Connection::Quic(_)))
            .count();
        let websocket = connections
            .values()
            .filter(|conn| matches!(conn, Connection::WebSocket(_)))
            .count();
        let authenticated = connections
            .values()
            .filter(|conn| conn.user_id().is_some())
            .count();
        let unique_users = user_connections.len();

        ConnectionStats {
            total_connections: total,
            quic_connections: quic,
            websocket_connections: websocket,
            authenticated_connections: authenticated,
            unique_users,
        }
    }

    /// Get migration statistics
    ///
    /// # Requirements
    /// - 4.1: Track migration state
    /// - 4.4: Monitor migration failures
    pub async fn get_migration_stats(&self) -> MigrationStats {
        let connections = self.connections.read().await;

        let migrating_connections = connections
            .values()
            .filter(|conn| {
                if let Connection::Quic(quic_conn) = conn {
                    quic_conn.is_migrating()
                } else {
                    false
                }
            })
            .count();

        let failed_migrations = connections
            .values()
            .filter(|conn| {
                if let Connection::Quic(quic_conn) = conn {
                    quic_conn.has_migration_failed()
                } else {
                    false
                }
            })
            .count();

        let total_successful_migrations = connections
            .values()
            .filter_map(|conn| {
                if let Connection::Quic(quic_conn) = conn {
                    Some(quic_conn.migration_count())
                } else {
                    None
                }
            })
            .sum();

        MigrationStats {
            migrating_connections,
            failed_migrations,
            total_successful_migrations,
        }
    }

    /// Detect and handle connection migration for a QUIC connection
    ///
    /// # Requirements
    /// - 4.1: Detect the change and initiate connection migration
    /// - 4.2: Maintain session state and message ordering
    ///
    /// # Arguments
    /// * `connection_id` - The connection ID to check for migration
    ///
    /// # Returns
    /// * `Ok(true)` - Migration detected and initiated
    /// * `Ok(false)` - No migration detected
    /// * `Err` - Error checking migration status
    pub async fn detect_migration(&self, connection_id: ConnectionId) -> Result<bool, ConnectionManagerError> {
        let mut connections = self.connections.write().await;
        let connection = connections
            .get_mut(&connection_id)
            .ok_or(ConnectionManagerError::ConnectionNotFound(connection_id))?;

        match connection {
            Connection::Quic(quic_conn) => {
                // Check if the remote address has changed
                // Quinn handles migration automatically, but we track it for monitoring
                let remote_addr = quic_conn.quinn_connection.remote_address();
                
                // If the connection is stable and we detect activity, check for path changes
                if quic_conn.migration_state == MigrationState::Stable {
                    // Quinn will handle the migration internally
                    // We just need to track that it's happening
                    // In a real implementation, we would compare the current remote address
                    // with a stored previous address to detect changes
                    
                    tracing::debug!(
                        "Checking migration for connection {} (remote: {})",
                        connection_id,
                        remote_addr
                    );
                    
                    // For now, we return false as Quinn handles migration transparently
                    // In a production system, you would implement actual path change detection
                    Ok(false)
                } else {
                    Ok(false)
                }
            }
            Connection::WebSocket(_) => {
                // WebSocket connections don't support migration
                Ok(false)
            }
        }
    }

    /// Start migration for a QUIC connection
    ///
    /// # Requirements
    /// - 4.1: Initiate connection migration
    /// - 4.2: Maintain session state and message ordering
    ///
    /// # Arguments
    /// * `connection_id` - The connection ID to migrate
    pub async fn start_migration(&self, connection_id: ConnectionId) -> Result<(), ConnectionManagerError> {
        let mut connections = self.connections.write().await;
        let connection = connections
            .get_mut(&connection_id)
            .ok_or(ConnectionManagerError::ConnectionNotFound(connection_id))?;

        match connection {
            Connection::Quic(quic_conn) => {
                quic_conn.start_migration();
                Ok(())
            }
            Connection::WebSocket(_) => {
                Err(ConnectionManagerError::InvalidConnectionType)
            }
        }
    }

    /// Complete migration for a QUIC connection
    ///
    /// # Requirements
    /// - 4.2: Maintain session state and message ordering
    /// - 4.3: Resume message transmission without data loss
    ///
    /// # Arguments
    /// * `connection_id` - The connection ID that completed migration
    pub async fn complete_migration(&self, connection_id: ConnectionId) -> Result<(), ConnectionManagerError> {
        let mut connections = self.connections.write().await;
        let connection = connections
            .get_mut(&connection_id)
            .ok_or(ConnectionManagerError::ConnectionNotFound(connection_id))?;

        match connection {
            Connection::Quic(quic_conn) => {
                quic_conn.complete_migration();
                Ok(())
            }
            Connection::WebSocket(_) => {
                Err(ConnectionManagerError::InvalidConnectionType)
            }
        }
    }

    /// Mark migration as failed for a QUIC connection
    ///
    /// # Requirements
    /// - 4.4: Notify the application layer to handle reconnection
    ///
    /// # Arguments
    /// * `connection_id` - The connection ID that failed migration
    pub async fn fail_migration(&self, connection_id: ConnectionId) -> Result<(), ConnectionManagerError> {
        let mut connections = self.connections.write().await;
        let connection = connections
            .get_mut(&connection_id)
            .ok_or(ConnectionManagerError::ConnectionNotFound(connection_id))?;

        match connection {
            Connection::Quic(quic_conn) => {
                quic_conn.fail_migration();
                Ok(())
            }
            Connection::WebSocket(_) => {
                Err(ConnectionManagerError::InvalidConnectionType)
            }
        }
    }

    /// Get connections that are currently migrating
    ///
    /// # Requirements
    /// - 4.1: Track migration state
    pub async fn get_migrating_connections(&self) -> Vec<ConnectionId> {
        let connections = self.connections.read().await;
        connections
            .iter()
            .filter(|(_, conn)| {
                if let Connection::Quic(quic_conn) = conn {
                    quic_conn.is_migrating()
                } else {
                    false
                }
            })
            .map(|(id, _)| *id)
            .collect()
    }

    /// Get connections that have failed migration
    ///
    /// # Requirements
    /// - 4.4: Identify failed migrations for reconnection handling
    pub async fn get_failed_migrations(&self) -> Vec<ConnectionId> {
        let connections = self.connections.read().await;
        connections
            .iter()
            .filter(|(_, conn)| {
                if let Connection::Quic(quic_conn) = conn {
                    quic_conn.has_migration_failed()
                } else {
                    false
                }
            })
            .map(|(id, _)| *id)
            .collect()
    }

    /// Monitor connection migrations and handle timeouts
    /// This should be spawned as a background task
    ///
    /// # Requirements
    /// - 4.1: Detect network path changes
    /// - 4.4: Detect migration timeout and notify application layer
    ///
    /// # Arguments
    /// * `migration_timeout` - Maximum time allowed for migration
    pub async fn run_migration_monitor(self: Arc<Self>, migration_timeout: Duration) {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        
        tracing::info!(
            "Starting migration monitor (timeout: {}s)",
            migration_timeout.as_secs()
        );
        
        loop {
            interval.tick().await;

            // Check for connections that are migrating
            let migrating = self.get_migrating_connections().await;

            for conn_id in migrating {
                // Check if migration has timed out
                let connections = self.connections.read().await;
                if let Some(Connection::Quic(quic_conn)) = connections.get(&conn_id) {
                    if quic_conn.is_migrating() && quic_conn.has_migration_timed_out(migration_timeout) {
                        drop(connections);
                        
                        tracing::warn!(
                            "Connection {} migration timeout ({}s)",
                            conn_id,
                            migration_timeout.as_secs()
                        );
                        
                        // Mark migration as failed
                        if let Err(e) = self.fail_migration(conn_id).await {
                            tracing::error!(
                                "Failed to mark migration as failed for {}: {}",
                                conn_id,
                                e
                            );
                        }
                    }
                }
            }

            // Check for failed migrations and clean them up
            let failed = self.get_failed_migrations().await;
            if !failed.is_empty() {
                tracing::info!(
                    "Found {} connections with failed migrations, cleaning up",
                    failed.len()
                );
            }
            
            for conn_id in failed {
                tracing::info!(
                    "Cleaning up connection {} with failed migration",
                    conn_id
                );
                
                // Unregister the connection
                // This notifies the application layer by removing the connection
                if let Err(e) = self.unregister_connection(conn_id).await {
                    tracing::error!(
                        "Failed to unregister connection {} with failed migration: {}",
                        conn_id,
                        e
                    );
                }
            }
        }
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Connection statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConnectionStats {
    /// Total number of connections
    pub total_connections: usize,
    /// Number of QUIC connections
    pub quic_connections: usize,
    /// Number of WebSocket connections
    pub websocket_connections: usize,
    /// Number of authenticated connections
    pub authenticated_connections: usize,
    /// Number of unique users
    pub unique_users: usize,
}

/// Migration statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MigrationStats {
    /// Number of connections currently migrating
    pub migrating_connections: usize,
    /// Number of connections with failed migrations
    pub failed_migrations: usize,
    /// Total number of successful migrations across all connections
    pub total_successful_migrations: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_id_new() {
        let id1 = ConnectionId::new();
        let id2 = ConnectionId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_connection_id_display() {
        let id = ConnectionId::new();
        let display = format!("{}", id);
        assert!(!display.is_empty());
    }

    #[tokio::test]
    async fn test_connection_manager_new() {
        let manager = ConnectionManager::new();
        assert_eq!(manager.connection_count().await, 0);
    }

    #[tokio::test]
    async fn test_websocket_connection() {
        let conn_id = ConnectionId::new();
        let user_id = Uuid::new_v4();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);

        assert_eq!(ws_conn.connection_id, conn_id);
        assert_eq!(ws_conn.user_id, user_id);
    }

    #[tokio::test]
    async fn test_connection_manager_stats() {
        let manager = ConnectionManager::new();
        let stats = manager.get_stats().await;

        assert_eq!(stats.total_connections, 0);
        assert_eq!(stats.quic_connections, 0);
        assert_eq!(stats.websocket_connections, 0);
        assert_eq!(stats.authenticated_connections, 0);
        assert_eq!(stats.unique_users, 0);
    }

    #[tokio::test]
    async fn test_register_websocket_connection() {
        let manager = ConnectionManager::new();
        let conn_id = ConnectionId::new();
        let user_id = Uuid::new_v4();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);
        let connection = Connection::WebSocket(ws_conn);

        let result = manager.register_connection(connection).await;
        assert!(result.is_ok());
        assert_eq!(manager.connection_count().await, 1);
        assert_eq!(manager.websocket_connection_count().await, 1);
        assert!(manager.is_user_connected(user_id).await);
    }

    #[tokio::test]
    async fn test_unregister_connection() {
        let manager = ConnectionManager::new();
        let conn_id = ConnectionId::new();
        let user_id = Uuid::new_v4();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);
        let connection = Connection::WebSocket(ws_conn);

        manager.register_connection(connection).await.unwrap();
        assert_eq!(manager.connection_count().await, 1);

        let result = manager.unregister_connection(conn_id).await;
        assert!(result.is_ok());
        assert_eq!(manager.connection_count().await, 0);
        assert!(!manager.is_user_connected(user_id).await);
    }

    #[tokio::test]
    async fn test_get_user_connections() {
        let manager = ConnectionManager::new();
        let user_id = Uuid::new_v4();

        // Register two connections for the same user
        let conn_id1 = ConnectionId::new();
        let ws_conn1 = WebSocketConnection::new(conn_id1, user_id);
        manager
            .register_connection(Connection::WebSocket(ws_conn1))
            .await
            .unwrap();

        let conn_id2 = ConnectionId::new();
        let ws_conn2 = WebSocketConnection::new(conn_id2, user_id);
        manager
            .register_connection(Connection::WebSocket(ws_conn2))
            .await
            .unwrap();

        let user_conns = manager.get_user_connections(user_id).await;
        assert_eq!(user_conns.len(), 2);
        assert!(user_conns.contains(&conn_id1));
        assert!(user_conns.contains(&conn_id2));
    }

    #[tokio::test]
    async fn test_update_activity() {
        let manager = ConnectionManager::new();
        let conn_id = ConnectionId::new();
        let user_id = Uuid::new_v4();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);
        let connection = Connection::WebSocket(ws_conn);

        manager.register_connection(connection).await.unwrap();

        // Wait a bit
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        // Update activity
        let result = manager.update_activity(conn_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_inactive_connections() {
        let manager = ConnectionManager::new();
        let conn_id = ConnectionId::new();
        let user_id = Uuid::new_v4();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);
        let connection = Connection::WebSocket(ws_conn);

        manager.register_connection(connection).await.unwrap();

        // Check for inactive connections with a very short timeout
        let _inactive = manager
            .get_inactive_connections(std::time::Duration::from_millis(1))
            .await;

        // Wait a bit to ensure the connection becomes inactive
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let inactive = manager
            .get_inactive_connections(std::time::Duration::from_millis(1))
            .await;
        assert_eq!(inactive.len(), 1);
        assert_eq!(inactive[0], conn_id);
    }

    #[tokio::test]
    async fn test_connection_manager_with_timeouts() {
        let keep_alive = Duration::from_secs(10);
        let idle_timeout = Duration::from_secs(30);
        let manager = ConnectionManager::with_timeouts(keep_alive, idle_timeout);

        assert_eq!(manager.keep_alive_interval(), keep_alive);
        assert_eq!(manager.idle_timeout(), idle_timeout);
    }

    #[tokio::test]
    async fn test_check_timeouts() {
        let manager = ConnectionManager::with_timeouts(
            Duration::from_millis(100),
            Duration::from_millis(50),
        );

        let conn_id = ConnectionId::new();
        let user_id = Uuid::new_v4();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);
        let connection = Connection::WebSocket(ws_conn);

        manager.register_connection(connection).await.unwrap();

        // Wait for timeout
        tokio::time::sleep(Duration::from_millis(60)).await;

        let timed_out = manager.check_timeouts().await;
        assert_eq!(timed_out.len(), 1);
        assert_eq!(timed_out[0], conn_id);
    }

    #[tokio::test]
    async fn test_get_connections_needing_keepalive() {
        let manager = ConnectionManager::with_timeouts(
            Duration::from_millis(50),
            Duration::from_secs(30),
        );

        let conn_id = ConnectionId::new();
        let user_id = Uuid::new_v4();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);
        let connection = Connection::WebSocket(ws_conn);

        manager.register_connection(connection).await.unwrap();

        // WebSocket connections don't need keep-alive
        let needing_keepalive = manager.get_connections_needing_keepalive().await;
        assert_eq!(needing_keepalive.len(), 0);
    }

    #[tokio::test]
    async fn test_websocket_callback() {
        let mut manager = ConnectionManager::new();
        
        // Set up a callback that tracks calls
        let callback = Arc::new(|user_id: Uuid, data: Vec<u8>| -> Result<(), String> {
            assert!(!data.is_empty());
            assert_ne!(user_id, Uuid::nil());
            Ok(())
        });

        manager.set_websocket_callback(callback);

        let conn_id = ConnectionId::new();
        let user_id = Uuid::new_v4();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);
        let connection = Connection::WebSocket(ws_conn);

        manager.register_connection(connection).await.unwrap();

        // Try to send a message
        let result = manager.send_message(conn_id, b"test message").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_broadcast_to_user_multiple_connections() {
        let mut manager = ConnectionManager::new();
        
        // Set up a callback
        let callback = Arc::new(|_user_id: Uuid, _data: Vec<u8>| -> Result<(), String> {
            Ok(())
        });
        manager.set_websocket_callback(callback);

        let user_id = Uuid::new_v4();

        // Register two WebSocket connections for the same user
        let conn_id1 = ConnectionId::new();
        let ws_conn1 = WebSocketConnection::new(conn_id1, user_id);
        manager
            .register_connection(Connection::WebSocket(ws_conn1))
            .await
            .unwrap();

        let conn_id2 = ConnectionId::new();
        let ws_conn2 = WebSocketConnection::new(conn_id2, user_id);
        manager
            .register_connection(Connection::WebSocket(ws_conn2))
            .await
            .unwrap();

        // Broadcast to user
        let result = manager.broadcast_to_user(user_id, b"broadcast").await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 2);
    }

    #[tokio::test]
    async fn test_send_to_transport_type() {
        let mut manager = ConnectionManager::new();
        
        // Set up a callback
        let callback = Arc::new(|_user_id: Uuid, _data: Vec<u8>| -> Result<(), String> {
            Ok(())
        });
        manager.set_websocket_callback(callback);

        let user_id = Uuid::new_v4();

        // Register a WebSocket connection
        let conn_id = ConnectionId::new();
        let ws_conn = WebSocketConnection::new(conn_id, user_id);
        manager
            .register_connection(Connection::WebSocket(ws_conn))
            .await
            .unwrap();

        // Send to WebSocket transport type
        let result = manager
            .send_to_transport_type(user_id, TransportType::WebSocket, b"test")
            .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);

        // Try to send to QUIC transport type (should fail)
        let result = manager
            .send_to_transport_type(user_id, TransportType::Quic, b"test")
            .await;
        assert!(result.is_err());
    }
}
