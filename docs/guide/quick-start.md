---
title: Quick Start
---

# Quick Start

Hướng dẫn nhanh để chạy GIANO trên máy local.

## Yêu cầu

- Node.js >= 18
- Rust >= 1.70
- PostgreSQL
- Redis (optional)

## 1. Clone repository

```bash
git clone https://github.com/ptn1411/giano.git
cd giano
```

## 2. Chạy Frontend

```bash
npm install
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`

## 3. Chạy Backend

```bash
cd backend
cp .env.example .env
# Cấu hình database trong .env
cargo run
```

Backend API sẽ chạy tại `http://localhost:3000`

## 4. Chạy Media Server (Optional)

Nếu cần tính năng voice/video call:

```bash
cd media-server
npm install
npm run dev
```

## 5. Truy cập ứng dụng

Mở trình duyệt và truy cập `http://localhost:5173`

## Tiếp theo

- [Cài đặt IDE](/guide/ide-setup) - Cấu hình môi trường phát triển
- [Tính năng](/features/) - Khám phá các tính năng của GIANO
- [Bot SDK](/bots/) - Xây dựng bot cho GIANO
