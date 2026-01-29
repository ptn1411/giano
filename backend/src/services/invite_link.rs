use crate::error::AppError;
use crate::models::{
    CreateInviteLinkRequest, InviteLink, InviteLinkResponse, UseInviteLinkResponse,
};
use chrono::{Duration, Utc};
use rand::Rng;
use sqlx::{PgPool, Row};
use uuid::Uuid;

const INVITE_CODE_LENGTH: usize = 12;
const INVITE_CODE_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/// Generate a random invite code
fn generate_invite_code() -> String {
    let mut rng = rand::thread_rng();
    (0..INVITE_CODE_LENGTH)
        .map(|_| {
            let idx = rng.gen_range(0..INVITE_CODE_CHARS.len());
            INVITE_CODE_CHARS[idx] as char
        })
        .collect()
}

/// Create a new invite link
pub async fn create_invite_link(
    pool: &PgPool,
    user_id: Uuid,
    request: CreateInviteLinkRequest,
) -> Result<InviteLinkResponse, AppError> {
    // Validate request
    if request.link_type != "group" && request.link_type != "direct" {
        return Err(AppError::BadRequest(
            "Invalid link type. Must be 'group' or 'direct'".to_string(),
        ));
    }

    // For group links, chat_id is required
    if request.link_type == "group" && request.chat_id.is_none() {
        return Err(AppError::BadRequest(
            "chat_id is required for group invite links".to_string(),
        ));
    }

    // For group links, verify user is admin or creator
    if let Some(chat_id) = request.chat_id {
        let row = sqlx::query("SELECT role FROM chat_participants WHERE chat_id = $1 AND user_id = $2")
            .bind(chat_id)
            .bind(user_id)
            .fetch_optional(pool)
            .await?;

        match row {
            Some(r) => {
                let role: Option<String> = r.get("role");
                if role != Some("admin".to_string()) && role != Some("creator".to_string()) {
                    return Err(AppError::Forbidden(
                        "Only admins can create invite links".to_string(),
                    ));
                }
            }
            None => {
                return Err(AppError::NotFound(
                    "You are not a member of this chat".to_string(),
                ))
            }
        }
    }

    // Generate unique code
    let code = loop {
        let candidate = generate_invite_code();
        let exists = sqlx::query("SELECT id FROM invite_links WHERE code = $1")
            .bind(&candidate)
            .fetch_optional(pool)
            .await?;
        if exists.is_none() {
            break candidate;
        }
    };

    // Calculate expiration
    let expires_at = request
        .expires_in
        .map(|seconds| Utc::now() + Duration::seconds(seconds));

    // Insert invite link
    let invite_link: InviteLink = sqlx::query_as(
        r#"
        INSERT INTO invite_links (code, type, chat_id, created_by, expires_at, max_uses)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, code, type as link_type, chat_id, created_by, expires_at, max_uses, current_uses, is_active, created_at, updated_at
        "#,
    )
    .bind(&code)
    .bind(&request.link_type)
    .bind(request.chat_id)
    .bind(user_id)
    .bind(expires_at)
    .bind(request.max_uses)
    .fetch_one(pool)
    .await?;

    // Get creator name
    let creator_row = sqlx::query("SELECT name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    let creator_name: String = creator_row.get("name");

    // Get chat name if applicable
    let chat_name: Option<String> = if let Some(chat_id) = request.chat_id {
        let row = sqlx::query("SELECT name FROM chats WHERE id = $1")
            .bind(chat_id)
            .fetch_optional(pool)
            .await?;
        row.and_then(|r| r.get("name"))
    } else {
        None
    };

    Ok(InviteLinkResponse {
        id: invite_link.id,
        code: invite_link.code.clone(),
        link_type: invite_link.link_type,
        chat_id: invite_link.chat_id,
        chat_name,
        created_by: invite_link.created_by,
        creator_name,
        expires_at: invite_link.expires_at,
        max_uses: invite_link.max_uses,
        current_uses: invite_link.current_uses,
        is_active: invite_link.is_active,
        url: format!("/invite/{}", invite_link.code),
        created_at: invite_link.created_at,
    })
}

/// Get invite link by code
pub async fn get_invite_link_by_code(
    pool: &PgPool,
    code: &str,
) -> Result<InviteLinkResponse, AppError> {
    let invite_link: InviteLink = sqlx::query_as(
        r#"
        SELECT id, code, type as link_type, chat_id, created_by, expires_at, max_uses, current_uses, is_active, created_at, updated_at
        FROM invite_links
        WHERE code = $1
        "#,
    )
    .bind(code)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Invite link not found".to_string()))?;

    // Get creator name
    let creator_row = sqlx::query("SELECT name FROM users WHERE id = $1")
        .bind(invite_link.created_by)
        .fetch_one(pool)
        .await?;
    let creator_name: String = creator_row.get("name");

    // Get chat name if applicable
    let chat_name: Option<String> = if let Some(chat_id) = invite_link.chat_id {
        let row = sqlx::query("SELECT name FROM chats WHERE id = $1")
            .bind(chat_id)
            .fetch_optional(pool)
            .await?;
        row.and_then(|r| r.get("name"))
    } else {
        None
    };

    Ok(InviteLinkResponse {
        id: invite_link.id,
        code: invite_link.code.clone(),
        link_type: invite_link.link_type,
        chat_id: invite_link.chat_id,
        chat_name,
        created_by: invite_link.created_by,
        creator_name,
        expires_at: invite_link.expires_at,
        max_uses: invite_link.max_uses,
        current_uses: invite_link.current_uses,
        is_active: invite_link.is_active,
        url: format!("/invite/{}", invite_link.code),
        created_at: invite_link.created_at,
    })
}


/// Use an invite link
pub async fn use_invite_link(
    pool: &PgPool,
    user_id: Uuid,
    code: &str,
) -> Result<UseInviteLinkResponse, AppError> {
    // Start transaction
    let mut tx = pool.begin().await?;

    // Get invite link with lock
    let invite_link: InviteLink = sqlx::query_as(
        r#"
        SELECT id, code, type as link_type, chat_id, created_by, expires_at, max_uses, current_uses, is_active, created_at, updated_at
        FROM invite_links
        WHERE code = $1
        FOR UPDATE
        "#,
    )
    .bind(code)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Invite link not found".to_string()))?;

    // Validate invite link
    if !invite_link.is_active {
        return Err(AppError::BadRequest("Invite link is inactive".to_string()));
    }

    if let Some(expires_at) = invite_link.expires_at {
        if expires_at < Utc::now() {
            return Err(AppError::BadRequest("Invite link has expired".to_string()));
        }
    }

    if let Some(max_uses) = invite_link.max_uses {
        if invite_link.current_uses >= max_uses {
            return Err(AppError::BadRequest(
                "Invite link has reached maximum uses".to_string(),
            ));
        }
    }

    // Check if user already used this link
    let already_used = sqlx::query("SELECT id FROM invite_link_uses WHERE invite_link_id = $1 AND user_id = $2")
        .bind(invite_link.id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

    if already_used.is_some() {
        return Err(AppError::BadRequest(
            "You have already used this invite link".to_string(),
        ));
    }

    let chat_id = match invite_link.link_type.as_str() {
        "group" => {
            let chat_id = invite_link
                .chat_id
                .ok_or_else(|| AppError::Internal(anyhow::Error::msg("Group link missing chat_id")))?;

            // Check if user is already a participant
            let existing = sqlx::query("SELECT id FROM chat_participants WHERE chat_id = $1 AND user_id = $2")
                .bind(chat_id)
                .bind(user_id)
                .fetch_optional(&mut *tx)
                .await?;

            if existing.is_none() {
                // Add user to group (use ON CONFLICT to handle race conditions)
                sqlx::query(
                    r#"
                    INSERT INTO chat_participants (chat_id, user_id, role) 
                    VALUES ($1, $2, 'member')
                    ON CONFLICT (chat_id, user_id) DO NOTHING
                    "#
                )
                .bind(chat_id)
                .bind(user_id)
                .execute(&mut *tx)
                .await?;
            }

            chat_id
        }
        "direct" => {
            // Create or get existing direct chat with creator
            let creator_id = invite_link.created_by;

            // Check if direct chat already exists
            let existing_chat = sqlx::query(
                r#"
                SELECT c.id
                FROM chats c
                INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id
                INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id
                WHERE c.type = 'direct'
                AND cp1.user_id = $1
                AND cp2.user_id = $2
                "#,
            )
            .bind(user_id)
            .bind(creator_id)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(chat) = existing_chat {
                chat.get("id")
            } else {
                // Create new direct chat
                let chat_row = sqlx::query("INSERT INTO chats (type, created_by) VALUES ('direct', $1) RETURNING id")
                    .bind(user_id)
                    .fetch_one(&mut *tx)
                    .await?;
                let new_chat_id: Uuid = chat_row.get("id");

                // Add both users as participants (use ON CONFLICT to handle duplicates)
                sqlx::query(
                    r#"
                    INSERT INTO chat_participants (chat_id, user_id, role) 
                    VALUES ($1, $2, 'member'), ($1, $3, 'member')
                    ON CONFLICT (chat_id, user_id) DO NOTHING
                    "#
                )
                .bind(new_chat_id)
                .bind(user_id)
                .bind(creator_id)
                .execute(&mut *tx)
                .await?;

                new_chat_id
            }
        }
        _ => {
            return Err(AppError::Internal(anyhow::Error::msg(
                "Invalid invite link type"
            )))
        }
    };

    // Record usage
    sqlx::query("INSERT INTO invite_link_uses (invite_link_id, user_id) VALUES ($1, $2)")
        .bind(invite_link.id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    // Increment usage count
    sqlx::query("UPDATE invite_links SET current_uses = current_uses + 1, updated_at = NOW() WHERE id = $1")
        .bind(invite_link.id)
        .execute(&mut *tx)
        .await?;

    // Get chat details
    let chat_row = sqlx::query("SELECT type, name FROM chats WHERE id = $1")
        .bind(chat_id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(UseInviteLinkResponse {
        chat_id,
        chat_name: chat_row.get::<Option<String>, _>("name").unwrap_or_else(|| "Direct Chat".to_string()),
        chat_type: chat_row.get("type"),
        joined: true,
    })
}

/// Get all invite links created by a user
pub async fn get_user_invite_links(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<InviteLinkResponse>, AppError> {
    let links: Vec<InviteLink> = sqlx::query_as(
        r#"
        SELECT id, code, type as link_type, chat_id, created_by, expires_at, max_uses, current_uses, is_active, created_at, updated_at
        FROM invite_links
        WHERE created_by = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let creator_row = sqlx::query("SELECT name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    let creator_name: String = creator_row.get("name");

    let mut responses = Vec::new();
    for link in links {
        let chat_name: Option<String> = if let Some(chat_id) = link.chat_id {
            let row = sqlx::query("SELECT name FROM chats WHERE id = $1")
                .bind(chat_id)
                .fetch_optional(pool)
                .await?;
            row.and_then(|r| r.get("name"))
        } else {
            None
        };

        responses.push(InviteLinkResponse {
            id: link.id,
            code: link.code.clone(),
            link_type: link.link_type.clone(),
            chat_id: link.chat_id,
            chat_name,
            created_by: link.created_by,
            creator_name: creator_name.clone(),
            expires_at: link.expires_at,
            max_uses: link.max_uses,
            current_uses: link.current_uses,
            is_active: link.is_active,
            url: format!("/invite/{}", link.code),
            created_at: link.created_at,
        });
    }

    Ok(responses)
}

/// Revoke an invite link
pub async fn revoke_invite_link(
    pool: &PgPool,
    user_id: Uuid,
    link_id: Uuid,
) -> Result<(), AppError> {
    let result = sqlx::query("UPDATE invite_links SET is_active = false, updated_at = NOW() WHERE id = $1 AND created_by = $2")
        .bind(link_id)
        .bind(user_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Invite link not found or you don't have permission".to_string(),
        ));
    }

    Ok(())
}
