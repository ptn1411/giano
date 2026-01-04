use crate::{
    db::Database,
    error::{AppError, AppResult},
    models::{Chat, ChatDetailResponse, ChatParticipant, ChatResponse, Message, MessageResponse},
    services::MessageService,
};
use uuid::Uuid;

pub struct ChatService;

impl ChatService {
    pub async fn get_user_chats(
        db: &Database,
        user_id: Uuid,
        search: Option<&str>,
    ) -> AppResult<Vec<ChatResponse>> {
        let chats: Vec<Chat> = if let Some(query) = search {
            let pattern = format!("%{}%", query);
            sqlx::query_as(
                r#"
                SELECT DISTINCT c.* FROM chats c
                JOIN chat_participants cp ON c.id = cp.chat_id
                LEFT JOIN messages m ON c.id = m.chat_id
                WHERE cp.user_id = $1 AND (c.name ILIKE $2 OR m.text ILIKE $2)
                ORDER BY c.updated_at DESC
                "#,
            )
            .bind(user_id)
            .bind(&pattern)
            .fetch_all(&db.pool)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT c.* FROM chats c
                JOIN chat_participants cp ON c.id = cp.chat_id
                WHERE cp.user_id = $1
                ORDER BY c.updated_at DESC
                "#,
            )
            .bind(user_id)
            .fetch_all(&db.pool)
            .await?
        };

        let mut responses = Vec::new();
        for chat in chats {
            let response = Self::build_chat_response(db, &chat, user_id).await?;
            responses.push(response);
        }

