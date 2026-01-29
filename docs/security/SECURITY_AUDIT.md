# Báo Cáo Kiểm Tra Bảo Mật (Security Audit)

**Dự án:** Smooth Messenger  
**Ngày kiểm tra:** 4 tháng 1, 2026  
**Người kiểm tra:** Kiro AI

---

## 📊 Tổng Quan

Dự án là một ứng dụng chat real-time với backend Rust (Axum) và frontend TypeScript/React. Hệ thống hỗ trợ bot API tương tự Telegram.

### Điểm Mạnh ✅
- Sử dụng Rust - ngôn ngữ an toàn về memory
- Authentication với JWT
- Password hashing với Argon2
- Rate limiting cho bot API
- Input validation cơ bản
- CORS configuration

### Vấn Đề Nghiêm Trọng 🔴
1. **JWT Secret yếu trong example**
2. **CORS permissive**
3. **Thiếu HTTPS enforcement**
4. **Không có input sanitization**
5. **Thiếu rate limiting cho user endpoints**
6. **File upload không kiểm tra kỹ**

---

## 🔴 Vấn Đề Nghiêm Trọng (Critical)

### 1. JWT Secret Yếu
**File:** `backend/.env.example`
```env
JWT_SECRET=your-super-secret-key-change-in-production
```

**Vấn đề:**
- Secret quá đơn giản, dễ đoán
- Không có hướng dẫn tạo secret mạnh
- Nếu developer quên đổi trong production → toàn bộ hệ thống bị compromise

**Khuyến nghị:**
```bash
# Tạo JWT secret mạnh (256-bit)
openssl rand -base64 32

# Hoặc trong Rust
use rand::Rng;
let secret: String = rand::thread_rng()
    .sample_iter(&rand::distributions::Alphanumeric)
    .take(64)
    .map(char::from)
    .collect();
```

**Sửa ngay:**
```env
# JWT - MUST be changed in production!
# Generate with: openssl rand -base64 32
JWT_SECRET=CHANGE_THIS_IN_PRODUCTION_USE_OPENSSL_RAND_BASE64_32
```

---

### 2. CORS Permissive
**File:** `backend/src/lib.rs:80`
```rust
.layer(CorsLayer::permissive())
```

**Vấn đề:**
- Cho phép TẤT CẢ origins truy cập API
- Dễ bị CSRF attacks
- Không kiểm soát được ai gọi API

**Khuyến nghị:**
```rust
use tower_http::cors::{CorsLayer, Any};
use http::Method;

let cors = CorsLayer::new()
    .allow_origin([
        "http://localhost:5173".parse().unwrap(),
        "https://yourdomain.com".parse().unwrap(),
    ])
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    .allow_headers(Any)
    .allow_credentials(true);

// Trong app
.layer(cors)
```

---

### 3. Không Có HTTPS Enforcement
**File:** `backend/src/main.rs`

**Vấn đề:**
- Server chạy HTTP thuần
- JWT token, password có thể bị sniff trên network
- Man-in-the-middle attacks

**Khuyến nghị:**
```rust
// Thêm middleware redirect HTTP → HTTPS
use axum::middleware;

async fn redirect_to_https(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    if req.uri().scheme_str() == Some("http") {
        // Redirect to HTTPS
        let uri = format!("https://{}{}", 
            req.uri().authority().unwrap(), 
            req.uri().path()
        );
        return axum::response::Redirect::permanent(&uri).into_response();
    }
    next.run(req).await
}

// Hoặc dùng reverse proxy (nginx, caddy) để handle HTTPS
```

---

## 🟠 Vấn Đề Quan Trọng (High)

### 4. File Upload Không An Toàn
**File:** `backend/src/routes/upload.rs`

**Vấn đề:**
```rust
const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB

// Chỉ check MIME type đơn giản
if attachment_type == "image" && !mime.starts_with("image/") {
    return Err(AppError::InvalidFileType);
}

// Lưu file với extension từ user
let extension = name.rsplit('.').next().unwrap_or("bin");
let stored_name = format!("{}.{}", file_id, extension);
```

