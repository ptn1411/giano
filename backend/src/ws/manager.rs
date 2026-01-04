use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use super::events::{BotServerEvent, ServerEvent};

/// Represents a connected WebSocket client
#[derive(Debug, Clone)]
pub struct Client {
    pub user_id: Uuid,
    pub user_name: String,
    pub sender: mpsc::UnboundedSender<ServerEvent>,
}

/// Represents a connected bot WebSocket client
#[derive(Debug, Clone)]
pub struct BotClient {
    pub bot_id: Uuid,
    pub bot_name: String,
    pub sender: mpsc::UnboundedSender<BotServerEvent>,
}

/// Represents an active call session
#[derive(Debug, Clone)]
pub struct CallSession {
    pub call_id: Uuid,
    pub room_id: String,
    pub caller_id: Uuid,
    pub callee_id: Uuid,
    pub chat_id: Uuid,
    pub call_type: String,
    pub state: CallState,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Call state
#[derive(Debug, Clone, PartialEq)]
pub enum CallState {
    Pending,
    Active,
    Ended,
}

/// Manages WebSocket connections and room subscriptions
#[derive(Debug, Default)]
pub struct WsManager {
    /// Map of user_id to their connected clients (supports multiple connections per user)
    clients: RwLock<HashMap<Uuid, Vec<Client>>>,
    /// Map of chat_id to set of subscribed user_ids
    rooms: RwLock<HashMap<Uuid, HashSet<Uuid>>>,
    /// Map of user_id to set of chat_ids they're subscribed to
    user_rooms: RwLock<HashMap<Uuid, HashSet<Uuid>>>,
    /// Map of call_id to CallSession
    active_calls: RwLock<HashMap<Uuid, CallSession>>,
    /// Map of user_id to their current call_id (if in a call)
    user_calls: RwLock<HashMap<Uuid, Uuid>>,
    /// Map of bot_id to their connected bot clients (supports multiple connections per bot)
    bot_clients: RwLock<HashMap<Uuid, Vec<BotClient>>>,
}

impl WsManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            clients: RwLock::new(HashMap::new()),
            rooms: RwLock::new(HashMap::new()),
            user_rooms: RwLock::new(HashMap::new()),
            active_calls: RwLock::new(HashMap::new()),
            user_calls: RwLock::new(HashMap::new()),
            bot_clients: RwLock::new(HashMap::new()),
        })
    }

    /// Register a new client connection
    pub async fn add_client(&self, client: Client) {
        let user_id = client.user_id;
        let mut clients = self.clients.write().await;
        clients.entry(user_id).or_default().push(client);
        tracing::info!("Client connected: user_id={}", user_id);
    }

    /// Remove a client connection
    pub async fn remove_client(&self, user_id: Uuid, sender: &mpsc::UnboundedSender<ServerEvent>) {
        let mut clients = self.clients.write().await;
        if let Some(user_clients) = clients.get_mut(&user_id) {
            user_clients.retain(|c| !c.sender.same_channel(sender));
            if user_clients.is_empty() {
                clients.remove(&user_id);
            }
        }

        // Clean up room subscriptions if no more connections
        if !clients.contains_key(&user_id) {
            let mut user_rooms = self.user_rooms.write().await;
            if let Some(rooms) = user_rooms.remove(&user_id) {
                let mut rooms_map = self.rooms.write().await;
                for room_id in rooms {
                    if let Some(room_users) = rooms_map.get_mut(&room_id) {
                        room_users.remove(&user_id);
                        if room_users.is_empty() {
                            rooms_map.remove(&room_id);
                        }
                    }
                }
            }
        }

        tracing::info!("Client disconnected: user_id={}", user_id);
    }

    /// Subscribe a user to a chat room
    pub async fn join_room(&self, user_id: Uuid, chat_id: Uuid) {
        let mut rooms = self.rooms.write().await;
        rooms.entry(chat_id).or_default().insert(user_id);

        let mut user_rooms = self.user_rooms.write().await;
        user_rooms.entry(user_id).or_default().insert(chat_id);

        tracing::debug!("User {} joined room {}", user_id, chat_id);
    }

    /// Unsubscribe a user from a chat room
    pub async fn leave_room(&self, user_id: Uuid, chat_id: Uuid) {
        let mut rooms = self.rooms.write().await;
        if let Some(room_users) = rooms.get_mut(&chat_id) {
            room_users.remove(&user_id);
            if room_users.is_empty() {
                rooms.remove(&chat_id);
            }
        }

        let mut user_rooms = self.user_rooms.write().await;
        if let Some(user_chats) = user_rooms.get_mut(&user_id) {
            user_chats.remove(&chat_id);
        }

        tracing::debug!("User {} left room {}", user_id, chat_id);
    }


    /// Send event to a specific user (all their connections)
    pub async fn send_to_user(&self, user_id: Uuid, event: ServerEvent) {
        let clients = self.clients.read().await;
        if let Some(user_clients) = clients.get(&user_id) {
            for client in user_clients {
                if let Err(e) = client.sender.send(event.clone()) {
                    tracing::warn!("Failed to send to user {}: {}", user_id, e);
                }
            }
        }
    }

    /// Send event to all users in a chat room
    pub async fn broadcast_to_room(&self, chat_id: Uuid, event: ServerEvent, exclude_user: Option<Uuid>) {
        let rooms = self.rooms.read().await;
        if let Some(room_users) = rooms.get(&chat_id) {
            let clients = self.clients.read().await;
            for user_id in room_users {
                if exclude_user.map_or(true, |excluded| *user_id != excluded) {
                    if let Some(user_clients) = clients.get(user_id) {
                        for client in user_clients {
                            if let Err(e) = client.sender.send(event.clone()) {
                                tracing::warn!("Failed to broadcast to user {}: {}", user_id, e);
                            }
                        }
                    }
                }
            }
        }
    }

    /// Send event to all users in a chat room (by fetching participants from DB)
    pub async fn broadcast_to_chat_participants(
        &self,
        participant_ids: &[Uuid],
        event: ServerEvent,
        exclude_user: Option<Uuid>,
    ) {
        let clients = self.clients.read().await;
        for user_id in participant_ids {
            if exclude_user.map_or(true, |excluded| *user_id != excluded) {
                if let Some(user_clients) = clients.get(user_id) {
                    for client in user_clients {
                        if let Err(e) = client.sender.send(event.clone()) {
                            tracing::warn!("Failed to send to participant {}: {}", user_id, e);
                        }
                    }
                }
            }
        }
    }

    /// Broadcast user status change to all connected clients
    pub async fn broadcast_user_status(&self, event: ServerEvent) {
        let clients = self.clients.read().await;
        for (_, user_clients) in clients.iter() {
            for client in user_clients {
                if let Err(e) = client.sender.send(event.clone()) {
                    tracing::warn!("Failed to broadcast status: {}", e);
                }
            }
        }
    }

    /// Check if a user is currently online (has active connections)
    pub async fn is_user_online(&self, user_id: Uuid) -> bool {
        let clients = self.clients.read().await;
        clients.contains_key(&user_id)
    }

    /// Get all online user IDs
    pub async fn get_online_users(&self) -> Vec<Uuid> {
        let clients = self.clients.read().await;
        clients.keys().cloned().collect()
    }

    /// Get user name for a connected user
    pub async fn get_user_name(&self, user_id: Uuid) -> Option<String> {
        let clients = self.clients.read().await;
        clients.get(&user_id).and_then(|c| c.first()).map(|c| c.user_name.clone())
    }

    // ==================== Call Management ====================

    /// Create a new call session
    pub async fn create_call_session(
        &self,
        caller_id: Uuid,
        callee_id: Uuid,
        chat_id: Uuid,
        call_type: String,
    ) -> CallSession {
        let call_id = Uuid::new_v4();
        let room_id = format!("call-{}", call_id);
        
        let session = CallSession {
            call_id,
            room_id,
            caller_id,
            callee_id,
            chat_id,
            call_type,
            state: CallState::Pending,
            created_at: chrono::Utc::now(),
        };

        let mut active_calls = self.active_calls.write().await;
        active_calls.insert(call_id, session.clone());

        let mut user_calls = self.user_calls.write().await;
        user_calls.insert(caller_id, call_id);

        tracing::info!("Created call session: call_id={}, caller={}, callee={}", call_id, caller_id, callee_id);
        session
    }

    /// Get a call session by ID
    pub async fn get_call_session(&self, call_id: Uuid) -> Option<CallSession> {
        let active_calls = self.active_calls.read().await;
        active_calls.get(&call_id).cloned()
    }

    /// Accept a call - update state and add callee to user_calls
    pub async fn accept_call(&self, call_id: Uuid) -> Option<CallSession> {
        let mut active_calls = self.active_calls.write().await;
        if let Some(session) = active_calls.get_mut(&call_id) {
            session.state = CallState::Active;
            let callee_id = session.callee_id;
            let session_clone = session.clone();
            drop(active_calls);

            let mut user_calls = self.user_calls.write().await;
            user_calls.insert(callee_id, call_id);

            tracing::info!("Call accepted: call_id={}", call_id);
            Some(session_clone)
        } else {
            None
        }
    }

    /// End a call - remove session and user_calls entries
    pub async fn end_call(&self, call_id: Uuid) -> Option<CallSession> {
        let mut active_calls = self.active_calls.write().await;
        if let Some(mut session) = active_calls.remove(&call_id) {
            session.state = CallState::Ended;
            let caller_id = session.caller_id;
            let callee_id = session.callee_id;
            drop(active_calls);

            let mut user_calls = self.user_calls.write().await;
            user_calls.remove(&caller_id);
            user_calls.remove(&callee_id);

            tracing::info!("Call ended: call_id={}", call_id);
            Some(session)
        } else {
            None
        }
    }

    /// Check if a user is currently in a call
    pub async fn is_user_in_call(&self, user_id: Uuid) -> bool {
        let user_calls = self.user_calls.read().await;
        user_calls.contains_key(&user_id)
    }

    /// Get the current call for a user
    pub async fn get_user_call(&self, user_id: Uuid) -> Option<CallSession> {
        let user_calls = self.user_calls.read().await;
        if let Some(call_id) = user_calls.get(&user_id) {
            let active_calls = self.active_calls.read().await;
            active_calls.get(call_id).cloned()
        } else {
            None
        }
    }

    /// Get user avatar from connected client info (placeholder - would need DB lookup)
    pub async fn get_user_avatar(&self, _user_id: Uuid) -> Option<String> {
        // In a real implementation, this would look up the user's avatar from DB
        // For now, return None as avatar is not stored in Client struct
        None
    }

    // ==================== Bot Client Management ====================
    // Requirements: 9.1, 9.2, 9.3, 9.4, 9.5

    /// Register a new bot client connection
    ///
    /// # Arguments
    /// * `client` - The bot client to register
    ///
    /// # Requirements
    /// - 9.1: Authenticate and establish bot WebSocket connection
    pub async fn add_bot_client(&self, client: BotClient) {
        let bot_id = client.bot_id;
        let mut bot_clients = self.bot_clients.write().await;
        bot_clients.entry(bot_id).or_default().push(client);
        tracing::info!("Bot client connected: bot_id={}", bot_id);
    }

    /// Remove a bot client connection
    ///
    /// # Arguments
    /// * `bot_id` - The bot's UUID
    /// * `sender` - The sender channel to identify the specific connection
    pub async fn remove_bot_client(&self, bot_id: Uuid, sender: &mpsc::UnboundedSender<BotServerEvent>) {
        let mut bot_clients = self.bot_clients.write().await;
        if let Some(clients) = bot_clients.get_mut(&bot_id) {
            clients.retain(|c| !c.sender.same_channel(sender));
            if clients.is_empty() {
                bot_clients.remove(&bot_id);
            }
        }
        tracing::info!("Bot client disconnected: bot_id={}", bot_id);
    }

    /// Check if a bot is currently connected via WebSocket
    ///
    /// # Arguments
    /// * `bot_id` - The bot's UUID
    ///
    /// # Returns
    /// * `bool` - True if the bot has at least one active WebSocket connection
    ///
    /// # Requirements
    /// - 9.4: Check if bot has WebSocket connection (for delivery preference)
    pub async fn is_bot_connected(&self, bot_id: Uuid) -> bool {
        let bot_clients = self.bot_clients.read().await;
        bot_clients.contains_key(&bot_id)
    }

    /// Send event to a specific bot (all their connections)
    ///
    /// # Arguments
    /// * `bot_id` - The bot's UUID
    /// * `event` - The event to send
    ///
    /// # Returns
    /// * `bool` - True if the event was sent to at least one connection
    ///
    /// # Requirements
    /// - 9.2: Push message updates directly to bot's WebSocket
    /// - 9.3: Deliver updates via WebSocket when bot is subscribed to chat
    pub async fn send_to_bot(&self, bot_id: Uuid, event: BotServerEvent) -> bool {
        let bot_clients = self.bot_clients.read().await;
        if let Some(clients) = bot_clients.get(&bot_id) {
            let mut sent = false;
            for client in clients {
                if client.sender.send(event.clone()).is_ok() {
                    sent = true;
                } else {
                    tracing::warn!("Failed to send to bot {}", bot_id);
                }
            }
            sent
        } else {
            false
        }
    }

    /// Get all connected bot IDs
    pub async fn get_connected_bots(&self) -> Vec<Uuid> {
        let bot_clients = self.bot_clients.read().await;
        bot_clients.keys().cloned().collect()
    }
}
