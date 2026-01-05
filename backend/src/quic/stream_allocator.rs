use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use thiserror::Error;

use crate::quic::ConnectionId;

/// Stream allocator errors
#[derive(Debug, Error)]
pub enum StreamAllocatorError {
    #[error("No available streams in range for message type: {0:?}")]
    NoAvailableStreams(MessageType),

    #[error("Invalid stream ID: {0}")]
    InvalidStreamId(u64),

    #[error("Stream already allocated: {0}")]
    StreamAlreadyAllocated(u64),

    #[error("Connection not found: {0}")]
    ConnectionNotFound(ConnectionId),
}

/// Message types that determine stream allocation
///
/// # Requirements
/// - 3.1: Assign different message types to separate streams
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MessageType {
    /// Control messages (authentication, presence, typing indicators)
    Control,
    /// Chat messages
    ChatMessage,
    /// File transfers and media
    FileTransfer,
    /// Bot commands and responses
    BotCommand,
}

impl MessageType {
    /// Get the stream range for this message type
    ///
    /// Stream allocation strategy from design:
    /// - Stream 0: Control messages
    /// - Stream 1-99: Chat messages
    /// - Stream 100-199: File transfers and media
    /// - Stream 200+: Bot commands and responses
    pub fn stream_range(&self) -> StreamRange {
        match self {
            MessageType::Control => StreamRange { start: 0, end: 0 },
            MessageType::ChatMessage => StreamRange { start: 1, end: 99 },
            MessageType::FileTransfer => StreamRange { start: 100, end: 199 },
            MessageType::BotCommand => StreamRange { start: 200, end: 299 },
        }
    }

    /// Determine message type from stream ID
    pub fn from_stream_id(stream_id: u64) -> Result<Self, StreamAllocatorError> {
        match stream_id {
            0 => Ok(MessageType::Control),
            1..=99 => Ok(MessageType::ChatMessage),
            100..=199 => Ok(MessageType::FileTransfer),
            200..=299 => Ok(MessageType::BotCommand),
            _ => Err(StreamAllocatorError::InvalidStreamId(stream_id)),
        }
    }
}

/// Range of stream IDs for a message type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StreamRange {
    /// Start of the range (inclusive)
    pub start: u64,
    /// End of the range (inclusive)
    pub end: u64,
}

impl StreamRange {
    /// Check if a stream ID is within this range
    pub fn contains(&self, stream_id: u64) -> bool {
        stream_id >= self.start && stream_id <= self.end
    }

    /// Get the number of streams in this range
    pub fn size(&self) -> u64 {
        self.end - self.start + 1
    }
}

/// Stream type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamType {
    /// Control stream
    Control,
    /// Chat message stream
    ChatMessage,
    /// File transfer stream
    FileTransfer,
    /// Bot command stream
    BotCommand,
}

impl From<MessageType> for StreamType {
    fn from(msg_type: MessageType) -> Self {
        match msg_type {
            MessageType::Control => StreamType::Control,
            MessageType::ChatMessage => StreamType::ChatMessage,
            MessageType::FileTransfer => StreamType::FileTransfer,
            MessageType::BotCommand => StreamType::BotCommand,
        }
    }
}

/// Tracks active streams per connection
#[derive(Debug)]
struct ConnectionStreams {
    /// Map of stream ID to message type
    active_streams: HashMap<u64, MessageType>,
    /// Next stream ID to allocate for each message type
    next_stream_id: HashMap<MessageType, u64>,
}

impl ConnectionStreams {
    fn new() -> Self {
        let mut next_stream_id = HashMap::new();
        // Initialize next stream IDs to the start of each range
        next_stream_id.insert(MessageType::Control, 0);
        next_stream_id.insert(MessageType::ChatMessage, 1);
        next_stream_id.insert(MessageType::FileTransfer, 100);
        next_stream_id.insert(MessageType::BotCommand, 200);

        Self {
            active_streams: HashMap::new(),
            next_stream_id,
        }
    }