        Ok(responses)
    }

    pub async fn get_chat_by_id(
        db: &Database,
        chat_id: Uuid,
        user_id: Uuid,
    ) -> AppResult<ChatDetailResponse> {
        // Check if user is participant
        let participant: Option<ChatParticipant> = sqlx::query_as(
            "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
        )
        .bind(chat_id)
        .bind(user_id)
        .fetch_optional(&db.pool)
        .await?;

        if participant.is_none() {
            return Err(AppError::AccessDenied);
        }

        let chat: Chat = sqlx::query_as("SELECT * FROM chats WHERE id = $1")
            .bind(chat_id)
            .fetch_optional(&db.pool)
            .await?
            .ok_or(AppError::ChatNotFound)?;

        let participants: Vec<Uuid> = sqlx::query_scalar(
            "SELECT user_id FROM chat_participants WHERE chat_id = $1",
        )
        .bind(chat_id)
        .fetch_all(&db.pool)
        .await?;

        let is_bot = chat.chat_type == "bot";
        let name = Self::get_chat_name(db, &chat, user_id).await?;

        Ok(ChatDetailResponse {
            id: chat.id,
            chat_type: chat.chat_type,
            name,
            avatar: chat.avatar,
            participants,
            unread_count: participant.unwrap().unread_count,
            is_typing: false,
            is_bot,
        })
    }

    pub async fn create_group(
        db: &Database,
        creator_id: Uuid,
        name: &str,
        participant_ids: Vec<Uuid>,
    ) -> AppResult<ChatDetailResponse> {
        if name.trim().is_empty() {
            return Err(AppError::Internal(anyhow::anyhow!("Missing name")));
        }

        if participant_ids.is_empty() {
            return Err(AppError::InvalidParticipants);
        }

        let avatar = format!(
            "https://api.dicebear.com/7.x/shapes/svg?seed={}",
            name.replace(' ', "")
        );

        // Create chat
        let chat: Chat = sqlx::query_as(
            r#"
            INSERT INTO chats (type, name, avatar, created_by)
            VALUES ('group', $1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(name)
        .bind(&avatar)
        .bind(creator_id)
        .fetch_one(&db.pool)
        .await?;

        // Add creator as admin
        sqlx::query(
            "INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'admin')",
        )
        .bind(chat.id)
        .bind(creator_id)
        .execute(&db.pool)
        .await?;

        // Add other participants
        for pid in &participant_ids {
            sqlx::query(
                "INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'member')",
            )
            .bind(chat.id)
            .bind(pid)
            .execute(&db.pool)
            .await?;
        }

        let mut all_participants = vec![creator_id];
        all_participants.extend(participant_ids);

        Ok(ChatDetailResponse {
            id: chat.id,
            chat_type: "group".to_string(),
            name: name.to_string(),
            avatar: Some(avatar),
            participants: all_participants,
            unread_count: 0,
            is_typing: false,
            is_bot: false,
        })
    }

    pub async fn mark_as_read(db: &Database, chat_id: Uuid, user_id: Uuid) -> AppResult<()> {
        sqlx::query(
            "UPDATE chat_participants SET unread_count = 0 WHERE chat_id = $1 AND user_id = $2",
        )
        .bind(chat_id)
        .bind(user_id)
        .execute(&db.pool)
        .await?;

        // Mark messages as read
        sqlx::query(
            r#"
            UPDATE messages SET is_read = true, delivery_status = 'read'
            WHERE chat_id = $1 AND sender_id != $2 AND is_read = false
            "#,
        )
        .bind(chat_id)
        .bind(user_id)
        .execute(&db.pool)
        .await?;

        Ok(())
    }

    /// Create a private chat or return existing one
    pub async fn create_or_get_private_chat(
        db: &Database,
        user_id: Uuid,
        other_user_id: Uuid,
    ) -> AppResult<ChatDetailResponse> {
        // Check if private chat already exists between these two users
        let existing_chat: Option<Chat> = sqlx::query_as(
            r#"
            SELECT c.* FROM chats c
            WHERE c.type = 'private'
            AND EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = c.id AND user_id = $1)
            AND EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = c.id AND user_id = $2)
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .bind(other_user_id)
        .fetch_optional(&db.pool)
        .await?;

        if let Some(chat) = existing_chat {
            return Self::get_chat_by_id(db, chat.id, user_id).await;
        }

        // Get other user's info for avatar
        let other_user: (String, Option<String>) = sqlx::query_as(
            "SELECT name, avatar FROM users WHERE id = $1"
        )
        .bind(other_user_id)
        .fetch_optional(&db.pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

        // Create new private chat
        let chat: Chat = sqlx::query_as(
            r#"
            INSERT INTO chats (type, avatar, created_by)
            VALUES ('private', $1, $2)
            RETURNING *
            "#,
        )
        .bind(&other_user.1)
        .bind(user_id)
        .fetch_one(&db.pool)
        .await?;

        // Add both users as participants
        sqlx::query(
            "INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'member')",
        )
        .bind(chat.id)
        .bind(user_id)
        .execute(&db.pool)
        .await?;

        sqlx::query(
            "INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'member')",
        )
        .bind(chat.id)
        .bind(other_user_id)
        .execute(&db.pool)
        .await?;

        Ok(ChatDetailResponse {
            id: chat.id,
            chat_type: "private".to_string(),
            name: other_user.0,
            avatar: other_user.1,
            participants: vec![user_id, other_user_id],
            unread_count: 0,
            is_typing: false,
            is_bot: false,
        })
    }

    pub async fn is_participant(db: &Database, chat_id: Uuid, user_id: Uuid) -> AppResult<bool> {
        let exists: Option<(i32,)> = sqlx::query_as(
            "SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
        )
        .bind(chat_id)
        .bind(user_id)
        .fetch_optional(&db.pool)
        .await?;

        Ok(exists.is_some())
    }

    /// Delete a chat (only for private chats or group admins)
    pub async fn delete_chat(db: &Database, chat_id: Uuid, user_id: Uuid) -> AppResult<()> {
        // Check if user is participant
        if !Self::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        // Get chat info
        let chat: Chat = sqlx::query_as("SELECT * FROM chats WHERE id = $1")
            .bind(chat_id)
            .fetch_optional(&db.pool)
            .await?
            .ok_or(AppError::ChatNotFound)?;

        // For group chats, check if user is admin
        if chat.chat_type == "group" {
            let participant: ChatParticipant = sqlx::query_as(
                "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
            )
            .bind(chat_id)
            .bind(user_id)
            .fetch_one(&db.pool)
            .await?;

            if participant.role != "admin" {
                return Err(AppError::AccessDenied);
            }
        }

        // Delete chat (cascade will delete messages, participants, etc.)
        sqlx::query("DELETE FROM chats WHERE id = $1")
            .bind(chat_id)
            .execute(&db.pool)
            .await?;

        Ok(())
    }

    /// Get all participant IDs for a chat
    pub async fn get_participant_ids(db: &Database, chat_id: Uuid) -> AppResult<Vec<Uuid>> {
        let participants: Vec<Uuid> = sqlx::query_scalar(
            "SELECT user_id FROM chat_participants WHERE chat_id = $1",
        )
        .bind(chat_id)
        .fetch_all(&db.pool)
        .await?;

        Ok(participants)
    }

    async fn build_chat_response(
        db: &Database,
        chat: &Chat,
        user_id: Uuid,
    ) -> AppResult<ChatResponse> {
        let participants: Vec<Uuid> = sqlx::query_scalar(
            "SELECT user_id FROM chat_participants WHERE chat_id = $1",
        )
        .bind(chat.id)
        .fetch_all(&db.pool)
        .await?;

        let participant: ChatParticipant = sqlx::query_as(
            "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
        )
        .bind(chat.id)
        .bind(user_id)
        .fetch_one(&db.pool)
        .await?;

        let name = Self::get_chat_name(db, chat, user_id).await?;
        let is_bot = chat.chat_type == "bot";

        // Get last message
        let last_message: Option<MessageResponse> = {
            let msg: Option<Message> = sqlx::query_as(
                "SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1"
            )
            .bind(chat.id)
            .fetch_optional(&db.pool)
            .await?;

            if let Some(m) = msg {
                Some(MessageService::build_message_response_public(db, m).await?)
            } else {
                None
            }
        };

        Ok(ChatResponse {
            id: chat.id,
            chat_type: chat.chat_type.clone(),
            name,
            avatar: chat.avatar.clone(),
            participants,
            last_message,
            unread_count: participant.unread_count,
            is_typing: false,
            typing_user: None,
            is_bot,
        })
    }

    async fn get_chat_name(db: &Database, chat: &Chat, user_id: Uuid) -> AppResult<String> {
        if let Some(name) = &chat.name {
            return Ok(name.clone());
        }

        // For private chats, get the other user's name
        if chat.chat_type == "private" {
            let other_user: Option<(String,)> = sqlx::query_as(
                r#"
                SELECT u.name FROM users u
                JOIN chat_participants cp ON u.id = cp.user_id
                WHERE cp.chat_id = $1 AND cp.user_id != $2
                LIMIT 1
                "#,
            )
            .bind(chat.id)
            .bind(user_id)
            .fetch_optional(&db.pool)
            .await?;

            if let Some((name,)) = other_user {
                return Ok(name);
            }
        }

        Ok("Unknown".to_string())
    }
}
