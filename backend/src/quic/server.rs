use crate::quic::auth::QuicAuthenticator;
use crate::quic::config::QuicServerConfig;
use crate::quic::connection_manager::{ConnectionId, ConnectionManager, QuicConnection, Connection as ManagedConnection};
use crate::quic::stream_allocator::{MessageType, StreamAllocator};
use quinn::{Connection, Endpoint, RecvStream, SendStream, ServerConfig};
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use std::fs;
use std::io;
use std::net::SocketAddr;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use uuid::Uuid;

/// QUIC server errors
#[derive(Debug, Error)]
pub enum QuicServerError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),

    #[error("TLS error: {0}")]
    Tls(String),

    #[error("Quinn connection error: {0}")]
    Connection(#[from] quinn::ConnectionError),

    #[error("Quinn endpoint error: {0}")]
    Endpoint(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Server not initialized")]
    NotInitialized,

    #[error("Server already running")]
    AlreadyRunning,
}

/// QUIC server state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerState {
    /// Server is not initialized
    NotInitialized,
    /// Server is initialized but not running
    Initialized,
    /// Server is running and accepting connections
    Running,
    /// Server is shutting down
    ShuttingDown,
    /// Server has stopped
    Stopped,
}

/// QUIC server implementation using Quinn
pub struct QuicServer {
    /// Server configuration
    config: QuicServerConfig,
    /// Quinn endpoint (None until initialized)
    endpoint: Option<Endpoint>,
    /// Server state
    state: Arc<RwLock<ServerState>>,
    /// Bound socket address (None until bound)
    bound_addr: Option<SocketAddr>,
    /// Authenticator for JWT validation
    authenticator: Option<QuicAuthenticator>,
    /// Connection manager
    connection_manager: Option<Arc<ConnectionManager>>,
    /// Stream allocator
    stream_allocator: Option<Arc<StreamAllocator>>,
}

impl QuicServer {
    /// Create a new QUIC server with the given configuration
    pub fn new(config: QuicServerConfig) -> Self {
        Self {
            config,
            endpoint: None,
            state: Arc::new(RwLock::new(ServerState::NotInitialized)),
            bound_addr: None,
            authenticator: None,
            connection_manager: None,
            stream_allocator: None,
        }
    }

    /// Get a reference to the current configuration
    ///
    /// # Requirements
    /// - 9.4: Support dynamic configuration updates
    pub fn config(&self) -> &QuicServerConfig {
        &self.config
    }

    /// Update the server configuration
    ///
    /// # Requirements
    /// - 9.4: Apply configuration changes to new connections
    /// - 9.4: Validate configuration before applying
    /// - 9.4: Log configuration changes
    ///
    /// # Arguments
    /// * `new_config` - The new configuration to apply
    ///
    /// # Returns
    /// * `Ok(())` - Configuration updated successfully
    /// * `Err(QuicServerError)` - Configuration validation failed
    ///
    /// # Notes
    /// - Configuration changes only apply to new connections
    /// - Existing connections continue with their original configuration
    /// - The server must be reinitialized for some changes (port, TLS certs) to take effect
    pub async fn update_config(&mut self, new_config: QuicServerConfig) -> Result<(), QuicServerError> {
        // Validate the new configuration
        new_config
            .validate()
            .map_err(|e| QuicServerError::Config(format!("Invalid configuration: {}", e)))?;

        // Log the configuration change
        info!("Updating QUIC server configuration");
        info!("  Old config: enabled={}, port={}, max_connections={}, max_streams={}", 
            self.config.enabled, 
            self.config.port, 
            self.config.max_connections,
            self.config.max_streams_per_connection
        );
        info!("  New config: enabled={}, port={}, max_connections={}, max_streams={}", 
            new_config.enabled, 
            new_config.port, 
            new_config.max_connections,
            new_config.max_streams_per_connection
        );

        // Check if critical settings changed that require reinitialization
        let requires_reinit = self.config.port != new_config.port
            || self.config.bind_address != new_config.bind_address
            || self.config.cert_path != new_config.cert_path
            || self.config.key_path != new_config.key_path;

        if requires_reinit {
            let state = *self.state.read().await;
            if state == ServerState::Running || state == ServerState::Initialized {
                warn!("Configuration change requires server reinitialization (port, address, or TLS settings changed)");
                warn!("The server must be stopped and reinitialized for these changes to take effect");
            }
        }

        // Apply the new configuration
        self.config = new_config;

        info!("QUIC server configuration updated successfully");

        Ok(())
    }