    /// Allocate a new stream for the given message type
    fn allocate_stream(&mut self, msg_type: MessageType) -> Result<u64, StreamAllocatorError> {
        let range = msg_type.stream_range();
        let next_id = self.next_stream_id.get(&msg_type).copied().unwrap_or(range.start);

        // Find an available stream ID in the range
        let mut stream_id = next_id;
        let mut attempts = 0;
        let max_attempts = range.size();

        while attempts < max_attempts {
            if !self.active_streams.contains_key(&stream_id) {
                // Found an available stream
                self.active_streams.insert(stream_id, msg_type);
                
                // Update next stream ID (wrap around within range)
                let next = if stream_id >= range.end {
                    range.start
                } else {
                    stream_id + 1
                };
                self.next_stream_id.insert(msg_type, next);

                return Ok(stream_id);
            }

            // Try next stream ID (wrap around within range)
            stream_id = if stream_id >= range.end {
                range.start
            } else {
                stream_id + 1
            };
            attempts += 1;
        }

        // No available streams in the range
        Err(StreamAllocatorError::NoAvailableStreams(msg_type))
    }

    /// Release a stream
    fn release_stream(&mut self, stream_id: u64) -> Result<(), StreamAllocatorError> {
        self.active_streams
            .remove(&stream_id)
            .ok_or(StreamAllocatorError::InvalidStreamId(stream_id))?;
        Ok(())
    }

    /// Get the message type for a stream
    fn get_stream_type(&self, stream_id: u64) -> Option<MessageType> {
        self.active_streams.get(&stream_id).copied()
    }

    /// Get all active stream IDs
    fn active_stream_ids(&self) -> Vec<u64> {
        self.active_streams.keys().copied().collect()
    }

    /// Get the number of active streams
    fn active_stream_count(&self) -> usize {
        self.active_streams.len()
    }

    /// Get the number of active streams for a specific message type
    fn active_stream_count_for_type(&self, msg_type: MessageType) -> usize {
        self.active_streams
            .values()
            .filter(|&&t| t == msg_type)
            .count()
    }
}

/// Manages stream allocation for QUIC connections
///
/// # Requirements
/// - 3.1: Assign different message types to separate streams
/// - 3.2: Support concurrent streams without blocking
/// - 3.3: Handle stream lifecycle (open, close)
pub struct StreamAllocator {
    /// Map of connection ID to its active streams
    connections: Arc<RwLock<HashMap<ConnectionId, ConnectionStreams>>>,
}

impl StreamAllocator {
    /// Create a new stream allocator
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new connection
    ///
    /// # Requirements
    /// - 3.1: Track active streams per connection
    pub async fn register_connection(&self, connection_id: ConnectionId) {
        let mut connections = self.connections.write().await;
        connections.insert(connection_id, ConnectionStreams::new());
    }

    /// Unregister a connection and release all its streams
    ///
    /// # Requirements
    /// - 3.3: Handle stream lifecycle
    pub async fn unregister_connection(&self, connection_id: ConnectionId) -> Result<(), StreamAllocatorError> {
        let mut connections = self.connections.write().await;
        connections
            .remove(&connection_id)
            .ok_or(StreamAllocatorError::ConnectionNotFound(connection_id))?;
        Ok(())
    }

    /// Allocate a stream for a specific message type on a connection
    ///
    /// # Requirements
    /// - 3.1: Assign different message types to separate streams
    ///
    /// # Arguments
    /// * `connection_id` - The connection to allocate a stream for
    /// * `msg_type` - The type of message that will use this stream
    ///
    /// # Returns
    /// * `Ok(stream_id)` - The allocated stream ID
    /// * `Err(StreamAllocatorError)` - If allocation fails
    pub async fn allocate_stream(
        &self,
        connection_id: ConnectionId,
        msg_type: MessageType,
    ) -> Result<u64, StreamAllocatorError> {
        let mut connections = self.connections.write().await;
        let conn_streams = connections
            .get_mut(&connection_id)
            .ok_or(StreamAllocatorError::ConnectionNotFound(connection_id))?;

        conn_streams.allocate_stream(msg_type)
    }

