use axum::{
    extract::{Multipart, State},
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;
use tokio::fs;
use tokio::io::AsyncWriteExt;

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

// Whitelist of allowed extensions
const ALLOWED_EXTENSIONS: &[&str] = &[
    // Images
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg",
    // Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv",
    // Archives
    "zip", "rar", "7z", "tar", "gz",
    // Audio
    "mp3", "wav", "ogg", "m4a",
    // Video
    "mp4", "avi", "mov", "mkv", "webm",
];

// Magic bytes for file type validation
struct MagicBytes {
    bytes: &'static [u8],
    extensions: &'static [&'static str],
    mime_type: &'static str,
}

const MAGIC_BYTES: &[MagicBytes] = &[
    // Images
    MagicBytes { bytes: &[0xFF, 0xD8, 0xFF], extensions: &["jpg", "jpeg"], mime_type: "image/jpeg" },
    MagicBytes { bytes: &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], extensions: &["png"], mime_type: "image/png" },
    MagicBytes { bytes: &[0x47, 0x49, 0x46, 0x38], extensions: &["gif"], mime_type: "image/gif" },
    MagicBytes { bytes: &[0x52, 0x49, 0x46, 0x46], extensions: &["webp"], mime_type: "image/webp" }, // RIFF
    MagicBytes { bytes: &[0x42, 0x4D], extensions: &["bmp"], mime_type: "image/bmp" },
    
    // Documents
    MagicBytes { bytes: &[0x25, 0x50, 0x44, 0x46], extensions: &["pdf"], mime_type: "application/pdf" },
    MagicBytes { bytes: &[0x50, 0x4B, 0x03, 0x04], extensions: &["docx", "xlsx", "pptx", "zip"], mime_type: "application/zip" },
    MagicBytes { bytes: &[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], extensions: &["doc", "xls", "ppt"], mime_type: "application/msword" },
    
    // Archives
    MagicBytes { bytes: &[0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], extensions: &["rar"], mime_type: "application/x-rar-compressed" },
    MagicBytes { bytes: &[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], extensions: &["7z"], mime_type: "application/x-7z-compressed" },
    MagicBytes { bytes: &[0x1F, 0x8B], extensions: &["gz"], mime_type: "application/gzip" },
    
    // Audio
    MagicBytes { bytes: &[0x49, 0x44, 0x33], extensions: &["mp3"], mime_type: "audio/mpeg" }, // ID3
    MagicBytes { bytes: &[0xFF, 0xFB], extensions: &["mp3"], mime_type: "audio/mpeg" },
    MagicBytes { bytes: &[0x52, 0x49, 0x46, 0x46], extensions: &["wav"], mime_type: "audio/wav" }, // RIFF
    MagicBytes { bytes: &[0x4F, 0x67, 0x67, 0x53], extensions: &["ogg"], mime_type: "audio/ogg" },
    
    // Video
    MagicBytes { bytes: &[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], extensions: &["mp4"], mime_type: "video/mp4" },
    MagicBytes { bytes: &[0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], extensions: &["mp4"], mime_type: "video/mp4" },
    MagicBytes { bytes: &[0x52, 0x49, 0x46, 0x46], extensions: &["avi"], mime_type: "video/x-msvideo" }, // RIFF
    MagicBytes { bytes: &[0x1A, 0x45, 0xDF, 0xA3], extensions: &["mkv", "webm"], mime_type: "video/x-matroska" },
];

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

    // Extract and validate extension
    let extension = name.rsplit('.').next().unwrap_or("bin").to_lowercase();
    
    // Check extension whitelist
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::InvalidFileType);
    }

    // Validate magic bytes
    let detected_type = detect_file_type(&data);
    if let Some(detected) = detected_type {
        // Check if detected extension matches the file extension
        if !detected.extensions.contains(&extension.as_str()) {
            tracing::warn!(
                "Magic bytes mismatch: file has extension '{}' but magic bytes suggest '{:?}'",
                extension,
                detected.extensions
            );
            return Err(AppError::InvalidFileType);
        }
        
        // Update content type based on magic bytes if not provided
        if content_type.is_none() {
            content_type = Some(detected.mime_type.to_string());
        }
    } else if !is_text_file(&extension) {
        // If we can't detect magic bytes and it's not a text file, reject it
        tracing::warn!("Could not detect magic bytes for file with extension '{}'", extension);
        return Err(AppError::InvalidFileType);
    }

    // Additional validation for image type
    let mime = content_type.clone().unwrap_or_default();
    if attachment_type == "image" && !mime.starts_with("image/") {
        return Err(AppError::InvalidFileType);
    }

    // Generate unique filename
    let file_id = Uuid::new_v4();
    let stored_name = format!("{}.{}", file_id, extension);

    // Store file locally
    store_file_locally(&stored_name, &data).await?;

    // Build URL based on server configuration
    let base_url = state.config.base_url.as_deref().unwrap_or("http://localhost:3000");
    let url = format!("{}/uploads/{}", base_url, stored_name);

    tracing::info!("File uploaded successfully: {} ({})", name, stored_name);

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

fn detect_file_type(data: &[u8]) -> Option<&'static MagicBytes> {
    for magic in MAGIC_BYTES {
        if data.starts_with(magic.bytes) {
            return Some(magic);
        }
        
        // Special case for RIFF files (WAV, AVI, WEBP)
        if magic.bytes == &[0x52, 0x49, 0x46, 0x46] && data.len() > 12 {
            // Check RIFF subtype
            if &data[8..12] == b"WAVE" && magic.extensions.contains(&"wav") {
                return Some(magic);
            }
            if &data[8..12] == b"AVI " && magic.extensions.contains(&"avi") {
                return Some(magic);
            }
            if &data[8..12] == b"WEBP" && magic.extensions.contains(&"webp") {
                return Some(magic);
            }
        }
    }
    None
}

fn is_text_file(extension: &str) -> bool {
    matches!(extension, "txt" | "csv" | "svg" | "json" | "xml" | "html" | "css" | "js")
}

async fn store_file_locally(filename: &str, data: &[u8]) -> AppResult<()> {
    // Create uploads directory if it doesn't exist
    let upload_dir = "uploads";
    fs::create_dir_all(upload_dir).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to create upload directory: {}", e))
    })?;

    let file_path = format!("{}/{}", upload_dir, filename);
    
    // Write file
    let mut file = fs::File::create(&file_path).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to create file: {}", e))
    })?;

    file.write_all(data).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to write file: {}", e))
    })?;

    tracing::debug!("File stored successfully: {}", file_path);
    
    Ok(())
}