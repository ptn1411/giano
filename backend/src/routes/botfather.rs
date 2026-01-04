/// BotFather API Routes - Handle BotFather chat messages.
///
/// This module provides:
/// - POST /api/v1/botfather/message - Send a message to BotFather and get response

use axum::{
    extract::State,
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::AppResult,
    routes::auth::get_current_user_id,
    services::bot_engine::{BotFather, ParsedCommand},
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/message", post(send_message))
}

#[derive(Debug, Deserialize)]
pub struct BotFatherMessageRequest {
    pub text: String,
    #[serde(rename = "chatId")]
    pub chat_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct BotFatherMessageResponse {
    pub success: bool,
    pub response: Option<String>,
    pub error: Option<String>,
}

/// Send a message to BotFather and get response.
///
/// POST /api/v1/botfather/message
///
/// # Request Body
/// ```json
/// {
///   "text": "/newbot MyBot",
///   "chatId": "uuid" (optional, for context)
/// }
/// ```
async fn send_message(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<BotFatherMessageRequest>,
) -> AppResult<Json<BotFatherMessageResponse>> {
    let user_id = get_current_user_id(&state, &headers).await?;

    // Parse the command
    let cmd = match ParsedCommand::parse(&body.text) {
        Some(c) => c,
        None => {
            return Ok(Json(BotFatherMessageResponse {
                success: false,
                response: None,
                error: Some("Please send a command starting with /. Type /bothelp for available commands.".to_string()),
            }));
        }
    };

    // Check if it's a BotFather command
    if !BotFather::is_botfather_command(&cmd) {
        return Ok(Json(BotFatherMessageResponse {
            success: false,
            response: None,
            error: Some(format!(
                "Unknown command: /{}. Type /bothelp for available commands.",
                cmd.command
            )),
        }));
    }

    // Use a dummy chat_id if not provided (for commands that don't need it)
    let chat_id = body.chat_id.unwrap_or_else(Uuid::nil);

    // Handle the command
    match BotFather::handle_command(&state.db, user_id, chat_id, &cmd).await {
        Ok(Some(response)) => Ok(Json(BotFatherMessageResponse {
            success: response.success,
            response: Some(response.text),
            error: None,
        })),
        Ok(None) => Ok(Json(BotFatherMessageResponse {
            success: false,
            response: None,
            error: Some("Command not handled".to_string()),
        })),
        Err(e) => Ok(Json(BotFatherMessageResponse {
            success: false,
            response: None,
            error: Some(format!("Error: {}", e)),
        })),
    }
}