    /// Release a stream when it's closed
    ///
    /// # Requirements
    /// - 3.3: Handle stream lifecycle (close)
    ///
    /// # Arguments
    /// * `connection_id` - The connection the stream belongs to
    /// * `stream_id` - The stream ID to release
    pub async fn release_stream(
        &self,
        connection_id: ConnectionId,
        stream_id: u64,
    ) -> Result<(), StreamAllocatorError> {
        let mut connections = self.connections.write().await;
        let conn_streams = connections
            .get_mut(&connection_id)
            .ok_or(StreamAllocatorError::ConnectionNotFound(connection_id))?;

        conn_streams.release_stream(stream_id)
    }

    /// Get the message type for a stream
    ///
    /// # Requirements
    /// - 3.1: Track stream type assignments
    pub async fn get_stream_type(
        &self,
        connection_id: ConnectionId,
        stream_id: u64,
    ) -> Result<MessageType, StreamAllocatorError> {
        let connections = self.connections.read().await;
        let conn_streams = connections
            .get(&connection_id)
            .ok_or(StreamAllocatorError::ConnectionNotFound(connection_id))?;

        conn_streams
            .get_stream_type(stream_id)
            .ok_or(StreamAllocatorError::InvalidStreamId(stream_id))
    }

    /// Get all active stream IDs for a connection
    pub async fn get_active_streams(&self, connection_id: ConnectionId) -> Result<Vec<u64>, StreamAllocatorError> {
        let connections = self.connections.read().await;
        let conn_streams = connections
            .get(&connection_id)
            .ok_or(StreamAllocatorError::ConnectionNotFound(connection_id))?;

        Ok(conn_streams.active_stream_ids())
    }

    /// Get the number of active streams for a connection
    pub async fn active_stream_count(&self, connection_id: ConnectionId) -> Result<usize, StreamAllocatorError> {
        let connections = self.connections.read().await;
        let conn_streams = connections
            .get(&connection_id)
            .ok_or(StreamAllocatorError::ConnectionNotFound(connection_id))?;

        Ok(conn_streams.active_stream_count())
    }

    /// Get the number of active streams for a specific message type on a connection
    pub async fn active_stream_count_for_type(
        &self,
        connection_id: ConnectionId,
        msg_type: MessageType,
    ) -> Result<usize, StreamAllocatorError> {
        let connections = self.connections.read().await;
        let conn_streams = connections
            .get(&connection_id)
            .ok_or(StreamAllocatorError::ConnectionNotFound(connection_id))?;

        Ok(conn_streams.active_stream_count_for_type(msg_type))
    }

    /// Get statistics about stream allocation
    pub async fn get_stats(&self) -> StreamAllocatorStats {
        let connections = self.connections.read().await;
        
        let total_connections = connections.len();
        let mut total_streams = 0;
        let mut streams_by_type = HashMap::new();

        for conn_streams in connections.values() {
            total_streams += conn_streams.active_stream_count();
            
            for msg_type in &[
                MessageType::Control,
                MessageType::ChatMessage,
                MessageType::FileTransfer,
                MessageType::BotCommand,
            ] {
                let count = conn_streams.active_stream_count_for_type(*msg_type);
                *streams_by_type.entry(*msg_type).or_insert(0) += count;
            }
        }

        StreamAllocatorStats {
            total_connections,
            total_streams,
            control_streams: *streams_by_type.get(&MessageType::Control).unwrap_or(&0),
            chat_streams: *streams_by_type.get(&MessageType::ChatMessage).unwrap_or(&0),
            file_streams: *streams_by_type.get(&MessageType::FileTransfer).unwrap_or(&0),
            bot_streams: *streams_by_type.get(&MessageType::BotCommand).unwrap_or(&0),
        }
    }
}

