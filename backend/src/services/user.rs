use crate::{
    db::Database,
    error::{AppError, AppResult},
    models::{User, UserPublic},
};
use uuid::Uuid;

pub struct UserService;

impl UserService {
    pub async fn get_all_users(db: &Database) -> AppResult<Vec<UserPublic>> {
        let users: Vec<User> = sqlx::query_as("SELECT * FROM users ORDER BY name")
            .fetch_all(&db.pool)
            .await?;

        Ok(users.into_iter().map(|u| u.into()).collect())
    }

    pub async fn get_user_by_id(db: &Database, user_id: Uuid) -> AppResult<UserPublic> {
        let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&db.pool)
            .await?
            .ok_or(AppError::UserNotFound)?;

        Ok(user.into())
    }

    pub async fn get_user_by_email(db: &Database, email: &str) -> AppResult<UserPublic> {
        let user: User = sqlx::query_as("SELECT * FROM users WHERE LOWER(email) = LOWER($1)")
            .bind(email)
            .fetch_optional(&db.pool)
            .await?
            .ok_or(AppError::UserNotFound)?;

        Ok(user.into())
    }

    pub async fn get_user_by_username(db: &Database, username: &str) -> AppResult<UserPublic> {
        let user: User = sqlx::query_as("SELECT * FROM users WHERE LOWER(username) = LOWER($1)")
            .bind(username)
            .fetch_optional(&db.pool)
            .await?
            .ok_or(AppError::UserNotFound)?;

        Ok(user.into())
    }

    /// Get users that current user has chats with (connected users)
    pub async fn get_connected_users(
        db: &Database,
        current_user_id: Uuid,
        search: Option<&str>,
        limit: i64,
    ) -> AppResult<Vec<UserPublic>> {
        let users: Vec<User> = if let Some(search_query) = search {
            sqlx::query_as(
                r#"
                SELECT DISTINCT u.* FROM users u
                INNER JOIN chat_participants cp1 ON u.id = cp1.user_id
                INNER JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
                WHERE cp2.user_id = $1 
                AND u.id != $1
                AND (
                    LOWER(u.name) LIKE LOWER($2)
                    OR LOWER(u.username) LIKE LOWER($2)
                    OR LOWER(u.email) LIKE LOWER($2)
                )
                ORDER BY u.name
                LIMIT $3
                "#,
            )
            .bind(current_user_id)
            .bind(format!("%{}%", search_query))
            .bind(limit)
            .fetch_all(&db.pool)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT DISTINCT u.* FROM users u
                INNER JOIN chat_participants cp1 ON u.id = cp1.user_id
                INNER JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
                WHERE cp2.user_id = $1 
                AND u.id != $1
                ORDER BY u.name
                LIMIT $2
                "#,
            )
            .bind(current_user_id)
            .bind(limit)
            .fetch_all(&db.pool)
            .await?
        };

        Ok(users.into_iter().map(|u| u.into()).collect())
    }

    /// Search all users (with limit)
    pub async fn search_users(
        db: &Database,
        search: &str,
        limit: i64,
    ) -> AppResult<Vec<UserPublic>> {
        let users: Vec<User> = sqlx::query_as(
            r#"
            SELECT * FROM users
            WHERE LOWER(name) LIKE LOWER($1)
            OR LOWER(username) LIKE LOWER($1)
            OR LOWER(email) LIKE LOWER($1)
            ORDER BY name
            LIMIT $2
            "#,
        )
        .bind(format!("%{}%", search))
        .bind(limit)
        .fetch_all(&db.pool)
        .await?;

        Ok(users.into_iter().map(|u| u.into()).collect())
    }

    pub async fn update_user(
        db: &Database,
        user_id: Uuid,
        name: Option<String>,
        username: Option<String>,
        bio: Option<String>,
        phone: Option<String>,
        avatar: Option<String>,
    ) -> AppResult<User> {
        let user: User = sqlx::query_as(
            r#"
            UPDATE users SET
                name = COALESCE($2, name),
                username = COALESCE($3, username),
                bio = COALESCE($4, bio),
                phone = COALESCE($5, phone),
                avatar = COALESCE($6, avatar),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(name)
        .bind(username)
        .bind(bio)
        .bind(phone)
        .bind(avatar)
        .fetch_one(&db.pool)
        .await?;

        Ok(user)
    }

    pub async fn update_status(db: &Database, user_id: Uuid, status: &str) -> AppResult<()> {
        let last_seen = if status == "offline" {
            Some(chrono::Utc::now())
        } else {
            None
        };

        sqlx::query(
            "UPDATE users SET status = $2, last_seen = $3, updated_at = NOW() WHERE id = $1",
        )
        .bind(user_id)
        .bind(status)
        .bind(last_seen)
        .execute(&db.pool)
        .await?;

        Ok(())
    }
}