**Rủi ro:**
- User có thể upload file độc hại (.exe, .sh, .php)
- Extension spoofing (file.jpg.exe)
- Không kiểm tra nội dung file thực sự
- Path traversal nếu filename chứa "../"

**Khuyến nghị:**
```rust
use infer; // Crate để detect file type từ magic bytes

// Whitelist extensions
const ALLOWED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "pdf", "mp4"];
const ALLOWED_MIME_TYPES: &[&str] = &[
    "image/jpeg", "image/png", "image/gif", 
    "application/pdf", "video/mp4"
];

async fn upload_file(...) -> AppResult<Json<UploadResponse>> {
    // ... existing code ...
    
    // 1. Validate extension
    let extension = name.rsplit('.').next().unwrap_or("bin").to_lowercase();
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::InvalidFileType);
    }
    
    // 2. Detect real file type from content (magic bytes)
    let kind = infer::get(&data).ok_or(AppError::InvalidFileType)?;
    if !ALLOWED_MIME_TYPES.contains(&kind.mime_type()) {
        return Err(AppError::InvalidFileType);
    }
    
    // 3. Sanitize filename - remove path traversal
    let safe_extension = extension.replace(".", "").replace("/", "");
    let stored_name = format!("{}.{}", file_id, safe_extension);
    
    // 4. Scan for malware (nếu có budget)
    // scan_with_clamav(&data).await?;
    
    // ... rest of code ...
}
```

---

### 5. SQL Injection Risk (Thấp nhưng cần check)
**Tình trạng:** ✅ Tốt - Đang dùng parameterized queries

**Ví dụ an toàn:**
```rust
sqlx::query("SELECT * FROM users WHERE email = $1")
    .bind(email)  // ✅ Safe - parameterized
    .fetch_optional(&db.pool)
```

**Lưu ý:** Không bao giờ dùng string concatenation:
```rust
// ❌ NGUY HIỂM - Không làm thế này!
let query = format!("SELECT * FROM users WHERE email = '{}'", email);
sqlx::query(&query).fetch_optional(&db.pool)
```

---

### 6. Rate Limiting Không Đầy Đủ
**File:** `backend/src/routes/bot_api.rs`

**Vấn đề:**
- Chỉ có rate limiting cho bot API
- User endpoints không có rate limiting
- Dễ bị brute force login
- Dễ bị spam messages

**Khuyến nghị:**
```rust
// Thêm rate limiting cho login endpoint
use tower_governor::{
    governor::GovernorConfigBuilder, 
    GovernorLayer
};

// Trong lib.rs
let login_governor = GovernorConfigBuilder::default()
    .per_second(1)  // 1 request/second
    .burst_size(5)  // Burst 5 requests
    .finish()
    .unwrap();

Router::new()
    .route("/auth/login", post(login))
    .layer(GovernorLayer {
        config: Box::leak(Box::new(login_governor)),
    })
```

---

## 🟡 Vấn Đề Trung Bình (Medium)

### 7. Password Policy Yếu
**File:** `backend/src/services/auth.rs:95`
```rust
if password.len() < 6 {
    return Err(AppError::WeakPassword);
}
```

**Vấn đề:**
- Chỉ check độ dài tối thiểu 6 ký tự
- Không check complexity (chữ hoa, số, ký tự đặc biệt)
- Password "123456" vẫn hợp lệ

**Khuyến nghị:**
```rust
fn validate_password(password: &str) -> AppResult<()> {
    if password.len() < 8 {
        return Err(AppError::WeakPassword);
    }
    
    let has_uppercase = password.chars().any(|c| c.is_uppercase());
    let has_lowercase = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_numeric());
    let has_special = password.chars().any(|c| !c.is_alphanumeric());
    
    if !(has_uppercase && has_lowercase && has_digit && has_special) {
        return Err(AppError::WeakPassword);
    }
    
    // Check against common passwords
    const COMMON_PASSWORDS: &[&str] = &[
        "password", "123456", "12345678", "qwerty", "abc123"
    ];
    if COMMON_PASSWORDS.contains(&password.to_lowercase().as_str()) {
        return Err(AppError::WeakPassword);
    }
    
    Ok(())
}
```

---

### 8. Không Có Session Timeout
**File:** `backend/src/services/auth.rs`

