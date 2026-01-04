use axum::{
    extract::{Multipart, State},
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::AttachmentResponse,
    routes::auth::get_current_user_id,
    AppState,
};

pub fn routes() -> Router<Arc<AppState>> {
    Router::new().route("/", post(upload_file))
}

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    attachment: AttachmentResponse,
}

async fn upload_file(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> AppResult<Json<UploadResponse>> {
    let _ = get_current_user_id(&state, &headers).await?;

    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut file_type: Option<String> = None;
    let mut content_type: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to read multipart: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                file_name = field.file_name().map(|s| s.to_string());
                content_type = field.content_type().map(|s| s.to_string());
                
                let data = field.bytes().await.map_err(|e| {
                    AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e))
                })?;

                if data.len() > MAX_FILE_SIZE {
                    return Err(AppError::FileTooLarge);
                }

                file_data = Some(data.to_vec());
            }
            "type" => {
                let text = field.text().await.map_err(|e| {
                    AppError::Internal(anyhow::anyhow!("Failed to read type: {}", e))
                })?;
                file_type = Some(text);
            }
            _ => {}
        }
    }

    let data = file_data.ok_or(AppError::Internal(anyhow::anyhow!("No file provided")))?;
    let name = file_name.unwrap_or_else(|| "unnamed".to_string());
    let attachment_type = file_type.unwrap_or_else(|| "file".to_string());

    // Validate file type
    let mime = content_type.clone().unwrap_or_default();
    if attachment_type == "image" && !mime.starts_with("image/") {
        return Err(AppError::InvalidFileType);
    }

    // Generate unique filename
    let file_id = Uuid::new_v4();
    let extension = name.rsplit('.').next().unwrap_or("bin");
    let stored_name = format!("{}.{}", file_id, extension);

    // TODO: Store file to S3 or local storage
    // For now, we'll just return a mock URL
    let url = format!("https://storage.example.com/uploads/{}", stored_name);

    Ok(Json(UploadResponse {
        attachment: AttachmentResponse {
            id: file_id,
            attachment_type,
            name,
            size: data.len() as i64,
            url,
            mime_type: content_type,
        },
    }))
}