    /// Reload configuration from environment variables
    ///
    /// # Requirements
    /// - 9.4: Support dynamic configuration updates
    /// - 9.4: Validate configuration before applying
    /// - 9.4: Log configuration changes
    ///
    /// # Returns
    /// * `Ok(())` - Configuration reloaded successfully
    /// * `Err(QuicServerError)` - Configuration loading or validation failed
    pub async fn reload_config_from_env(&mut self) -> Result<(), QuicServerError> {
        info!("Reloading QUIC server configuration from environment");

        // Load new configuration from environment
        let new_config = QuicServerConfig::from_env()
            .map_err(|e| QuicServerError::Config(format!("Failed to load configuration: {}", e)))?;

        // Update the configuration (this will validate and log)
        self.update_config(new_config).await?;

        Ok(())
    }

    /// Set the JWT secret for authentication
    ///
    /// # Requirements
    /// - 1.3: Authenticate QUIC connections on establishment
    /// - 7.3: Support the same authentication tokens as WebSocket connections
    pub fn set_jwt_secret(&mut self, jwt_secret: String) {
        self.authenticator = Some(QuicAuthenticator::new(jwt_secret));
    }

    /// Set the connection manager
    ///
    /// # Requirements
    /// - 1.3: Store authenticated user ID in connection state
    pub fn set_connection_manager(&mut self, connection_manager: Arc<ConnectionManager>) {
        self.connection_manager = Some(connection_manager);
    }

    /// Set the stream allocator
    ///
    /// # Requirements
    /// - 3.1: Track active streams per connection
    pub fn set_stream_allocator(&mut self, stream_allocator: Arc<StreamAllocator>) {
        self.stream_allocator = Some(stream_allocator);
    }

    /// Initialize the server with TLS configuration and bind to UDP port
    pub async fn initialize(&mut self) -> Result<(), QuicServerError> {
        let state = *self.state.read().await;
        if state != ServerState::NotInitialized {
            return Err(QuicServerError::AlreadyRunning);
        }

        info!("Initializing QUIC server...");

        // Note: CryptoProvider must be installed in main.rs before this point
        // See main.rs for rustls::crypto::ring::default_provider().install_default()

        // Validate configuration
        self.config
            .validate()
            .map_err(|e| QuicServerError::Config(e.to_string()))?;

        // Load TLS certificate and key
        let (certs, key) = self.load_tls_config()?;

        // Create rustls server configuration
        let mut server_crypto = rustls::ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(certs, key)
            .map_err(|e| QuicServerError::Tls(e.to_string()))?;

        // Configure ALPN protocols
        server_crypto.alpn_protocols = vec![b"h3".to_vec()];

        // Create Quinn server configuration
        let mut server_config = ServerConfig::with_crypto(Arc::new(
            quinn::crypto::rustls::QuicServerConfig::try_from(server_crypto)
                .map_err(|e| QuicServerError::Tls(e.to_string()))?,
        ));

        // Configure transport parameters
        let mut transport_config = quinn::TransportConfig::default();
        transport_config.max_concurrent_bidi_streams(
            self.config.max_streams_per_connection.try_into().unwrap(),
        );
        transport_config.max_concurrent_uni_streams(
            self.config.max_streams_per_connection.try_into().unwrap(),
        );
        transport_config.max_idle_timeout(Some(
            self.config
                .idle_timeout()
                .try_into()
                .map_err(|e| QuicServerError::Config(format!("Invalid idle timeout: {}", e)))?,
        ));
        transport_config.keep_alive_interval(Some(self.config.keep_alive_interval()));

        server_config.transport_config(Arc::new(transport_config));

        // Get bind address
        let bind_addr = self
            .config
            .socket_addr()
            .map_err(|e| QuicServerError::Config(e.to_string()))?;

        // Create endpoint and bind to UDP port
        let endpoint = Endpoint::server(server_config, bind_addr)
            .map_err(|e| QuicServerError::Endpoint(e.to_string()))?;

        self.bound_addr = Some(endpoint.local_addr().map_err(|e| {
            QuicServerError::Endpoint(format!("Failed to get local address: {}", e))
        })?);

        info!(
            "QUIC server bound to {}",
            self.bound_addr.as_ref().unwrap()
        );

        self.endpoint = Some(endpoint);
        *self.state.write().await = ServerState::Initialized;

        Ok(())
    }