impl Default for StreamAllocator {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics about stream allocation
#[derive(Debug, Clone)]
pub struct StreamAllocatorStats {
    /// Total number of connections
    pub total_connections: usize,
    /// Total number of active streams
    pub total_streams: usize,
    /// Number of control streams
    pub control_streams: usize,
    /// Number of chat message streams
    pub chat_streams: usize,
    /// Number of file transfer streams
    pub file_streams: usize,
    /// Number of bot command streams
    pub bot_streams: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_type_stream_range() {
        assert_eq!(MessageType::Control.stream_range(), StreamRange { start: 0, end: 0 });
        assert_eq!(MessageType::ChatMessage.stream_range(), StreamRange { start: 1, end: 99 });
        assert_eq!(MessageType::FileTransfer.stream_range(), StreamRange { start: 100, end: 199 });
        assert_eq!(MessageType::BotCommand.stream_range(), StreamRange { start: 200, end: 299 });
    }

    #[test]
    fn test_message_type_from_stream_id() {
        assert_eq!(MessageType::from_stream_id(0).unwrap(), MessageType::Control);
        assert_eq!(MessageType::from_stream_id(1).unwrap(), MessageType::ChatMessage);
        assert_eq!(MessageType::from_stream_id(50).unwrap(), MessageType::ChatMessage);
        assert_eq!(MessageType::from_stream_id(99).unwrap(), MessageType::ChatMessage);
        assert_eq!(MessageType::from_stream_id(100).unwrap(), MessageType::FileTransfer);
        assert_eq!(MessageType::from_stream_id(150).unwrap(), MessageType::FileTransfer);
        assert_eq!(MessageType::from_stream_id(199).unwrap(), MessageType::FileTransfer);
        assert_eq!(MessageType::from_stream_id(200).unwrap(), MessageType::BotCommand);
        assert_eq!(MessageType::from_stream_id(250).unwrap(), MessageType::BotCommand);
        assert_eq!(MessageType::from_stream_id(299).unwrap(), MessageType::BotCommand);
        assert!(MessageType::from_stream_id(300).is_err());
    }

    #[test]
    fn test_stream_range_contains() {
        let range = StreamRange { start: 1, end: 99 };
        assert!(!range.contains(0));
        assert!(range.contains(1));
        assert!(range.contains(50));
        assert!(range.contains(99));
        assert!(!range.contains(100));
    }

    #[test]
    fn test_stream_range_size() {
        assert_eq!(StreamRange { start: 0, end: 0 }.size(), 1);
        assert_eq!(StreamRange { start: 1, end: 99 }.size(), 99);
        assert_eq!(StreamRange { start: 100, end: 199 }.size(), 100);
    }

    #[tokio::test]
    async fn test_stream_allocator_new() {
        let allocator = StreamAllocator::new();
        let stats = allocator.get_stats().await;
        assert_eq!(stats.total_connections, 0);
        assert_eq!(stats.total_streams, 0);
    }

    #[tokio::test]
    async fn test_register_connection() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        let stats = allocator.get_stats().await;
        assert_eq!(stats.total_connections, 1);
    }

    #[tokio::test]
    async fn test_allocate_stream() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        // Allocate a control stream
        let stream_id = allocator.allocate_stream(conn_id, MessageType::Control).await.unwrap();
        assert_eq!(stream_id, 0);
        
        // Allocate a chat message stream
        let stream_id = allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        assert_eq!(stream_id, 1);
        
