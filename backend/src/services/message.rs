use crate::{
    db::Database,
    error::{AppError, AppResult},
    models::{
        Attachment, AttachmentResponse, Message, MessageResponse, Reaction, ReactionResponse,
        ReadByResponse, ReadReceipt, ReplyToResponse,
    },
    services::ChatService,
};
use uuid::Uuid;

pub struct MessageService;

impl MessageService {
    pub async fn get_messages(
        db: &Database,
        chat_id: Uuid,
        user_id: Uuid,
        limit: i64,
        before: Option<Uuid>,
    ) -> AppResult<(Vec<MessageResponse>, bool)> {
        // Check access
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        let messages: Vec<Message> = if let Some(before_id) = before {
            sqlx::query_as(
                r#"
                SELECT * FROM messages
                WHERE chat_id = $1 AND created_at < (SELECT created_at FROM messages WHERE id = $2)
                ORDER BY created_at DESC
                LIMIT $3
                "#,
            )
            .bind(chat_id)
            .bind(before_id)
            .bind(limit + 1)
            .fetch_all(&db.pool)
            .await?
        } else {
            sqlx::query_as(
                "SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2",
            )
            .bind(chat_id)
            .bind(limit + 1)
            .fetch_all(&db.pool)
            .await?
        };

        let has_more = messages.len() > limit as usize;
        let messages: Vec<Message> = messages.into_iter().take(limit as usize).collect();

        let mut responses = Vec::new();
        for msg in messages {
            let response = Self::build_message_response(db, msg).await?;
            responses.push(response);
        }

        // Reverse to get chronological order
        responses.reverse();

        Ok((responses, has_more))
    }

    pub async fn send_message(
        db: &Database,
        chat_id: Uuid,
        sender_id: Uuid,
        text: Option<String>,
        attachments: Vec<AttachmentInput>,
        reply_to: Option<ReplyToInput>,
    ) -> AppResult<MessageResponse> {
        // Check access
        if !ChatService::is_participant(db, chat_id, sender_id).await? {
            return Err(AppError::AccessDenied);
        }

        // Validate message
        if text.as_ref().map(|t| t.trim().is_empty()).unwrap_or(true) && attachments.is_empty() {
            return Err(AppError::EmptyMessage);
        }

        let reply_to_id = reply_to.as_ref().map(|r| r.id);

        // Validate reply_to message belongs to the same chat to prevent cross-chat leakage.
        if let Some(reply_id) = reply_to_id {
            let exists: Option<(Uuid,)> =
                sqlx::query_as("SELECT id FROM messages WHERE id = $1 AND chat_id = $2")
                    .bind(reply_id)
                    .bind(chat_id)
                    .fetch_optional(&db.pool)
                    .await?;

            if exists.is_none() {
                return Err(AppError::BadRequest(
                    "Invalid replyTo: message not found in this chat".to_string(),
                ));
            }
        }

        // Create message with sender_type = 'user'
        let message: Message = sqlx::query_as(
            r#"
            INSERT INTO messages (chat_id, sender_id, sender_type, text, reply_to_id, delivery_status)
            VALUES ($1, $2, 'user', $3, $4, 'sent')
            RETURNING *
            "#,
        )
        .bind(chat_id)
        .bind(sender_id)
        .bind(&text)
        .bind(reply_to_id)
        .fetch_one(&db.pool)
        .await?;

        // Add attachments
        for att in attachments {
            sqlx::query(
                r#"
                INSERT INTO attachments (message_id, type, name, size, url, mime_type)
                VALUES ($1, $2, $3, $4, $5, $6)
                "#,
            )
            .bind(message.id)
            .bind(&att.attachment_type)
            .bind(&att.name)
            .bind(att.size)
            .bind(&att.url)
            .bind(&att.mime_type)
            .execute(&db.pool)
            .await?;
        }

        // Update chat timestamp
        sqlx::query("UPDATE chats SET updated_at = NOW() WHERE id = $1")
            .bind(chat_id)
            .execute(&db.pool)
            .await?;

        // Increment unread count for other participants
        sqlx::query(
            r#"
            UPDATE chat_participants
            SET unread_count = unread_count + 1
            WHERE chat_id = $1 AND user_id != $2
            "#,
        )
        .bind(chat_id)
        .bind(sender_id)
        .execute(&db.pool)
        .await?;

        Self::build_message_response(db, message).await
    }

