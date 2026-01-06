# 🚀 GIANO – Chat đúng nghĩa cho thời đại real-time

Trong khi nhiều ứng dụng chat ngày càng nặng nề, nhiều quảng cáo và khó mở rộng, **GIANO** được xây dựng với một triết lý rất rõ ràng:

> 👉 **Chat phải nhanh. Gọn. Realtime. Và tôn trọng người dùng.**

Không màu mè. Không rườm rà. Tập trung vào trải nghiệm giao tiếp thật sự.

---

## 🧠 Công nghệ phía sau GIANO

GIANO không phải một app chat thông thường, mà là một **real-time communication platform** được xây dựng theo hướng **dev-first**:

### ⚙️ Backend
- **Rust** – hiệu năng cao, an toàn bộ nhớ
- **WebSocket** – giao tiếp realtime, độ trễ thấp
- Thiết kế async, sẵn sàng scale

### 🎨 Frontend
- **ReactJS** – kiến trúc component rõ ràng
- **TailwindCSS** – UI gọn, load nhanh, không phụ thuộc framework nặng

### 📡 Realtime & Media
- **Mediasoup** – nền tảng WebRTC cho voice / video / group call
- **QUIC** – kết nối hiện đại, giảm latency, ổn định hơn TCP

---

## 🔐 Triết lý cốt lõi

| | |
|---|---|
| ⚡ | **Fast by design** |
| 🔒 | **Privacy first** |
| 🧩 | **Dễ mở rộng** – dễ tích hợp bot & API |
| 🧠 | **Viết bởi dev, cho dev** |

---

## 🎯 GIANO dành cho ai?

- **Developer** cần một nền tảng chat có thể hack, mở rộng, làm bot
- **Team startup** cần hạ tầng realtime cho sản phẩm
- **Người dùng** ghét app chat nặng, nhiều quảng cáo

---

## ✨ Tầm nhìn

GIANO không cố gắng trở thành "Zalo thứ hai".

GIANO được xây dựng để trở thành một nền tảng chat **gọn – nhanh – hiện đại**, đúng nghĩa realtime.

---

## 🌐 Trải nghiệm ngay

👉 **[https://giano.bug.edu.vn](https://giano.bug.edu.vn)**

---

## 📦 Cấu trúc dự án

```
giano/
├── src/                 # Frontend React
├── backend/             # Backend Rust API
├── media-server/        # Mediasoup SFU server
└── bot-sdk-typescript/  # SDK cho bot development
```

## 🚀 Quick Start

```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
cargo run

# Media Server
cd media-server
npm install
npm run dev
```

---

Made with ❤️ by GIANO Team
