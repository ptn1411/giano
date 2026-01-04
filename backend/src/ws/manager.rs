use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use super::events::ServerEvent;

/// Represents a connected WebSocket client
#[derive(Debug, Clone)]
pub struct Client {
    pub user_id: Uuid,
    pub user_name: String,
    pub sender: mpsc::UnboundedSender<ServerEvent>,
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
}

impl WsManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            clients: RwLock::new(HashMap::new()),
            rooms: RwLock::new(HashMap::new()),
            user_rooms: RwLock::new(HashMap::new()),
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
}
