---
layout: home

hero:
  name: "GIANO"
  text: "Chat đúng nghĩa cho thời đại real-time"
  tagline: Nhanh. Gọn. Realtime. Và tôn trọng người dùng.
  image:
    src: /logo.svg
    alt: GIANO
  actions:
    - theme: brand
      text: Bắt đầu ngay
      link: /guide/
    - theme: alt
      text: Xem Demo
      link: https://giano.bug.edu.vn

features:
  - icon: ⚡
    title: Fast by Design
    details: Backend Rust + WebSocket cho độ trễ thấp nhất. QUIC protocol cho kết nối ổn định.
  - icon: 🔒
    title: Privacy First
    details: End-to-end encryption, không tracking, không quảng cáo. Dữ liệu của bạn thuộc về bạn.
  - icon: 🧩
    title: Dễ mở rộng
    details: Bot SDK mạnh mẽ, API RESTful đầy đủ, MCP Bridge cho AI integration.
  - icon: 🎥
    title: Voice & Video
    details: Mediasoup WebRTC SFU cho cuộc gọi nhóm chất lượng cao, độ trễ thấp.
---

## 🚀 Quick Start

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
cargo run
```

### Media Server

```bash
cd media-server
npm install
npm run dev
```

## 📦 Cấu trúc dự án

```
giano/
├── src/                 # Frontend React
├── backend/             # Backend Rust API
├── media-server/        # Mediasoup SFU server
├── bot-sdk-typescript/  # SDK cho bot development
└── docs/                # Documentation (bạn đang đây!)
```