    /// Send a message from a bot.
    ///
    /// This function creates a message with sender_type = 'bot'.
    /// Unlike send_message, it doesn't check if the sender is a chat participant
    /// because bots use their own subscription system (bot_chats table).
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `chat_id` - The chat to send the message to
    /// * `bot_id` - The bot's UUID
    /// * `text` - The message text
    /// * `reply_to_id` - Optional message ID to reply to
    ///
    /// # Returns
    /// * `AppResult<MessageResponse>` - The created message
    ///
    /// # Requirements
    /// - 7.3: Mark the sender as Bot(bot_id)
    pub async fn send_bot_message(
        db: &Database,
        chat_id: Uuid,
        bot_id: Uuid,
        text: String,
        reply_to_id: Option<Uuid>,
    ) -> AppResult<MessageResponse> {
        // Validate message
        if text.trim().is_empty() {
            return Err(AppError::EmptyMessage);
        }

        // Create message with sender_type = 'bot'
        let message: Message = sqlx::query_as(
            r#"
            INSERT INTO messages (chat_id, sender_id, sender_type, text, reply_to_id, delivery_status)
            VALUES ($1, $2, 'bot', $3, $4, 'sent')
            RETURNING *
            "#,
        )
        .bind(chat_id)
        .bind(bot_id)
        .bind(&text)
        .bind(reply_to_id)
        .fetch_one(&db.pool)
        .await?;

        // Update chat timestamp
        sqlx::query("UPDATE chats SET updated_at = NOW() WHERE id = $1")
            .bind(chat_id)
            .execute(&db.pool)
            .await?;

        // Increment unread count for all participants (bots don't have unread counts)
        sqlx::query(
            r#"
            UPDATE chat_participants
            SET unread_count = unread_count + 1
            WHERE chat_id = $1
            "#,
        )
        .bind(chat_id)
        .execute(&db.pool)
        .await?;

        Self::build_message_response(db, message).await
    }

    pub async fn edit_message(
        db: &Database,
        chat_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
        text: &str,
    ) -> AppResult<MessageResponse> {
        // Check access
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        let message: Message =
            sqlx::query_as("SELECT * FROM messages WHERE id = $1 AND chat_id = $2")
                .bind(message_id)
                .bind(chat_id)
                .fetch_optional(&db.pool)
                .await?
                .ok_or(AppError::MessageNotFound)?;

        if message.sender_id != user_id {
            return Err(AppError::NotMessageOwner);
        }

        let updated: Message = sqlx::query_as(
            r#"
            UPDATE messages SET text = $1, is_edited = true, updated_at = NOW()
            WHERE id = $2
            RETURNING *
            "#,
        )
        .bind(text)
        .bind(message_id)
        .fetch_one(&db.pool)
        .await?;

        Self::build_message_response(db, updated).await
    }

    pub async fn delete_message(
        db: &Database,
        chat_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
    ) -> AppResult<()> {
        // Check access
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        let message: Message =
            sqlx::query_as("SELECT * FROM messages WHERE id = $1 AND chat_id = $2")
                .bind(message_id)
                .bind(chat_id)
                .fetch_optional(&db.pool)
                .await?
                .ok_or(AppError::MessageNotFound)?;

        if message.sender_id != user_id {
            return Err(AppError::NotMessageOwner);
        }

        sqlx::query("DELETE FROM messages WHERE id = $1")
            .bind(message_id)
            .execute(&db.pool)
            .await?;

        Ok(())
    }

    pub async fn clear_chat_messages(db: &Database, chat_id: Uuid, user_id: Uuid) -> AppResult<()> {
        // Check access - user must be a participant
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        // Delete all messages in the chat
        sqlx::query("DELETE FROM messages WHERE chat_id = $1")
            .bind(chat_id)
            .execute(&db.pool)
            .await?;

        // Reset unread count for all participants
        sqlx::query("UPDATE chat_participants SET unread_count = 0 WHERE chat_id = $1")
            .bind(chat_id)
            .execute(&db.pool)
            .await?;

        Ok(())
    }

