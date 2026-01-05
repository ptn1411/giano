use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    // Authentication errors
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("Token expired")]
    TokenExpired,
    #[error("Invalid token")]
    InvalidToken,
    #[error("Email already exists")]
    EmailExists,
    #[error("Invalid email format")]
    InvalidEmail,
    #[error("Weak password")]
    WeakPassword,
    #[error("Missing name")]
    MissingName,

    // Authorization errors
    #[error("Access denied")]
    AccessDenied,
    #[error("Not message owner")]
    NotMessageOwner,

    // Not found errors
    #[error("User not found")]
    UserNotFound,
    #[error("Chat not found")]
    ChatNotFound,
    #[error("Message not found")]
    MessageNotFound,
    #[error("Bot not found")]
    BotNotFound,

    // Bot-specific errors
    #[error("Bot is not active")]
    BotInactive,
    #[error("Bot not subscribed to chat")]
    BotNotSubscribed,
    #[error("Permission denied: missing scope {0}")]
    BotPermissionDenied(String),
    #[error("Rate limit exceeded, retry after {0} seconds")]
    BotRateLimitExceeded(u32),
    #[error("Invalid webhook URL")]
    InvalidWebhookUrl,
    #[error("Webhook error: {0}")]
    WebhookError(String),

    // Rate limiting errors
    #[error("Too many login attempts, retry after {0} seconds")]
    LoginRateLimitExceeded(u32),

    // Validation errors
    #[error("Empty message")]
    EmptyMessage,
    #[error("Invalid participants")]
    InvalidParticipants,
    #[error("File too large")]
    FileTooLarge,
    #[error("Invalid file type")]
    InvalidFileType,
    #[error("Cannot terminate current session")]
    CannotTerminateCurrent,

    // Internal errors
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    code: String,
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            AppError::InvalidCredentials => (StatusCode::UNAUTHORIZED, "INVALID_CREDENTIALS"),
            AppError::TokenExpired => (StatusCode::UNAUTHORIZED, "TOKEN_EXPIRED"),
            AppError::InvalidToken => (StatusCode::UNAUTHORIZED, "INVALID_TOKEN"),
            AppError::EmailExists => (StatusCode::CONFLICT, "EMAIL_EXISTS"),
            AppError::InvalidEmail => (StatusCode::BAD_REQUEST, "INVALID_EMAIL"),
            AppError::WeakPassword => (StatusCode::BAD_REQUEST, "WEAK_PASSWORD"),
            AppError::MissingName => (StatusCode::BAD_REQUEST, "MISSING_NAME"),
            AppError::AccessDenied => (StatusCode::FORBIDDEN, "ACCESS_DENIED"),
            AppError::NotMessageOwner => (StatusCode::FORBIDDEN, "NOT_MESSAGE_OWNER"),
            AppError::UserNotFound => (StatusCode::NOT_FOUND, "USER_NOT_FOUND"),
            AppError::ChatNotFound => (StatusCode::NOT_FOUND, "CHAT_NOT_FOUND"),
            AppError::MessageNotFound => (StatusCode::NOT_FOUND, "MESSAGE_NOT_FOUND"),
            AppError::BotNotFound => (StatusCode::NOT_FOUND, "BOT_NOT_FOUND"),
            AppError::BotInactive => (StatusCode::FORBIDDEN, "BOT_INACTIVE"),
            AppError::BotNotSubscribed => (StatusCode::FORBIDDEN, "BOT_NOT_SUBSCRIBED"),
            AppError::BotPermissionDenied(_) => (StatusCode::FORBIDDEN, "BOT_PERMISSION_DENIED"),
            AppError::BotRateLimitExceeded(_) => (StatusCode::TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED"),
            AppError::InvalidWebhookUrl => (StatusCode::BAD_REQUEST, "INVALID_WEBHOOK_URL"),
            AppError::WebhookError(_) => (StatusCode::BAD_GATEWAY, "WEBHOOK_ERROR"),
            AppError::LoginRateLimitExceeded(_) => (StatusCode::TOO_MANY_REQUESTS, "LOGIN_RATE_LIMIT_EXCEEDED"),
            AppError::EmptyMessage => (StatusCode::BAD_REQUEST, "EMPTY_MESSAGE"),
            AppError::InvalidParticipants => (StatusCode::BAD_REQUEST, "INVALID_PARTICIPANTS"),
            AppError::FileTooLarge => (StatusCode::BAD_REQUEST, "FILE_TOO_LARGE"),
            AppError::InvalidFileType => (StatusCode::BAD_REQUEST, "INVALID_FILE_TYPE"),
            AppError::CannotTerminateCurrent => (StatusCode::BAD_REQUEST, "CANNOT_TERMINATE_CURRENT"),
            AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR"),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"),
        };

        let body = ErrorResponse {
            error: ErrorBody {
                code: code.to_string(),
                message: self.to_string(),
            },
        };

        (status, Json(body)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