**Vấn đề:**
- JWT có expiration nhưng không có refresh token
- Session không tự động logout khi inactive
- Không có "Remember me" option

**Khuyến nghị:**
```rust
// Implement refresh token pattern
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub access_expires_at: i64,
    pub refresh_expires_at: i64,
}

// Access token: 15 phút
// Refresh token: 7 ngày
// Lưu refresh token trong database với user_id
```

---

### 9. Webhook URL Không Được Validate Đầy Đủ
**File:** `backend/src/routes/bot_api.rs:188`

**Vấn đề:**
```rust
// Basic URL validation
if !url.starts_with("http://") && !url.starts_with("https://") {
    return Ok(Json(BotApiResponse::error(400, "Invalid webhook URL")));
}
```

**Rủi ro:**
- Có thể point đến internal services (SSRF)
- Không check IP private (127.0.0.1, 192.168.x.x)
- TODO comment chưa implement test request

**Khuyến nghị:**
```rust
use std::net::IpAddr;

async fn validate_webhook_url(url: &str) -> AppResult<()> {
    // 1. Parse URL
    let parsed = url::Url::parse(url)
        .map_err(|_| AppError::InvalidWebhookUrl)?;
    
    // 2. Must be HTTPS in production
    if parsed.scheme() != "https" {
        return Err(AppError::InvalidWebhookUrl);
    }
    
    // 3. Resolve hostname to IP
    let host = parsed.host_str().ok_or(AppError::InvalidWebhookUrl)?;
    let addrs: Vec<IpAddr> = tokio::net::lookup_host(format!("{}:443", host))
        .await?
        .map(|addr| addr.ip())
        .collect();
    
    // 4. Block private IPs (SSRF protection)
    for addr in addrs {
        if is_private_ip(&addr) {
            return Err(AppError::InvalidWebhookUrl);
        }
    }
    
    // 5. Send test request
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;
    
    client.post(url)
        .json(&serde_json::json!({"test": true}))
        .send()
        .await?;
    
    Ok(())
}

fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => {
            ipv4.is_private() || 
            ipv4.is_loopback() || 
            ipv4.is_link_local()
        }
        IpAddr::V6(ipv6) => {
            ipv6.is_loopback() || 
            ipv6.is_unique_local()
        }
    }
}
```

---

### 10. WebSocket Authentication
**File:** `backend/src/ws/handler.rs`

**Tình trạng:** ✅ Tốt - Có validate JWT token

**Lưu ý thêm:**
```rust
// Nên thêm heartbeat để detect dead connections
// Nên có timeout cho inactive connections
// Nên log failed authentication attempts
```

---

## 🔵 Vấn Đề Thấp (Low) & Best Practices

### 11. Logging & Monitoring
**Khuyến nghị:**
```rust
// Log security events
tracing::warn!(
    user_id = %user_id,
    ip = %client_ip,
    "Failed login attempt"
);

// Log bot API calls
tracing::info!(
    bot_id = %bot.id,
    chat_id = %chat_id,
    "Bot sent message"
);

// Alert on suspicious activities
if failed_attempts > 5 {
    alert_security_team(user_id).await;
}
```

---

### 12. Environment Variables
**Khuyến nghị:**
- Thêm validation cho tất cả env vars
- Fail fast nếu thiếu config quan trọng
- Document tất cả env vars

```rust
impl Config {
    pub fn from_env() -> Result<Self> {
        // Validate JWT_SECRET strength
        let jwt_secret = env::var("JWT_SECRET")
            .context("JWT_SECRET must be set")?;
        
        if jwt_secret.len() < 32 {
            anyhow::bail!("JWT_SECRET must be at least 32 characters");
        }
        
        if jwt_secret.contains("change") || jwt_secret.contains("example") {
            anyhow::bail!("JWT_SECRET must be changed from default value");
        }
        
        // ... rest of config ...
    }
}
```

---

### 13. Database Security
**Khuyến nghị:**
```sql
-- Tạo database user riêng cho app (không dùng postgres superuser)
CREATE USER chat_app WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE chat_db TO chat_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO chat_app;

-- Enable SSL connection
-- Trong DATABASE_URL: postgres://user:pass@host/db?sslmode=require
```

