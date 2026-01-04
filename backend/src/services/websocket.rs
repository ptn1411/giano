use std::sync::Arc;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    models::MessageResponse,
    ws::{events::{ReadByInfo, ServerEvent}, WsManager},
};

/// Service for broadcasting WebSocket events
pub struct WebSocketService;

impl WebSocketService {
    /// Broadcast a new message to all chat participants
    pub async fn broadcast_new_message(
        ws_manager: &Arc<WsManager>,
        message: MessageResponse,
        participant_ids: &[Uuid],
        sender_id: Uuid,
    ) {
        let event = ServerEvent::NewMessage { message };
        ws_manager
            .broadcast_to_chat_participants(participant_ids, event, Some(sender_id))
            .await;
    }

    /// Broadcast message updated (edited) to all chat participants
    pub async fn broadcast_message_updated(
        ws_manager: &Arc<WsManager>,
        message: MessageResponse,
        participant_ids: &[Uuid],
        sender_id: Uuid,
    ) {
        let event = ServerEvent::MessageUpdated { message };
        ws_manager
            .broadcast_to_chat_participants(participant_ids, event, Some(sender_id))
            .await;
    }

    /// Broadcast message deleted to all chat participants
    pub async fn broadcast_message_deleted(
        ws_manager: &Arc<WsManager>,
        chat_id: Uuid,
        message_id: Uuid,
        participant_ids: &[Uuid],
        sender_id: Uuid,
    ) {
        let event = ServerEvent::MessageDeleted { chat_id, message_id };
        ws_manager
            .broadcast_to_chat_participants(participant_ids, event, Some(sender_id))
            .await;
    }

    /// Broadcast message pinned/unpinned to all chat participants
    pub async fn broadcast_message_pinned(
        ws_manager: &Arc<WsManager>,
        chat_id: Uuid,
        message_id: Uuid,
        is_pinned: bool,
        participant_ids: &[Uuid],
        sender_id: Uuid,
    ) {
        let event = ServerEvent::MessagePinned { chat_id, message_id, is_pinned };
        ws_manager
            .broadcast_to_chat_participants(participant_ids, event, Some(sender_id))
            .await;
    }

    /// Broadcast reaction updated to all chat participants
    pub async fn broadcast_reaction_updated(
        ws_manager: &Arc<WsManager>,
        message: MessageResponse,
        participant_ids: &[Uuid],
        sender_id: Uuid,
    ) {
        let event = ServerEvent::ReactionUpdated { message };
        ws_manager
            .broadcast_to_chat_participants(participant_ids, event, Some(sender_id))
            .await;
    }

    /// Broadcast typing indicator to chat participants
    pub async fn broadcast_typing(
        ws_manager: &Arc<WsManager>,
        chat_id: Uuid,
        user_id: Uuid,
        user_name: String,
        is_typing: bool,
    ) {
        let event = ServerEvent::Typing {
            chat_id,
            user_id,
            user_name,
            is_typing,
        };
        ws_manager.broadcast_to_room(chat_id, event, Some(user_id)).await;
    }

    /// Broadcast user status change (online/offline)
    pub async fn broadcast_user_status(
        ws_manager: &Arc<WsManager>,
        user_id: Uuid,
        status: String,
        last_seen: Option<DateTime<Utc>>,
    ) {
        let event = ServerEvent::UserStatus {
            user_id,
            status,
            last_seen,
        };
        ws_manager.broadcast_user_status(event).await;
    }

    /// Broadcast message delivery status update
    pub async fn broadcast_message_status(
        ws_manager: &Arc<WsManager>,
        chat_id: Uuid,
        message_id: Uuid,
        status: String,
        sender_id: Uuid,
    ) {
        let event = ServerEvent::MessageStatus {
            chat_id,
            message_id,
            status,
        };
        // Send to the message sender
        ws_manager.send_to_user(sender_id, event).await;
    }

    /// Broadcast message read receipt
    pub async fn broadcast_message_read(
        ws_manager: &Arc<WsManager>,
        chat_id: Uuid,
        message_id: Uuid,
        reader_id: Uuid,
        read_at: DateTime<Utc>,
        sender_id: Uuid,
    ) {
        let event = ServerEvent::MessageRead {
            chat_id,
            message_id,
            read_by: ReadByInfo {
                user_id: reader_id,
                read_at,
            },
        };
        // Send to the message sender
        ws_manager.send_to_user(sender_id, event).await;
    }

    // ==================== Call Events ====================

    /// Send incoming call notification to a user
    pub async fn send_incoming_call(
        ws_manager: &Arc<WsManager>,
        call_id: Uuid,
        caller_id: Uuid,
        caller_name: String,
        caller_avatar: Option<String>,
        chat_id: Uuid,
        call_type: String,
        target_user_id: Uuid,
    ) {
        let event = ServerEvent::IncomingCall {
            call_id,
            caller_id,
            caller_name,
            caller_avatar,
            chat_id,
            call_type,
        };
        ws_manager.send_to_user(target_user_id, event).await;
    }

    /// Send call accepted notification to both parties
    pub async fn send_call_accepted(
        ws_manager: &Arc<WsManager>,
        call_id: Uuid,
        room_id: String,
        mediasoup_url: String,
        caller_id: Uuid,
        callee_id: Uuid,
    ) {
        let event = ServerEvent::CallAccepted {
            call_id,
            room_id,
            mediasoup_url,
        };
        ws_manager.send_to_user(caller_id, event.clone()).await;
        ws_manager.send_to_user(callee_id, event).await;
    }

    /// Send call declined notification to caller
    pub async fn send_call_declined(
        ws_manager: &Arc<WsManager>,
        call_id: Uuid,
        caller_id: Uuid,
    ) {
        let event = ServerEvent::CallDeclined { call_id };
        ws_manager.send_to_user(caller_id, event).await;
    }

    /// Send call ended notification to both parties
    pub async fn send_call_ended(
        ws_manager: &Arc<WsManager>,
        call_id: Uuid,
        reason: String,
        caller_id: Uuid,
        callee_id: Uuid,
    ) {
        let event = ServerEvent::CallEnded { call_id, reason };
        ws_manager.send_to_user(caller_id, event.clone()).await;
        ws_manager.send_to_user(callee_id, event).await;
    }

    /// Send user busy notification to caller
    pub async fn send_user_busy(
        ws_manager: &Arc<WsManager>,
        call_id: Uuid,
        caller_id: Uuid,
    ) {
        let event = ServerEvent::UserBusy { call_id };
        ws_manager.send_to_user(caller_id, event).await;
    }
}
