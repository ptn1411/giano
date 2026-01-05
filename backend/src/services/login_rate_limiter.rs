/// Login Rate Limiter Service
/// 
/// Protects against brute force attacks by tracking failed login attempts
/// and temporarily blocking accounts/IPs that exceed thresholds.

use crate::{db::Database, error::AppResult};
use chrono::{Duration, Utc};
use uuid::Uuid;

pub struct LoginRateLimiter;

impl LoginRateLimiter {
    /// Check if login is allowed for this email/IP combination
    /// 
    /// Rules:
    /// - Max 5 failed attempts per email in 15 minutes
    /// - Max 10 failed attempts per IP in 15 minutes
    /// 
    /// Returns: (allowed, retry_after_seconds)
    pub async fn check_rate_limit(
        db: &Database,
        email: &str,
        ip_address: Option<&str>,
    ) -> AppResult<(bool, Option<u32>)> {
        let fifteen_mins_ago = Utc::now() - Duration::minutes(15);

        // Check email-based rate limit
        let email_attempts: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) 
            FROM login_attempts 
            WHERE email = $1 
              AND success = FALSE 
              AND attempted_at > $2
            "#,
        )
        .bind(email)
        .bind(fifteen_mins_ago)
        .fetch_one(&db.pool)
        .await?;

        if email_attempts >= 5 {
            let retry_after = Self::calculate_retry_after(email_attempts);
            return Ok((false, Some(retry_after)));
        }

        // Check IP-based rate limit (if IP provided)
        if let Some(ip) = ip_address {
            let ip_attempts: i64 = sqlx::query_scalar(
                r#"
                SELECT COUNT(*) 
                FROM login_attempts 
                WHERE ip_address = $1 
                  AND success = FALSE 
                  AND attempted_at > $2
                "#,
            )
            .bind(ip)
            .bind(fifteen_mins_ago)
            .fetch_one(&db.pool)
            .await?;

            if ip_attempts >= 10 {
                let retry_after = Self::calculate_retry_after(ip_attempts);
                return Ok((false, Some(retry_after)));
            }
        }

        Ok((true, None))
    }

    /// Record a login attempt
    pub async fn record_attempt(
        db: &Database,
        email: &str,
        ip_address: Option<&str>,
        success: bool,
        user_agent: Option<&str>,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO login_attempts (email, ip_address, success, user_agent)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(email)
        .bind(ip_address)
        .bind(success)
        .bind(user_agent)
        .execute(&db.pool)
        .await?;

        Ok(())
    }

    /// Clear failed attempts for an email (called after successful login)
    pub async fn clear_failed_attempts(db: &Database, email: &str) -> AppResult<()> {
        sqlx::query(
            r#"
            DELETE FROM login_attempts 
            WHERE email = $1 AND success = FALSE
            "#,
        )
        .bind(email)
        .execute(&db.pool)
        .await?;

        Ok(())
    }

    /// Calculate retry-after seconds based on number of attempts
    /// Exponential backoff: 60s, 120s, 300s, 600s, 900s
    fn calculate_retry_after(attempts: i64) -> u32 {
        match attempts {
            5..=6 => 60,    // 1 minute
            7..=8 => 120,   // 2 minutes
            9..=10 => 300,  // 5 minutes
            11..=15 => 600, // 10 minutes
            _ => 900,       // 15 minutes
        }
    }

    /// Cleanup old login attempts (run periodically)
    pub async fn cleanup_old_attempts(db: &Database) -> AppResult<u64> {
        let result = sqlx::query("SELECT cleanup_old_login_attempts()")
            .execute(&db.pool)
            .await?;

        Ok(result.rows_affected())
    }

    /// Get recent failed attempts for monitoring
    pub async fn get_recent_failed_attempts(
        db: &Database,
        limit: i64,
    ) -> AppResult<Vec<LoginAttempt>> {
        let attempts = sqlx::query_as(
            r#"
            SELECT id, email, ip_address, success, attempted_at, user_agent
            FROM login_attempts
            WHERE success = FALSE
            ORDER BY attempted_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&db.pool)
        .await?;

        Ok(attempts)
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct LoginAttempt {
    pub id: Uuid,
    pub email: String,
    pub ip_address: Option<String>,
    pub success: bool,
    pub attempted_at: chrono::DateTime<Utc>,
    pub user_agent: Option<String>,
}
