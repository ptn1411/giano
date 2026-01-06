use anyhow::Result;
use chat_backend::{config::Config, create_app, quic};
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    // Install the ring crypto provider for rustls (required for QUIC/TLS)
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "chat_backend=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    
    // Create uploads directory if it doesn't exist
    tokio::fs::create_dir_all("uploads").await?;
    tracing::info!("Uploads directory ready");
    
    let addr = format!("{}:{}", config.host, config.port);
    tracing::info!("Starting HTTP/WebSocket server on {}", addr);

    // Create app (this returns the router and shared state)
    let (app, app_state) = create_app(config.clone()).await?;

    // Initialize QUIC server if enabled
    let quic_config = quic::QuicServerConfig::from_env()?;
    let quic_server_handle = if quic_config.enabled {
        tracing::info!("QUIC is enabled, initializing QUIC server...");
        
        // Create QUIC server
        let mut quic_server = quic::QuicServer::new(quic_config.clone());
        
        // Set JWT secret (same as WebSocket)
        quic_server.set_jwt_secret(config.jwt_secret.clone());
        
        // Share connection manager between transports
        let connection_manager = Arc::clone(&app_state.connection_manager);
        quic_server.set_connection_manager(connection_manager);
        
        // Set stream allocator
        let stream_allocator = Arc::clone(&app_state.stream_allocator);
        quic_server.set_stream_allocator(stream_allocator);
        
        // Initialize QUIC server
        quic_server.initialize().await?;
        quic_server.start().await?;
        
        let quic_addr = quic_server.local_addr().unwrap();
        tracing::info!("QUIC server started on {}", quic_addr);
        
        // Spawn QUIC server task
        let quic_server = Arc::new(quic_server);
        let quic_server_clone = Arc::clone(&quic_server);
        let app_state_clone = Arc::clone(&app_state);
        let quic_handle = tokio::spawn(async move {
            if let Err(e) = run_quic_server(quic_server_clone, app_state_clone).await {
                tracing::error!("QUIC server error: {}", e);
            }
        });
        
        Some((quic_server, quic_handle))
    } else {
        tracing::info!("QUIC is disabled in configuration");
        None
    };

    // Start HTTP/WebSocket server
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    let http_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            tracing::error!("HTTP server error: {}", e);
        }
    });

    // Wait for shutdown signal
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("Received shutdown signal");
        }
        _ = http_handle => {
            tracing::info!("HTTP server stopped");
        }
    }

    // Graceful shutdown
    tracing::info!("Shutting down servers...");
    
    // Stop QUIC server if it was started
    if let Some((_quic_server, quic_handle)) = quic_server_handle {
        tracing::info!("Stopping QUIC server...");
        // The QUIC server will be stopped when the Arc is dropped
        quic_handle.abort();
    }

    tracing::info!("Shutdown complete");
    Ok(())
}

/// Run the QUIC server connection acceptance loop
async fn run_quic_server(
    quic_server: Arc<quic::QuicServer>,
    app_state: Arc<chat_backend::AppState>,
) -> Result<()> {
    let server_clone = Arc::clone(&quic_server);
    quic_server.run(move |connection| {
        let server = Arc::clone(&server_clone);
        let state = Arc::clone(&app_state);
        async move {
            // Authenticate and register the connection
            match server.authenticate_and_register_connection(connection.clone()).await {
                Ok((connection_id, user_id, user_name)) => {
                    tracing::info!(
                        "QUIC connection authenticated: connection_id={}, user_id={}, user_name={}",
                        connection_id, user_id, user_name
                    );
                    
                    // Create message router for this connection
                    let message_router = quic::MessageRouter::new(
                        Arc::clone(&state),
                        Arc::clone(&state.ws_manager),
                    );
                    
                    // Handle incoming streams and messages
                    if let Err(e) = handle_quic_connection(
                        connection,
                        connection_id,
                        user_id,
                        user_name,
                        message_router,
                    ).await {
                        tracing::error!(
                            "Error handling QUIC connection {}: {}",
                            connection_id, e
                        );
                    }
                    
                    // Unregister connection when done
                    if let Err(e) = state.connection_manager.unregister_connection(connection_id).await {
                        tracing::error!(
                            "Failed to unregister connection {}: {}",
                            connection_id, e
                        );
                    }
                    
                    Ok(())
                }
                Err(e) => {
                    tracing::error!("Failed to authenticate QUIC connection: {}", e);
                    Err(e)
                }
            }
        }
    }).await?;
    
    Ok(())
}

/// Handle a QUIC connection by processing incoming streams
async fn handle_quic_connection(
    connection: quic::Connection,
    connection_id: quic::ConnectionId,
    user_id: uuid::Uuid,
    user_name: String,
    message_router: quic::MessageRouter,
) -> Result<()> {
    tracing::info!(
        "Handling QUIC connection: connection_id={}, user_id={}",
        connection_id, user_id
    );
    
    // Accept and handle bidirectional streams
    loop {
        match connection.accept_bi().await {
            Ok((mut send_stream, mut recv_stream)) => {
                tracing::debug!(
                    "Accepted bidirectional stream for connection {}",
                    connection_id
                );
                
                // Read message from stream
                match recv_stream.read_to_end(1024 * 1024).await {
                    Ok(data) => {
                        tracing::debug!(
                            "Received {} bytes from connection {}",
                            data.len(), connection_id
                        );
                        
                        // Route the message
                        match message_router.route_message(
                            &data,
                            connection_id,
                            user_id,
                            &user_name,
                        ).await {
                            Ok(Some(response)) => {
                                // Send response if there is one
                                if let Err(e) = send_stream.write_all(&response).await {
                                    tracing::error!(
                                        "Failed to send response on connection {}: {}",
                                        connection_id, e
                                    );
                                }
                                if let Err(e) = send_stream.finish() {
                                    tracing::error!(
                                        "Failed to finish send stream on connection {}: {}",
                                        connection_id, e
                                    );
                                }
                            }
                            Ok(None) => {
                                // No response needed, just finish the stream
                                if let Err(e) = send_stream.finish() {
                                    tracing::error!(
                                        "Failed to finish send stream on connection {}: {}",
                                        connection_id, e
                                    );
                                }
                            }
                            Err(e) => {
                                tracing::error!(
                                    "Failed to route message from connection {}: {}",
                                    connection_id, e
                                );
                                // Send error response
                                let error_msg = format!("{{\"error\":\"{}\"}}", e);
                                if let Err(e) = send_stream.write_all(error_msg.as_bytes()).await {
                                    tracing::error!(
                                        "Failed to send error response on connection {}: {}",
                                        connection_id, e
                                    );
                                }
                                if let Err(e) = send_stream.finish() {
                                    tracing::error!(
                                        "Failed to finish send stream on connection {}: {}",
                                        connection_id, e
                                    );
                                }
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            "Failed to read from stream on connection {}: {}",
                            connection_id, e
                        );
                    }
                }
            }
            Err(e) => {
                // Connection closed or error
                tracing::info!(
                    "Connection {} closed or error accepting stream: {}",
                    connection_id, e
                );
                break;
            }
        }
    }
    
    tracing::info!("Finished handling QUIC connection: connection_id={}", connection_id);
    Ok(())
}