    pub async fn toggle_reaction(
        db: &Database,
        chat_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> AppResult<MessageResponse> {
        // Check access
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        let message: Message =
            sqlx::query_as("SELECT * FROM messages WHERE id = $1 AND chat_id = $2")
                .bind(message_id)
                .bind(chat_id)
                .fetch_optional(&db.pool)
                .await?
                .ok_or(AppError::MessageNotFound)?;

        // Check if reaction exists
        let existing: Option<Reaction> = sqlx::query_as(
            "SELECT * FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
        )
        .bind(message_id)
        .bind(user_id)
        .bind(emoji)
        .fetch_optional(&db.pool)
        .await?;

        if existing.is_some() {
            // Remove reaction
            sqlx::query(
                "DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
            )
            .bind(message_id)
            .bind(user_id)
            .bind(emoji)
            .execute(&db.pool)
            .await?;
        } else {
            // Add reaction
            sqlx::query("INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)")
                .bind(message_id)
                .bind(user_id)
                .bind(emoji)
                .execute(&db.pool)
                .await?;
        }

        Self::build_message_response(db, message).await
    }

    pub async fn pin_message(
        db: &Database,
        chat_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
    ) -> AppResult<MessageResponse> {
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        let message: Message = sqlx::query_as(
            "UPDATE messages SET is_pinned = true WHERE id = $1 AND chat_id = $2 RETURNING *",
        )
        .bind(message_id)
        .bind(chat_id)
        .fetch_optional(&db.pool)
        .await?
        .ok_or(AppError::MessageNotFound)?;

        Self::build_message_response(db, message).await
    }

    pub async fn unpin_message(
        db: &Database,
        chat_id: Uuid,
        message_id: Uuid,
        user_id: Uuid,
    ) -> AppResult<MessageResponse> {
        if !ChatService::is_participant(db, chat_id, user_id).await? {
            return Err(AppError::AccessDenied);
        }

        let message: Message = sqlx::query_as(
            "UPDATE messages SET is_pinned = false WHERE id = $1 AND chat_id = $2 RETURNING *",
        )
        .bind(message_id)
        .bind(chat_id)
        .fetch_optional(&db.pool)
        .await?
        .ok_or(AppError::MessageNotFound)?;

        Self::build_message_response(db, message).await
    }

    async fn build_message_response(db: &Database, message: Message) -> AppResult<MessageResponse> {
        let mut response = Self::build_message_response_public(db, message).await?;
        response.inline_keyboard = None;
        Ok(response)
    }

    pub async fn build_message_response_public(
        db: &Database,
        message: Message,
    ) -> AppResult<MessageResponse> {
        // Get attachments
        let attachments: Vec<Attachment> =
            sqlx::query_as("SELECT * FROM attachments WHERE message_id = $1")
                .bind(message.id)
                .fetch_all(&db.pool)
                .await?;

        // Get reactions
        let reactions: Vec<Reaction> =
            sqlx::query_as("SELECT * FROM reactions WHERE message_id = $1")
                .bind(message.id)
                .fetch_all(&db.pool)
                .await?;

        // Get read receipts
        let read_receipts: Vec<ReadReceipt> =
            sqlx::query_as("SELECT * FROM read_receipts WHERE message_id = $1")
                .bind(message.id)
                .fetch_all(&db.pool)
                .await?;

        // Get reply_to info (restricted to same chat)
        let reply_to = if let Some(reply_id) = message.reply_to_id {
            let reply_msg: Option<Message> =
                sqlx::query_as("SELECT * FROM messages WHERE id = $1 AND chat_id = $2")
                    .bind(reply_id)
                    .bind(message.chat_id)
                    .fetch_optional(&db.pool)
                    .await?;

            if let Some(rm) = reply_msg {
                let sender_name: String = if rm.sender_type.as_deref() == Some("bot") {
                    let res: Option<(String,)> =
                        sqlx::query_as("SELECT name FROM bots WHERE id = $1")
                            .bind(rm.sender_id)
                            .fetch_optional(&db.pool)
                            .await?;
                    res.map(|r| r.0)
                        .unwrap_or_else(|| "Unknown Bot".to_string())
                } else {
                    let res: Option<(String,)> =
                        sqlx::query_as("SELECT name FROM users WHERE id = $1")
                            .bind(rm.sender_id)
                            .fetch_optional(&db.pool)
                            .await?;
                    res.map(|r| r.0)
                        .unwrap_or_else(|| "Unknown User".to_string())
                };

                Some(ReplyToResponse {
                    id: rm.id,
                    text: rm.text,
                    sender_id: rm.sender_id,
                    sender_name,
                })
            } else {
                None
            }
        } else {
            None
        };

        Ok(MessageResponse {
            id: message.id,
            chat_id: message.chat_id,
            sender_id: message.sender_id,
            sender_type: message
                .sender_type
                .clone()
                .unwrap_or_else(|| "user".to_string()),
            text: message.text,
            timestamp: message.created_at,
            is_read: message.is_read,
            is_edited: message.is_edited,
            is_pinned: message.is_pinned,
            reactions: reactions
                .into_iter()
                .map(|r| ReactionResponse {
                    emoji: r.emoji,
                    user_id: r.user_id,
                })
                .collect(),
            attachments: attachments
                .into_iter()
                .map(|a| AttachmentResponse {
                    id: a.id,
                    attachment_type: a.attachment_type,
                    name: a.name,
                    size: a.size,
                    url: a.url,
                    mime_type: a.mime_type,
                })
                .collect(),
            reply_to,
            delivery_status: message.delivery_status,
            read_by: read_receipts
                .into_iter()
                .map(|r| ReadByResponse {
                    user_id: r.user_id,
                    read_at: r.read_at,
                })
                .collect(),
            inline_keyboard: None,
        })
    }
}

#[derive(Debug)]
pub struct AttachmentInput {
    pub attachment_type: String,
    pub name: String,
    pub size: i64,
    pub url: String,
    pub mime_type: Option<String>,
}

#[derive(Debug)]
pub struct ReplyToInput {
    pub id: Uuid,
}