    /// Load TLS certificate and private key from files
    fn load_tls_config(
        &self,
    ) -> Result<(Vec<CertificateDer<'static>>, PrivateKeyDer<'static>), QuicServerError> {
        // Load certificate
        let cert_data = fs::read(&self.config.cert_path).map_err(|e| {
            QuicServerError::Io(io::Error::new(
                e.kind(),
                format!("Failed to read certificate file: {}", e),
            ))
        })?;

        let certs = rustls_pemfile::certs(&mut cert_data.as_slice())
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| QuicServerError::Tls(format!("Failed to parse certificate: {}", e)))?;

        if certs.is_empty() {
            return Err(QuicServerError::Tls(
                "No certificates found in certificate file".to_string(),
            ));
        }

        // Load private key
        let key_data = fs::read(&self.config.key_path).map_err(|e| {
            QuicServerError::Io(io::Error::new(
                e.kind(),
                format!("Failed to read private key file: {}", e),
            ))
        })?;

        let key = rustls_pemfile::private_key(&mut key_data.as_slice())
            .map_err(|e| QuicServerError::Tls(format!("Failed to parse private key: {}", e)))?
            .ok_or_else(|| QuicServerError::Tls("No private key found in key file".to_string()))?;

        Ok((certs, key))
    }

    /// Get the bound socket address
    pub fn local_addr(&self) -> Option<SocketAddr> {
        self.bound_addr
    }

    /// Get the current server state
    pub async fn state(&self) -> ServerState {
        *self.state.read().await
    }

    /// Check if the server is running
    pub async fn is_running(&self) -> bool {
        *self.state.read().await == ServerState::Running
    }

    /// Get a reference to the endpoint
    pub fn endpoint(&self) -> Option<&Endpoint> {
        self.endpoint.as_ref()
    }

    /// Check if QUIC is enabled in configuration
    ///
    /// # Requirements
    /// - 9.3: Read QUIC_ENABLED from configuration
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// Start the server and begin accepting connections
    ///
    /// # Requirements
    /// - 9.3: Conditionally start QUIC server based on configuration
    pub async fn start(&mut self) -> Result<(), QuicServerError> {
        // Check if QUIC is enabled
        if !self.config.enabled {
            return Err(QuicServerError::Config(
                "QUIC is disabled in configuration".to_string()
            ));
        }

        let state = *self.state.read().await;
        if state != ServerState::Initialized {
            return Err(QuicServerError::Config(format!(
                "Server must be initialized before starting (current state: {:?})",
                state
            )));
        }

        *self.state.write().await = ServerState::Running;
        info!("QUIC server started and accepting connections");

        Ok(())
    }

    /// Stop the server gracefully
    pub async fn stop(&mut self) -> Result<(), QuicServerError> {
        let state = *self.state.read().await;
        if state != ServerState::Running {
            warn!("Attempted to stop server that is not running");
            return Ok(());
        }

        *self.state.write().await = ServerState::ShuttingDown;
        info!("QUIC server shutting down...");

        // Close the endpoint if it exists
        if let Some(endpoint) = self.endpoint.take() {
            endpoint.close(0u32.into(), b"Server shutdown");
            endpoint.wait_idle().await;
        }

        *self.state.write().await = ServerState::Stopped;
        info!("QUIC server stopped");

        Ok(())
    }

    /// Accept incoming connections (blocking until a connection arrives)
    ///
    /// # Requirements
    /// - 9.3: Reject QUIC connections when disabled
    pub async fn accept(&self) -> Result<Connection, QuicServerError> {
        // Check if QUIC is enabled
        if !self.config.enabled {
            return Err(QuicServerError::Config(
                "QUIC is disabled in configuration".to_string()
            ));
        }

        let state = *self.state.read().await;
        if state != ServerState::Running {
            return Err(QuicServerError::Config(format!(
                "Server is not running (current state: {:?})",
                state
            )));
        }

        let endpoint = self
            .endpoint
            .as_ref()
            .ok_or(QuicServerError::NotInitialized)?;

        let incoming = endpoint
            .accept()
            .await
            .ok_or_else(|| QuicServerError::Endpoint("No more incoming connections".to_string()))?;

        let connection = incoming.await?;

        info!(
            "Accepted QUIC connection from {}",
            connection.remote_address()
        );

        Ok(connection)
    }

    /// Run the connection acceptance loop
    /// This method will continuously accept connections and spawn tasks to handle them
    /// until the server is stopped or an error occurs
    ///
    /// # Requirements
    /// - 9.3: Reject QUIC connections when disabled
    pub async fn run<F, Fut>(&self, handler: F) -> Result<(), QuicServerError>
    where
        F: Fn(Connection) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<(), QuicServerError>> + Send + 'static,
    {
        // Check if QUIC is enabled
        if !self.config.enabled {
            return Err(QuicServerError::Config(
                "QUIC is disabled in configuration".to_string()
            ));
        }

        let state = *self.state.read().await;
        if state != ServerState::Running {
            return Err(QuicServerError::Config(format!(
                "Server is not running (current state: {:?})",
                state
            )));
        }

        info!("Starting connection acceptance loop");

        let endpoint = self
            .endpoint
            .as_ref()
            .ok_or(QuicServerError::NotInitialized)?;

        let handler = Arc::new(handler);

        loop {
            // Check if server is still running
            let state = *self.state.read().await;
            if state != ServerState::Running {
                info!("Connection acceptance loop stopping (state: {:?})", state);
                break;
            }

            // Accept incoming connection
            match endpoint.accept().await {
                Some(incoming) => {
                    let handler = Arc::clone(&handler);
                    
                    // Spawn a task to handle the connection
                    tokio::spawn(async move {
                        match incoming.await {
                            Ok(connection) => {
                                let remote_addr = connection.remote_address();
                                info!("Accepted QUIC connection from {}", remote_addr);

                                // Handle the connection
                                if let Err(e) = handler(connection).await {
                                    error!(
                                        "Error handling connection from {}: {}",
                                        remote_addr, e
                                    );
                                }
                            }
                            Err(e) => {
                                error!("Failed to establish connection: {}", e);
                            }
                        }
                    });
                }
                None => {
                    // Endpoint is closing
                    info!("Endpoint closed, stopping acceptance loop");
                    break;
                }
            }
        }

        info!("Connection acceptance loop stopped");
        Ok(())
    }

    /// Handle a single connection (placeholder for now)
    /// This will be expanded in later tasks to handle streams and messages
    pub async fn handle_connection(&self, connection: Connection) -> Result<(), QuicServerError> {
        let remote_addr = connection.remote_address();
        info!("Handling connection from {}", remote_addr);

        // Wait for the connection to close
        let closed = connection.closed().await;
        info!(
            "Connection from {} closed: {}",
            remote_addr,
            closed
        );

        Ok(())
    }

    /// Authenticate a QUIC connection and register it with the connection manager
    ///
    /// # Requirements
    /// - 1.3: Authenticate QUIC connections on establishment
    /// - 1.3: Store authenticated user ID in connection state
    /// - 7.3: Reuse JWT validation from WebSocket handler
    ///
    /// # Example
    /// ```no_run
    /// use std::sync::Arc;
    /// use chat_backend::quic::{QuicServer, QuicServerConfig, ConnectionManager};
    ///
    /// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
    /// let config = QuicServerConfig::default();
    /// let mut server = QuicServer::new(config);
    /// 
    /// // Set JWT secret (same as WebSocket)
    /// server.set_jwt_secret("your_jwt_secret".to_string());
    /// 
    /// // Set connection manager
    /// let connection_manager = Arc::new(ConnectionManager::new());
    /// server.set_connection_manager(connection_manager);
    /// 
    /// // Initialize and start server
    /// server.initialize().await?;
    /// server.start().await?;
    /// 
    /// // Accept and authenticate connections
    /// let connection = server.accept().await?;
    /// let (conn_id, user_id, user_name) = server.authenticate_and_register_connection(connection).await?;
    /// println!("Authenticated user: {} ({})", user_name, user_id);
    /// # Ok(())
    /// # }
    /// ```
    ///
    /// # Arguments
    /// * `connection` - The Quinn connection to authenticate
    ///
    /// # Returns
    /// * `Ok((connection_id, user_id, user_name))` - Authentication successful
    /// * `Err(QuicServerError)` - Authentication failed
    pub async fn authenticate_and_register_connection(
        &self,
        connection: Connection,
    ) -> Result<(ConnectionId, Uuid, String), QuicServerError> {
        let remote_addr = connection.remote_address();
        
        // Check if authenticator is configured
        let authenticator = self.authenticator.as_ref().ok_or_else(|| {
            QuicServerError::Config("Authenticator not configured".to_string())
        })?;

        // Check if connection manager is configured
        let connection_manager = self.connection_manager.as_ref().ok_or_else(|| {
            QuicServerError::Config("Connection manager not configured".to_string())
        })?;

        info!("Authenticating QUIC connection from {}", remote_addr);

        // Accept the first bidirectional stream for authentication
        let (send_stream, recv_stream) = match connection.accept_bi().await {
            Ok(streams) => streams,
            Err(e) => {
                error!("Failed to accept authentication stream from {}: {}", remote_addr, e);
                return Err(QuicServerError::Connection(e));
            }
        };

        // Authenticate the connection
        let (user_id, user_name) = match authenticator.authenticate_connection(recv_stream, send_stream).await {
            Ok((user_id, user_name)) => {
                info!(
                    "QUIC authentication successful from {}: user_id={}, user_name={}",
                    remote_addr, user_id, user_name
                );
                (user_id, user_name)
            }
            Err(e) => {
                error!("QUIC authentication failed from {}: {}", remote_addr, e);
                // Close the connection
                connection.close(0u32.into(), b"Authentication failed");
                return Err(QuicServerError::Config(format!("Authentication failed: {}", e)));
            }
        };

        // Create a QuicConnection and register it
        let connection_id = ConnectionId::new();
        let mut quic_connection = QuicConnection::new(connection_id, connection);
        
        // Set the authenticated user ID
        quic_connection.set_user_id(user_id);

        // Register the connection with the connection manager
        let managed_connection = ManagedConnection::Quic(quic_connection);
        connection_manager
            .register_connection(managed_connection)
            .await
            .map_err(|e| QuicServerError::Config(format!("Failed to register connection: {}", e)))?;

        info!(
            "QUIC connection registered: connection_id={}, user_id={}, user_name={}",
            connection_id, user_id, user_name
        );

        Ok((connection_id, user_id, user_name))
    }

    /// Accept an incoming bidirectional stream from a client
    ///
    /// # Requirements
    /// - 3.1: Accept incoming streams from clients
    /// - 3.3: Handle stream lifecycle (open)
    ///
    /// # Arguments
    /// * `connection` - The QUIC connection to accept a stream from
    ///
    /// # Returns
    /// * `Ok((send_stream, recv_stream))` - The bidirectional stream
    /// * `Err(QuicServerError)` - If accepting the stream fails
    pub async fn accept_bidirectional_stream(
        &self,
        connection: &Connection,
    ) -> Result<(SendStream, RecvStream), QuicServerError> {
        let (send_stream, recv_stream) = connection
            .accept_bi()
            .await
            .map_err(|e| QuicServerError::Connection(e))?;

        info!(
            "Accepted bidirectional stream from {}",
            connection.remote_address()
        );

        Ok((send_stream, recv_stream))
    }

    /// Open an outgoing bidirectional stream to a client
    ///
    /// # Requirements
    /// - 3.1: Create outgoing streams for server messages
    /// - 3.3: Handle stream lifecycle (open)
    ///
    /// # Arguments
    /// * `connection` - The QUIC connection to open a stream on
    ///
    /// # Returns
    /// * `Ok((send_stream, recv_stream))` - The bidirectional stream
    /// * `Err(QuicServerError)` - If opening the stream fails
    pub async fn open_bidirectional_stream(
        &self,
        connection: &Connection,
    ) -> Result<(SendStream, RecvStream), QuicServerError> {
        let (send_stream, recv_stream) = connection
            .open_bi()
            .await
            .map_err(|e| QuicServerError::Connection(e))?;

        info!(
            "Opened bidirectional stream to {}",
            connection.remote_address()
        );

        Ok((send_stream, recv_stream))
    }

    /// Open an outgoing unidirectional stream to a client
    ///
    /// # Requirements
    /// - 3.1: Create outgoing streams for server messages
    /// - 3.3: Handle stream lifecycle (open)
    ///
    /// # Arguments
    /// * `connection` - The QUIC connection to open a stream on
    ///
    /// # Returns
    /// * `Ok(send_stream)` - The unidirectional send stream
    /// * `Err(QuicServerError)` - If opening the stream fails
    pub async fn open_unidirectional_stream(
        &self,
        connection: &Connection,
    ) -> Result<SendStream, QuicServerError> {
        let send_stream = connection
            .open_uni()
            .await
            .map_err(|e| QuicServerError::Connection(e))?;

        info!(
            "Opened unidirectional stream to {}",
            connection.remote_address()
        );

        Ok(send_stream)
    }

    /// Close a stream gracefully
    ///
    /// # Requirements
    /// - 3.3: Handle stream lifecycle (close)
    ///
    /// # Arguments
    /// * `send_stream` - The send stream to close
    pub async fn close_stream(&self, mut send_stream: SendStream) -> Result<(), QuicServerError> {
        send_stream
            .finish()
            .map_err(|e| QuicServerError::Endpoint(format!("Failed to close stream: {}", e)))?;

        info!("Closed stream");

        Ok(())
    }

    /// Send data on a stream
    ///
    /// # Requirements
    /// - 3.1: Create outgoing streams for server messages
    ///
    /// # Arguments
    /// * `send_stream` - The send stream to write to
    /// * `data` - The data to send
    pub async fn send_on_stream(
        &self,
        send_stream: &mut SendStream,
        data: &[u8],
    ) -> Result<(), QuicServerError> {
        send_stream
            .write_all(data)
            .await
            .map_err(|e| QuicServerError::Endpoint(format!("Failed to write to stream: {}", e)))?;

        Ok(())
    }

    /// Receive data from a stream
    ///
    /// # Requirements
    /// - 3.1: Accept incoming streams from clients
    ///
    /// # Arguments
    /// * `recv_stream` - The receive stream to read from
    /// * `buffer` - The buffer to read into
    ///
    /// # Returns
    /// * `Ok(bytes_read)` - Number of bytes read (None if stream is finished)
    pub async fn receive_from_stream(
        &self,
        recv_stream: &mut RecvStream,
        buffer: &mut [u8],
    ) -> Result<Option<usize>, QuicServerError> {
        match recv_stream.read(buffer).await {
            Ok(Some(n)) => Ok(Some(n)),
            Ok(None) => Ok(None), // Stream finished
            Err(e) => Err(QuicServerError::Endpoint(format!("Failed to read from stream: {}", e))),
        }
    }

    /// Read all data from a stream until it's finished
    ///
    /// # Requirements
    /// - 3.1: Accept incoming streams from clients
    ///
    /// # Arguments
    /// * `recv_stream` - The receive stream to read from
    /// * `max_size` - Maximum number of bytes to read (to prevent memory exhaustion)
    ///
    /// # Returns
    /// * `Ok(data)` - All data read from the stream
    pub async fn read_stream_to_end(
        &self,
        recv_stream: &mut RecvStream,
        max_size: usize,
    ) -> Result<Vec<u8>, QuicServerError> {
        let data = recv_stream
            .read_to_end(max_size)
            .await
            .map_err(|e| QuicServerError::Endpoint(format!("Failed to read stream to end: {}", e)))?;

        Ok(data)
    }

    /// Handle a bidirectional stream with stream allocator integration
    ///
    /// # Requirements
    /// - 3.1: Accept incoming streams from clients
    /// - 3.1: Track active streams per connection
    /// - 3.3: Handle stream lifecycle (open, close)
    ///
    /// # Arguments
    /// * `connection_id` - The connection ID
    /// * `_send_stream` - The send stream (unused in this method, but kept for API consistency)
    /// * `_recv_stream` - The receive stream (unused in this method, but kept for API consistency)
    /// * `msg_type` - The message type for this stream
    ///
    /// # Returns
    /// * `Ok(stream_id)` - The allocated stream ID
    pub async fn handle_stream_with_allocator(
        &self,
        connection_id: ConnectionId,
        _send_stream: SendStream,
        _recv_stream: RecvStream,
        msg_type: MessageType,
    ) -> Result<u64, QuicServerError> {
        let stream_allocator = self
            .stream_allocator
            .as_ref()
            .ok_or_else(|| QuicServerError::Config("Stream allocator not configured".to_string()))?;

        // Allocate a stream ID
        let stream_id = stream_allocator
            .allocate_stream(connection_id, msg_type)
            .await
            .map_err(|e| QuicServerError::Config(format!("Failed to allocate stream: {}", e)))?;

        info!(
            "Allocated stream {} for connection {} (type: {:?})",
            stream_id, connection_id, msg_type
        );

        Ok(stream_id)
    }

    /// Release a stream from the stream allocator
    ///
    /// # Requirements
    /// - 3.3: Handle stream lifecycle (close)
    ///
    /// # Arguments
    /// * `connection_id` - The connection ID
    /// * `stream_id` - The stream ID to release
    pub async fn release_stream_from_allocator(
        &self,
        connection_id: ConnectionId,
        stream_id: u64,
    ) -> Result<(), QuicServerError> {
        let stream_allocator = self
            .stream_allocator
            .as_ref()
            .ok_or_else(|| QuicServerError::Config("Stream allocator not configured".to_string()))?;

        stream_allocator
            .release_stream(connection_id, stream_id)
            .await
            .map_err(|e| QuicServerError::Config(format!("Failed to release stream: {}", e)))?;

        info!(
            "Released stream {} for connection {}",
            stream_id, connection_id
        );

        Ok(())
    }

    /// Handle connection migration for a QUIC connection
    ///
    /// # Requirements
    /// - 4.1: Detect network path changes and initiate connection migration
    /// - 4.2: Maintain session state and message ordering during migration
    /// - 4.3: Resume message transmission without data loss
    ///
    /// # Arguments
    /// * `connection_id` - The connection ID to handle migration for
    ///
    /// # Returns
    /// * `Ok(())` - Migration handled successfully
    /// * `Err(QuicServerError)` - Migration handling failed
    ///
    /// # Notes
    /// Quinn handles most of the migration automatically. This method provides
    /// application-level tracking and monitoring of the migration process.
    pub async fn handle_migration(
        &self,
        connection_id: ConnectionId,
    ) -> Result<(), QuicServerError> {
        let connection_manager = self
            .connection_manager
            .as_ref()
            .ok_or_else(|| QuicServerError::Config("Connection manager not configured".to_string()))?;

        info!("Handling migration for connection {}", connection_id);

        // Start migration tracking
        connection_manager
            .start_migration(connection_id)
            .await
            .map_err(|e| QuicServerError::Config(format!("Failed to start migration: {}", e)))?;

        // Quinn handles the actual migration automatically
        // We just need to track the state and ensure session continuity

        // Complete migration tracking
        connection_manager
            .complete_migration(connection_id)
            .await
            .map_err(|e| QuicServerError::Config(format!("Failed to complete migration: {}", e)))?;

        info!("Migration completed for connection {}", connection_id);

        Ok(())
    }

    /// Monitor a connection for migration events
    ///
    /// # Requirements
    /// - 4.1: Detect network path changes
    /// - 4.2: Preserve session state during migration
    ///
    /// # Arguments
    /// * `connection` - The Quinn connection to monitor
    /// * `connection_id` - The connection ID
    ///
    /// # Notes
    /// This method should be spawned as a background task to continuously
    /// monitor for migration events. Quinn handles migration automatically,
    /// but this allows us to track and log migration events.
    pub async fn monitor_connection_migration(
        &self,
        connection: Connection,
        connection_id: ConnectionId,
    ) -> Result<(), QuicServerError> {
        let connection_manager = self
            .connection_manager
            .as_ref()
            .ok_or_else(|| QuicServerError::Config("Connection manager not configured".to_string()))?;

        let remote_addr = connection.remote_address();
        let mut last_remote_addr = remote_addr;

        info!(
            "Starting migration monitor for connection {} (remote: {})",
            connection_id, remote_addr
        );

        // Monitor for address changes
        loop {
            // Wait a bit before checking again
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

            // Check if connection is still alive
            if connection.close_reason().is_some() {
                info!(
                    "Connection {} closed, stopping migration monitor",
                    connection_id
                );
                break;
            }

            // Check for address change
            let current_addr = connection.remote_address();
            if current_addr != last_remote_addr {
                info!(
                    "Detected address change for connection {}: {} -> {}",
                    connection_id, last_remote_addr, current_addr
                );

                // Handle the migration
                if let Err(e) = self.handle_migration(connection_id).await {
                    error!(
                        "Failed to handle migration for connection {}: {}",
                        connection_id, e
                    );

                    // Mark migration as failed
                    if let Err(e) = connection_manager.fail_migration(connection_id).await {
                        error!(
                            "Failed to mark migration as failed for {}: {}",
                            connection_id, e
                        );
                    }
                    break;
                }

                last_remote_addr = current_addr;
            }
        }

        Ok(())
    }

    /// Handle migration failure for a connection
    ///
    /// # Requirements
    /// - 4.4: Notify application layer to handle reconnection
    ///
    /// # Arguments
    /// * `connection_id` - The connection ID that failed migration
    ///
    /// # Returns
    /// * `Ok(())` - Failure handled successfully
    /// * `Err(QuicServerError)` - Error handling failure
    pub async fn handle_migration_failure(
        &self,
        connection_id: ConnectionId,
    ) -> Result<(), QuicServerError> {
        let connection_manager = self
            .connection_manager
            .as_ref()
            .ok_or_else(|| QuicServerError::Config("Connection manager not configured".to_string()))?;

        error!("Handling migration failure for connection {}", connection_id);

        // Mark migration as failed
        connection_manager
            .fail_migration(connection_id)
            .await
            .map_err(|e| QuicServerError::Config(format!("Failed to mark migration as failed: {}", e)))?;

        // The connection manager's migration monitor will clean up failed migrations
        // and the application layer can detect this through connection loss

        warn!(
            "Migration failed for connection {}, connection will be cleaned up",
            connection_id
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_server() {
        let config = QuicServerConfig::default();
        let server = QuicServer::new(config);
        assert!(server.endpoint.is_none());
        assert!(server.bound_addr.is_none());
    }

    #[tokio::test]
    async fn test_initial_state() {
        let config = QuicServerConfig::default();
        let server = QuicServer::new(config);
        assert_eq!(server.state().await, ServerState::NotInitialized);
        assert!(!server.is_running().await);
    }

    #[test]
    fn test_local_addr_before_init() {
        let config = QuicServerConfig::default();
        let server = QuicServer::new(config);
        assert!(server.local_addr().is_none());
    }

    #[test]
    fn test_endpoint_before_init() {
        let config = QuicServerConfig::default();
        let server = QuicServer::new(config);
        assert!(server.endpoint().is_none());
    }

    #[test]
    fn test_is_enabled_default() {
        let config = QuicServerConfig::default();
        let server = QuicServer::new(config);
        assert!(!server.is_enabled()); // Default is disabled
    }

    #[test]
    fn test_is_enabled_when_enabled() {
        let mut config = QuicServerConfig::default();
        config.enabled = true;
        let server = QuicServer::new(config);
        assert!(server.is_enabled());
    }

    #[tokio::test]
    async fn test_start_when_disabled() {
        let config = QuicServerConfig::default(); // enabled = false by default
        let mut server = QuicServer::new(config);
        
        // Try to start without initializing (should fail because disabled)
        let result = server.start().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("disabled"));
    }

    #[tokio::test]
    async fn test_accept_when_disabled() {
        let config = QuicServerConfig::default(); // enabled = false by default
        let server = QuicServer::new(config);
        
        // Try to accept connections when disabled
        let result = server.accept().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("disabled"));
    }

    #[test]
    fn test_config_getter() {
        let config = QuicServerConfig::default();
        let server = QuicServer::new(config.clone());
        assert_eq!(server.config().port, config.port);
        assert_eq!(server.config().enabled, config.enabled);
    }

    #[tokio::test]
    async fn test_update_config_success() {
        let config = QuicServerConfig::default();
        let mut server = QuicServer::new(config);

        // Create new configuration
        let mut new_config = QuicServerConfig::default();
        new_config.enabled = true;
        new_config.max_connections = 5000;

        // Update configuration
        let result = server.update_config(new_config).await;
        assert!(result.is_ok());

        // Verify configuration was updated
        assert!(server.config().enabled);
        assert_eq!(server.config().max_connections, 5000);
    }

    #[tokio::test]
    async fn test_update_config_invalid() {
        let config = QuicServerConfig::default();
        let mut server = QuicServer::new(config);

        // Create invalid configuration (zero port)
        let mut new_config = QuicServerConfig::default();
        new_config.port = 0;

        // Update configuration should fail
        let result = server.update_config(new_config).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid configuration"));

        // Verify old configuration is still in place
        assert_eq!(server.config().port, 4433); // Default port
    }

    #[tokio::test]
    async fn test_update_config_logs_changes() {
        let config = QuicServerConfig::default();
        let mut server = QuicServer::new(config);

        // Create new configuration with different values
        let mut new_config = QuicServerConfig::default();
        new_config.enabled = true;
        new_config.max_connections = 8000;
        new_config.max_streams_per_connection = 200;

        // Update configuration (should log changes)
        let result = server.update_config(new_config).await;
        assert!(result.is_ok());

        // Verify new values
        assert!(server.config().enabled);
        assert_eq!(server.config().max_connections, 8000);
        assert_eq!(server.config().max_streams_per_connection, 200);
    }

    #[tokio::test]
    async fn test_reload_config_from_env() {
        // Set environment variables
        std::env::set_var("QUIC_ENABLED", "true");
        std::env::set_var("QUIC_MAX_CONNECTIONS", "7000");

        let config = QuicServerConfig::default();
        let mut server = QuicServer::new(config);

        // Reload configuration from environment
        let result = server.reload_config_from_env().await;
        assert!(result.is_ok());

        // Verify configuration was updated from environment
        assert!(server.config().enabled);
        assert_eq!(server.config().max_connections, 7000);

        // Clean up
        std::env::remove_var("QUIC_ENABLED");
        std::env::remove_var("QUIC_MAX_CONNECTIONS");
    }

    #[tokio::test]
    async fn test_reload_config_from_env_invalid() {
        // Set invalid environment variable
        std::env::set_var("QUIC_PORT", "invalid");

        let config = QuicServerConfig::default();
        let mut server = QuicServer::new(config);

        // Reload should fail
        let result = server.reload_config_from_env().await;
        assert!(result.is_err());

        // Clean up
        std::env::remove_var("QUIC_PORT");
    }
}
