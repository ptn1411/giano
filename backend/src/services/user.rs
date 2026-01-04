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
