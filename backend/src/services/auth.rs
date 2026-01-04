use crate::{
    db::Database,
    error::{AppError, AppResult},
    models::{Session, User, UserSession},
};
use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub name: String,
    pub exp: i64,
    pub iat: i64,
    pub jti: String,
}

pub struct AuthService;

impl AuthService {
    pub fn hash_password(password: &str) -> AppResult<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing failed: {}", e)))?;
        Ok(hash.to_string())
    }

    pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid hash: {}", e)))?;
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok())
    }

    pub fn generate_token(
        user: &User,
        secret: &str,
        expiration_hours: i64,
    ) -> AppResult<(String, i64, Uuid)> {
        let session_id = Uuid::new_v4();
        let now = Utc::now();
        let exp = now + Duration::hours(expiration_hours);

        let claims = Claims {
            sub: user.id.to_string(),
            email: user.email.clone(),
            name: user.name.clone(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: session_id.to_string(),
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Token generation failed: {}", e)))?;

        Ok((token, exp.timestamp_millis(), session_id))
    }

    pub fn verify_token(token: &str, secret: &str) -> AppResult<Claims> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|e| match e.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => AppError::TokenExpired,
            _ => AppError::InvalidToken,
        })?;

        Ok(token_data.claims)
    }

    pub async fn register(
        db: &Database,
        email: &str,
        password: &str,
        name: &str,
        jwt_secret: &str,
        jwt_expiration: i64,
    ) -> AppResult<UserSession> {
        // Validate email
        if !email.contains('@') {
            return Err(AppError::InvalidEmail);
        }

        // Validate password
        if password.len() < 6 {
            return Err(AppError::WeakPassword);
        }

        // Validate name
        if name.trim().is_empty() {
            return Err(AppError::MissingName);
        }

        // Check if email exists
        let existing: Option<User> = sqlx::query_as(
            "SELECT * FROM users WHERE email = $1"
        )
        .bind(email)
        .fetch_optional(&db.pool)
        .await?;

        if existing.is_some() {
            return Err(AppError::EmailExists);
        }

        // Hash password
        let password_hash = Self::hash_password(password)?;

        // Generate avatar
        let avatar = format!(
            "https://api.dicebear.com/7.x/avataaars/svg?seed={}",
            name.replace(' ', "")
        );

        // Create user
        let user: User = sqlx::query_as(
            r#"
            INSERT INTO users (email, password_hash, name, avatar, status)
            VALUES ($1, $2, $3, $4, 'online')
            RETURNING *
            "#,
        )
        .bind(email)
        .bind(&password_hash)
        .bind(name)
        .bind(&avatar)
        .fetch_one(&db.pool)
        .await?;

        // Generate token
        let (token, expires_at, session_id) =
            Self::generate_token(&user, jwt_secret, jwt_expiration)?;

        // Create session
        sqlx::query(
            r#"
            INSERT INTO sessions (id, user_id, token, expires_at)
            VALUES ($1, $2, $3, to_timestamp($4))
            "#,
        )
        .bind(session_id)
        .bind(user.id)
        .bind(&token)
        .bind(expires_at / 1000)
        .execute(&db.pool)
        .await?;

        // Create default settings
        sqlx::query("INSERT INTO user_settings (user_id) VALUES ($1)")
            .bind(user.id)
            .execute(&db.pool)
            .await?;

        Ok(UserSession {
            user: user.into(),
            token,
            expires_at,
        })
    }

    pub async fn login(
        db: &Database,
        email: &str,
        password: &str,
        jwt_secret: &str,
        jwt_expiration: i64,
    ) -> AppResult<UserSession> {
        let user: User = sqlx::query_as("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(&db.pool)
            .await?
            .ok_or(AppError::InvalidCredentials)?;

        if !Self::verify_password(password, &user.password_hash)? {
            return Err(AppError::InvalidCredentials);
        }

        // Update status to online
        sqlx::query("UPDATE users SET status = 'online', last_seen = NULL WHERE id = $1")
            .bind(user.id)
            .execute(&db.pool)
            .await?;

        let (token, expires_at, session_id) =
            Self::generate_token(&user, jwt_secret, jwt_expiration)?;

        // Create session
        sqlx::query(
            r#"
            INSERT INTO sessions (id, user_id, token, expires_at)
            VALUES ($1, $2, $3, to_timestamp($4))
            "#,
        )
        .bind(session_id)
        .bind(user.id)
        .bind(&token)
        .bind(expires_at / 1000)
        .execute(&db.pool)
        .await?;

        Ok(UserSession {
            user: user.into(),
            token,
            expires_at,
        })
    }

    pub async fn logout(db: &Database, token: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM sessions WHERE token = $1")
            .bind(token)
            .execute(&db.pool)
            .await?;
        Ok(())
    }

    pub async fn get_session(
        db: &Database,
        user_id: Uuid,
        token: &str,
    ) -> AppResult<UserSession> {
        let session: Session = sqlx::query_as(
            "SELECT * FROM sessions WHERE user_id = $1 AND token = $2 AND expires_at > NOW()"
        )
        .bind(user_id)
        .bind(token)
        .fetch_optional(&db.pool)
        .await?
        .ok_or(AppError::InvalidToken)?;

        let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&db.pool)
            .await?;

        Ok(UserSession {
            user: user.into(),
            token: session.token,
            expires_at: session.expires_at.timestamp_millis(),
        })
    }
}
