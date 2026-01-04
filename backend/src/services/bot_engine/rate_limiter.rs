/// Rate Limiter module - handles bot API rate limiting using Redis.
///
/// This module provides:
/// - Rate limiting per bot using Redis counters
/// - Configurable requests per minute limit
/// - RateLimitResult with remaining requests or retry_after time
///
/// # Requirements
/// - 8.1: Track API call counts per bot per time window
/// - 8.2: Reject requests with rate limit error when exceeded
/// - 8.3: Include retry_after in rate limit error
/// - 8.4: Allow requests again when time window resets

use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use uuid::Uuid;

use crate::error::AppError;

/// Default rate limit: 60 requests per minute
pub const DEFAULT_REQUESTS_PER_MINUTE: u32 = 60;

/// Time window in seconds (1 minute)
const RATE_LIMIT_WINDOW_SECONDS: i64 = 60;

/// Result of a rate limit check.
#[derive(Debug, Clone, PartialEq)]
pub enum RateLimitResult {
    /// Request is allowed, includes remaining requests in the window
    Allowed { remaining: u32 },
    /// Rate limit exceeded, includes seconds until the window resets
    Exceeded { retry_after: u32 },
}

/// Rate Limiter using Redis for distributed rate limiting.
///
/// Uses a simple counter with TTL approach:
/// - Key format: `bot_rate_limit:{bot_id}`
/// - Counter increments on each request
/// - TTL set to window duration on first request
/// - When counter >= limit, requests are rejected
#[derive(Clone)]
pub struct RateLimiter {
    redis: ConnectionManager,
    requests_per_minute: u32,
}

impl RateLimiter {
    /// Create a new RateLimiter with the given Redis connection and rate limit.
    ///
    /// # Arguments
    /// * `redis` - Redis connection manager
    /// * `requests_per_minute` - Maximum requests allowed per minute per bot
    pub fn new(redis: ConnectionManager, requests_per_minute: u32) -> Self {
        Self {
            redis,
            requests_per_minute,
        }
    }

    /// Create a new RateLimiter with default rate limit (60 requests/minute).
    pub fn with_defaults(redis: ConnectionManager) -> Self {
        Self::new(redis, DEFAULT_REQUESTS_PER_MINUTE)
    }

    /// Check if a bot is within rate limits and increment the counter.
    ///
    /// # Arguments
    /// * `bot_id` - The bot's UUID
    ///
    /// # Returns
    /// * `Ok(RateLimitResult::Allowed { remaining })` - Request allowed, with remaining count
    /// * `Ok(RateLimitResult::Exceeded { retry_after })` - Rate limit exceeded, with retry time
    /// * `Err(AppError)` - Redis error
    ///
    /// # Requirements
    /// - 8.1: Track API call counts per bot per time window
    /// - 8.2: Reject requests with rate limit error when exceeded
    /// - 8.3: Include retry_after in rate limit error
    /// - 8.4: Allow requests again when time window resets
    pub async fn check_rate_limit(&self, bot_id: Uuid) -> Result<RateLimitResult, AppError> {
        let key = format!("bot_rate_limit:{}", bot_id);
        let mut conn = self.redis.clone();

        // Get current count
        let count: Option<u32> = conn.get(&key).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
        })?;

        let current_count = count.unwrap_or(0);

        // Check if rate limit exceeded
        if current_count >= self.requests_per_minute {
            // Get TTL to determine retry_after
            let ttl: i64 = conn.ttl(&key).await.map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
            })?;

            // TTL can be -1 (no expiry) or -2 (key doesn't exist)
            // In those cases, default to full window
            let retry_after = if ttl > 0 { ttl as u32 } else { RATE_LIMIT_WINDOW_SECONDS as u32 };

            return Ok(RateLimitResult::Exceeded { retry_after });
        }

        // Increment counter
        let new_count: u32 = conn.incr(&key, 1).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
        })?;

        // Set expiry on first request (when count was 0)
        if current_count == 0 {
            let _: () = conn.expire(&key, RATE_LIMIT_WINDOW_SECONDS).await.map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
            })?;
        }

        // Calculate remaining requests
        let remaining = self.requests_per_minute.saturating_sub(new_count);

        Ok(RateLimitResult::Allowed { remaining })
    }

    /// Get the current rate limit configuration.
    pub fn requests_per_minute(&self) -> u32 {
        self.requests_per_minute
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limit_result_equality() {
        let allowed1 = RateLimitResult::Allowed { remaining: 10 };
        let allowed2 = RateLimitResult::Allowed { remaining: 10 };
        let allowed3 = RateLimitResult::Allowed { remaining: 5 };
        let exceeded1 = RateLimitResult::Exceeded { retry_after: 30 };
        let exceeded2 = RateLimitResult::Exceeded { retry_after: 30 };

        assert_eq!(allowed1, allowed2);
        assert_ne!(allowed1, allowed3);
        assert_eq!(exceeded1, exceeded2);
        assert_ne!(allowed1, exceeded1);
    }

    #[test]
    fn test_default_requests_per_minute() {
        assert_eq!(DEFAULT_REQUESTS_PER_MINUTE, 60);
    }
}