---

### 14. Secrets Management
**Khuyến nghị:**
- Không commit .env files vào git ✅ (đã có .gitignore)
- Dùng secrets manager trong production:
  - AWS Secrets Manager
  - HashiCorp Vault
  - Azure Key Vault
  - Google Secret Manager

```rust
// Example với AWS Secrets Manager
use aws_sdk_secretsmanager::Client;

async fn load_secrets() -> Result<Config> {
    let client = Client::new(&aws_config::load_from_env().await);
    let secret = client
        .get_secret_value()
        .secret_id("prod/chat-app/config")
        .send()
        .await?;
    
    let config: Config = serde_json::from_str(
        secret.secret_string().unwrap()
    )?;
    
    Ok(config)
}
```

---

## 📋 Checklist Triển Khai Production

### Trước Khi Deploy
- [ ] Đổi JWT_SECRET thành giá trị random mạnh
- [ ] Cấu hình CORS với origins cụ thể
- [ ] Enable HTTPS (dùng Let's Encrypt hoặc Cloudflare)
- [ ] Cấu hình rate limiting cho tất cả endpoints
- [ ] Validate file uploads kỹ hơn
- [ ] Strengthen password policy
- [ ] Implement refresh token
- [ ] Validate webhook URLs đầy đủ
- [ ] Setup logging & monitoring
- [ ] Tạo database user riêng (không dùng superuser)
- [ ] Enable database SSL connection
- [ ] Dùng secrets manager cho production
- [ ] Setup firewall rules
- [ ] Enable fail2ban hoặc tương tự
- [ ] Regular security updates
- [ ] Backup strategy
- [ ] Disaster recovery plan

### Monitoring & Alerts
- [ ] Failed login attempts
- [ ] Rate limit violations
- [ ] Unusual API usage patterns
- [ ] File upload anomalies
- [ ] Database connection errors
- [ ] High CPU/memory usage
- [ ] SSL certificate expiration

---

## 🛠️ Tools Khuyến Nghị

### Security Scanning
```bash
# Rust security audit
cargo audit

# Dependency vulnerabilities
cargo outdated

# Static analysis
cargo clippy -- -W clippy::all

# SAST (Static Application Security Testing)
cargo semgrep
```

### Penetration Testing
- OWASP ZAP
- Burp Suite
- Nikto
- SQLMap (test SQL injection)

### Monitoring
- Prometheus + Grafana
- Sentry (error tracking)
- DataDog
- New Relic

---

## 📚 Tài Liệu Tham Khảo

1. **OWASP Top 10**: https://owasp.org/www-project-top-ten/
2. **Rust Security Guidelines**: https://anssi-fr.github.io/rust-guide/
3. **JWT Best Practices**: https://tools.ietf.org/html/rfc8725
4. **Axum Security**: https://docs.rs/axum-security/
5. **NIST Password Guidelines**: https://pages.nist.gov/800-63-3/

---

## 🎯 Ưu Tiên Sửa

### Tuần 1 (Critical)
1. Đổi JWT_SECRET
2. Fix CORS configuration
3. Setup HTTPS

### Tuần 2 (High)
4. Improve file upload validation
5. Add rate limiting cho user endpoints
6. Validate webhook URLs

### Tuần 3 (Medium)
7. Strengthen password policy
8. Implement refresh tokens
9. Add comprehensive logging

### Tuần 4 (Low)
10. Security monitoring & alerts
11. Documentation
12. Penetration testing

---

## ✅ Kết Luận

**Điểm bảo mật tổng thể: 6.5/10**

Dự án có nền tảng bảo mật tốt nhờ Rust và các thư viện an toàn, nhưng cần cải thiện:
- Configuration security (JWT, CORS)
- Input validation (file uploads, webhooks)
- Rate limiting
- Monitoring & logging

Sau khi sửa các vấn đề Critical và High, điểm có thể lên 8.5/10.

---

**Người kiểm tra:** Kiro AI  
**Liên hệ:** Nếu cần giải thích chi tiết hoặc hỗ trợ implement, hãy hỏi!
