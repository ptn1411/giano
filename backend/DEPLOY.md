# Hướng dẫn Deploy Backend lên Ubuntu 24.04

## Chuẩn bị SQLx Offline Data (Bắt buộc cho Cross-compile)

Trước khi cross-compile từ Windows, bạn cần tạo SQLx offline data để build không cần kết nối database:

```bash
# Cài đặt sqlx-cli
cargo install sqlx-cli

# Đảm bảo database đang chạy và .env có DATABASE_URL đúng
# Chạy migrations trước
cargo sqlx migrate run

# Tạo offline data
cargo sqlx prepare

# Commit folder .sqlx vào git
git add .sqlx
git commit -m "Add SQLx offline data"
```

Folder `.sqlx` chứa metadata của tất cả SQL queries, cho phép build mà không cần kết nối database.

---

## Cách 1: Cross-compile từ Windows (cần Docker)

### Yêu cầu trên Windows:
- Rust (rustup)
- Docker Desktop đang chạy

### Bước thực hiện:

```powershell
# Chạy trong thư mục backend/
.\cross-build-windows.ps1
```

### Copy lên server:
```powershell
# Copy binary
scp -r backend/migrations/* root@159.223.47.17:/var/www/messages-api/migrations/


scp .\target\x86_64-unknown-linux-gnu\release\chat-backend user@your-server:/home/user/chat-app/

# Copy env file
scp .env.prod user@your-server:/home/user/chat-app/.env

# Copy migrations
scp -r migrations user@your-server:/home/user/chat-app/
```

---

## Cách 2: Build trực tiếp trên Ubuntu (khuyến nghị)

### Bước 1: Copy source code lên server

```powershell
# Từ Windows, copy toàn bộ thư mục backend
scp -r backend user@your-server:/home/user/chat-app/
```

### Bước 2: SSH vào server và build

```bash
ssh user@your-server

cd /home/user/chat-app/backend

# Cấp quyền execute cho script
chmod +x build-ubuntu.sh deploy-ubuntu.sh

# Chạy build script
./build-ubuntu.sh
```

### Bước 3: Deploy như service

```bash
./deploy-ubuntu.sh
```

---

## Cách 3: Sử dụng Docker (đơn giản nhất)

### Tạo Dockerfile:

```dockerfile
FROM rust:1.75-slim-bookworm as builder

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y libpq-dev pkg-config libssl-dev
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libpq5 ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/chat-backend /usr/local/bin/
COPY --from=builder /app/migrations /app/migrations

WORKDIR /app
CMD ["chat-backend"]
```

### Build và chạy:

```bash
docker build -t chat-backend .
docker run -d --name chat-backend \
  --env-file .env.prod \
  -p 3000:3000 \
  chat-backend
```

---

## Cấu hình PostgreSQL trên Ubuntu

```bash
# Cài đặt PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Tạo user và database
sudo -u postgres psql

# Trong psql:
CREATE USER messages_user WITH PASSWORD 'Ptn141122@';
CREATE DATABASE messages_db OWNER messages_user;
GRANT ALL PRIVILEGES ON DATABASE messages_db TO messages_user;
\q

# Cho phép kết nối từ localhost
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Thêm dòng: local all messages_user md5

sudo systemctl restart postgresql
```

---

## Cấu hình Redis trên Ubuntu

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Test
redis-cli ping
# Phải trả về: PONG
```

---

## Kiểm tra sau khi deploy

```bash
# Kiểm tra service
sudo systemctl status chat-backend

# Xem logs
sudo journalctl -u chat-backend -f

# Test API
curl http://localhost:3000/api/v1/health

# Test từ bên ngoài (nếu đã mở firewall)
curl http://your-server-ip:3000/api/v1/health
```

---

## Mở firewall (nếu cần)

```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

---

## Cấu hình Nginx (reverse proxy)

```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/chat-backend
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/chat-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
