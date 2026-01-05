# QUIC Connection Migration Support

## Overview

This document describes the connection migration support implemented for the QUIC transport layer. Connection migration is a key feature of QUIC that allows connections to survive network path changes (e.g., switching from WiFi to cellular).

## Implementation

### Requirements Addressed

- **4.1**: Detect network path changes and initiate connection migration
- **4.2**: Maintain session state and message ordering during migration
- **4.3**: Resume message transmission without data loss
- **4.4**: Detect migration timeout and notify application layer

### Components

#### 1. MigrationState Enum

Tracks the current state of a connection's migration:

- `Stable`: No migration in progress
- `Migrating`: Migration currently in progress
- `MigrationCompleted`: Migration completed successfully (transitions back to Stable)
- `MigrationFailed`: Migration failed

#### 2. QuicConnection Enhancements

Added migration tracking fields:
- `migration_state`: Current migration state
- `migration_count`: Number of successful migrations
- `last_migration`: Timestamp of last successful migration
- `migration_started_at`: Timestamp when current migration started (for timeout detection)

Added migration methods:
- `start_migration()`: Initiates migration tracking
- `complete_migration()`: Marks migration as successful
- `fail_migration()`: Marks migration as failed
- `is_migrating()`: Checks if migration is in progress
- `has_migration_failed()`: Checks if migration has failed
- `has_migration_timed_out(timeout)`: Checks if migration has exceeded timeout
- `time_since_migration_started()`: Returns duration since migration started

#### 3. ConnectionManager Enhancements

Added migration management methods:
- `detect_migration(connection_id)`: Detects if migration is needed
- `start_migration(connection_id)`: Starts migration for a connection
- `complete_migration(connection_id)`: Completes migration for a connection
- `fail_migration(connection_id)`: Marks migration as failed
- `get_migrating_connections()`: Returns list of connections currently migrating
- `get_failed_migrations()`: Returns list of connections with failed migrations
- `get_migration_stats()`: Returns migration statistics
- `run_migration_monitor(migration_timeout)`: Background task to monitor migrations

#### 4. QuicServer Enhancements

Added migration handling methods:
- `handle_migration(connection_id)`: Handles migration for a connection
- `monitor_connection_migration(connection, connection_id)`: Monitors a connection for migration events
- `handle_migration_failure(connection_id)`: Handles migration failures

### How It Works

#### Automatic Migration (Quinn)

Quinn (the QUIC library) handles most of the migration automatically:
- Detects network path changes
- Performs path validation
- Migrates the connection to the new path
- Maintains packet ordering and reliability

#### Application-Level Tracking

Our implementation adds application-level tracking and monitoring:

1. **Detection**: The `monitor_connection_migration()` method monitors for address changes
2. **Tracking**: When a migration is detected, we call `start_migration()` to track it
3. **Completion**: After successful migration, we call `complete_migration()` to record it
4. **Timeout Detection**: The `run_migration_monitor()` background task checks for timeouts
5. **Failure Handling**: If migration times out or fails, we mark it as failed and clean up

#### Migration Timeout

The migration monitor runs every second and checks:
- If any connections are in the `Migrating` state
- If they've been migrating longer than the configured timeout
- If so, marks them as failed and cleans them up

#### Failure Notification

When a migration fails:
1. The connection is marked with `MigrationState::MigrationFailed`
2. The migration monitor detects the failed state
3. The connection is unregistered from the ConnectionManager
4. The application layer detects the connection loss and can handle reconnection

### Session State Preservation

During migration, Quinn automatically:
- Maintains the connection ID
- Preserves stream state
- Ensures packet ordering
- Retransmits lost packets

Our implementation preserves:
- User authentication state (user_id remains associated)
- Connection metadata (connection_id, timestamps)
- Migration history (migration_count, last_migration)

### Usage Example

```rust
use std::sync::Arc;
use std::time::Duration;
use chat_backend::quic::{ConnectionManager, QuicServer};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create connection manager
    let connection_manager = Arc::new(ConnectionManager::new());
    
    // Start migration monitor with 30-second timeout
    let cm_clone = Arc::clone(&connection_manager);
    tokio::spawn(async move {
        cm_clone.run_migration_monitor(Duration::from_secs(30)).await;
    });
    
    // Create and configure QUIC server
    let mut server = QuicServer::new(config);
    server.set_connection_manager(Arc::clone(&connection_manager));
    
    // Accept and handle connections
    let connection = server.accept().await?;
    let (conn_id, user_id, user_name) = 
        server.authenticate_and_register_connection(connection.clone()).await?;
    
    // Monitor for migrations
    tokio::spawn(async move {
        server.monitor_connection_migration(connection, conn_id).await
    });
    
    Ok(())
}
```

### Monitoring

Get migration statistics:

```rust
let stats = connection_manager.get_migration_stats().await;
println!("Migrating: {}", stats.migrating_connections);
println!("Failed: {}", stats.failed_migrations);
println!("Total successful: {}", stats.total_successful_migrations);
```

### Configuration

Migration timeout is configurable when starting the migration monitor:

```rust
// 30-second timeout
connection_manager.run_migration_monitor(Duration::from_secs(30)).await;

// 60-second timeout for slower networks
connection_manager.run_migration_monitor(Duration::from_secs(60)).await;
```

### Testing

To test migration:
1. Establish a QUIC connection
2. Change the client's network path (e.g., switch from WiFi to cellular)
3. Verify the connection remains active
4. Check migration statistics to confirm successful migration

### Limitations

- Migration detection relies on address changes, which Quinn handles internally
- The current implementation tracks migrations but doesn't implement custom migration logic
- Migration is transparent to the application layer (by design)
- Failed migrations result in connection cleanup, requiring client reconnection

### Future Enhancements

Potential improvements:
- Add migration event callbacks for application-level notification
- Implement custom migration policies (e.g., prefer certain network paths)
- Add metrics for migration latency and success rates
- Support migration between different server instances (requires additional state synchronization)

## References

- [QUIC RFC 9000 - Connection Migration](https://www.rfc-editor.org/rfc/rfc9000.html#name-connection-migration)
- [Quinn Documentation](https://docs.rs/quinn/)