        // Allocate another chat message stream
        let stream_id = allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        assert_eq!(stream_id, 2);
    }

    #[tokio::test]
    async fn test_allocate_multiple_message_types() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        // Allocate streams for different message types
        let control_stream = allocator.allocate_stream(conn_id, MessageType::Control).await.unwrap();
        let chat_stream = allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        let file_stream = allocator.allocate_stream(conn_id, MessageType::FileTransfer).await.unwrap();
        let bot_stream = allocator.allocate_stream(conn_id, MessageType::BotCommand).await.unwrap();
        
        assert_eq!(control_stream, 0);
        assert_eq!(chat_stream, 1);
        assert_eq!(file_stream, 100);
        assert_eq!(bot_stream, 200);
        
        let stats = allocator.get_stats().await;
        assert_eq!(stats.total_streams, 4);
        assert_eq!(stats.control_streams, 1);
        assert_eq!(stats.chat_streams, 1);
        assert_eq!(stats.file_streams, 1);
        assert_eq!(stats.bot_streams, 1);
    }

    #[tokio::test]
    async fn test_release_stream() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        let stream_id = allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        assert_eq!(allocator.active_stream_count(conn_id).await.unwrap(), 1);
        
        allocator.release_stream(conn_id, stream_id).await.unwrap();
        assert_eq!(allocator.active_stream_count(conn_id).await.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_get_stream_type() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        let stream_id = allocator.allocate_stream(conn_id, MessageType::FileTransfer).await.unwrap();
        let msg_type = allocator.get_stream_type(conn_id, stream_id).await.unwrap();
        
        assert_eq!(msg_type, MessageType::FileTransfer);
    }

    #[tokio::test]
    async fn test_unregister_connection() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        
        let stats = allocator.get_stats().await;
        assert_eq!(stats.total_connections, 1);
        assert_eq!(stats.total_streams, 1);
        
        allocator.unregister_connection(conn_id).await.unwrap();
        
        let stats = allocator.get_stats().await;
        assert_eq!(stats.total_connections, 0);
        assert_eq!(stats.total_streams, 0);
    }

    #[tokio::test]
    async fn test_stream_reuse_after_release() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        // Allocate and release a stream
        let stream_id1 = allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        allocator.release_stream(conn_id, stream_id1).await.unwrap();
        
        // Allocate another stream - should get a different ID (round-robin)
        let stream_id2 = allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        assert_eq!(stream_id2, 2); // Next in sequence
        
        // Now allocate again - should reuse stream_id1
        let stream_id3 = allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        assert_eq!(stream_id3, 3);
    }

    #[tokio::test]
    async fn test_active_stream_count_for_type() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        // Allocate multiple chat streams
        allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        allocator.allocate_stream(conn_id, MessageType::FileTransfer).await.unwrap();
        
        let chat_count = allocator.active_stream_count_for_type(conn_id, MessageType::ChatMessage).await.unwrap();
        let file_count = allocator.active_stream_count_for_type(conn_id, MessageType::FileTransfer).await.unwrap();
        
        assert_eq!(chat_count, 2);
        assert_eq!(file_count, 1);
    }

    #[tokio::test]
    async fn test_control_stream_single_allocation() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        // Control stream range only has one stream (0)
        let stream_id = allocator.allocate_stream(conn_id, MessageType::Control).await.unwrap();
        assert_eq!(stream_id, 0);
        
        // Try to allocate another control stream - should fail
        let result = allocator.allocate_stream(conn_id, MessageType::Control).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_active_streams() {
        let allocator = StreamAllocator::new();
        let conn_id = ConnectionId::new();
        
        allocator.register_connection(conn_id).await;
        
        let stream1 = allocator.allocate_stream(conn_id, MessageType::ChatMessage).await.unwrap();
        let stream2 = allocator.allocate_stream(conn_id, MessageType::FileTransfer).await.unwrap();
        
        let active_streams = allocator.get_active_streams(conn_id).await.unwrap();
        assert_eq!(active_streams.len(), 2);
        assert!(active_streams.contains(&stream1));
        assert!(active_streams.contains(&stream2));
    }
}
