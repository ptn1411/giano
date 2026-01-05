# Kiểm Tra Settings API

## Trạng Thái Hiện Tại

✅ **Backend đang chạy** - Server hoạt động tại `http://localhost:3000`

## Các API Endpoints Đã Được Triển Khai

### 1. Profile Settings
- ✅ `GET /settings/profile` - Lấy thông tin profile
- ✅ `PUT /settings/profile` - Cập nhật profile

### 2. Privacy Settings
- ✅ `GET /settings/privacy` - Lấy cài đặt privacy
- ✅ `PUT /settings/privacy` - Cập nhật privacy

### 3. Notification Settings
- ✅ `GET /settings/notifications` - Lấy cài đặt thông báo
- ✅ `PUT /settings/notifications` - Cập nhật thông báo

### 4. Chat Settings
- ✅ `GET /settings/chat` - Lấy cài đặt chat
- ✅ `PUT /settings/chat` - Cập nhật chat settings

### 5. Data Storage Settings
- ✅ `GET /settings/data-storage` - Lấy cài đặt lưu trữ
- ✅ `PUT /settings/data-storage` - Cập nhật lưu trữ
- ✅ `POST /settings/clear-cache` - Xóa cache

### 6. Appearance Settings
- ✅ `GET /settings/appearance` - Lấy cài đặt giao diện
- ✅ `PUT /settings/appearance` - Cập nhật giao diện

### 7. Device Management
- ✅ `GET /settings/devices` - Lấy danh sách thiết bị
- ✅ `DELETE /settings/devices/:id` - Xóa một thiết bị
- ✅ `DELETE /settings/devices` - Xóa tất cả thiết bị khác

## Cách Kiểm Tra

### Bước 1: Đăng nhập để lấy token

```bash
# Đăng ký tài khoản mới (nếu chưa có)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser\",\"name\":\"Test User\",\"password\":\"test123\"}"

# Đăng nhập
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser\",\"password\":\"test123\"}"
```

Lưu token từ response để sử dụng cho các request tiếp theo.

### Bước 2: Kiểm tra Profile Settings

```bash
# Lấy profile hiện tại
curl -X GET http://localhost:3000/settings/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Cập nhật profile
curl -X PUT http://localhost:3000/settings/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Updated Name\",\"bio\":\"My new bio\"}"
```

### Bước 3: Kiểm tra Chat Settings

```bash
# Lấy chat settings
curl -X GET http://localhost:3000/settings/chat \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Cập nhật chat settings
curl -X PUT http://localhost:3000/settings/chat \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d "{\"sendByEnter\":false,\"mediaAutoDownload\":\"always\"}"
```

### Bước 4: Kiểm tra Device Management

```bash
# Lấy danh sách thiết bị
curl -X GET http://localhost:3000/settings/devices \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Kiểm Tra Từ Frontend

### Bước 1: Mở ứng dụng
1. Truy cập `http://localhost:5173` (hoặc port frontend của bạn)
2. Đăng nhập vào tài khoản

### Bước 2: Vào trang Settings
1. Click vào icon Settings hoặc menu
2. Kiểm tra các tab:
   - ✅ Account & Profile
   - ✅ Privacy & Security
   - ✅ Notifications
   - ✅ Chat Settings
   - ✅ Data & Storage
   - ✅ Appearance
   - ✅ Devices & Sessions

### Bước 3: Thử các chức năng
1. **Profile**: Thay đổi tên, bio, email
2. **Privacy**: Thay đổi cài đặt last seen, profile photo
3. **Notifications**: Bật/tắt thông báo
4. **Chat**: Thay đổi send by enter, auto download
5. **Appearance**: Đổi theme (light/dark), màu accent
6. **Devices**: Xem danh sách thiết bị, xóa session

### Bước 4: Kiểm tra Persistence
1. Thay đổi một số settings
2. Refresh trang (F5)
3. Kiểm tra xem settings có được giữ lại không

## Kết Quả Mong Đợi

### ✅ Backend
- Tất cả API endpoints hoạt động
- Dữ liệu được lưu vào database
- Partial updates hoạt động đúng
- Error handling đúng

### ✅ Frontend
- UI hiển thị đầy đủ các settings
- Optimistic updates hoạt động
- Rollback khi có lỗi
- Toast notifications hiển thị
- Settings persist sau khi reload

### ✅ Integration
- Frontend gọi đúng API endpoints
- Dữ liệu sync giữa frontend và backend
- Appearance settings lưu vào localStorage
- Device management hoạt động đúng

## Các Vấn Đề Có Thể Gặp

### 1. Backend không chạy
**Giải pháp**: 
```bash
cd backend
cargo run
```

### 2. Frontend không kết nối được backend
**Giải pháp**: Kiểm tra file `src/lib/config.ts` xem API_URL có đúng không

### 3. Settings không persist
**Giải pháp**: 
- Kiểm tra database có chạy không
- Kiểm tra migrations đã chạy chưa
- Xem console log có lỗi không

### 4. Token hết hạn
**Giải pháp**: Đăng nhập lại để lấy token mới

## Tài Liệu Tham Khảo

- **Integration Tests**: `.kiro/specs/settings-integration/integration-tests.md`
- **Test Execution Guide**: `.kiro/specs/settings-integration/TEST_EXECUTION_GUIDE.md`
- **Requirements**: `.kiro/specs/settings-integration/requirements.md`
- **Design**: `.kiro/specs/settings-integration/design.md`

## Kết Luận

✅ **Backend**: Đã triển khai đầy đủ tất cả endpoints
✅ **Frontend**: Đã có UI và store hoàn chỉnh
✅ **Integration**: Đã có test suite đầy đủ

**Trạng thái**: Settings feature đã sẵn sàng sử dụng! 🎉

Để kiểm tra chi tiết, hãy:
1. Mở frontend và thử các chức năng
2. Hoặc dùng curl/Postman để test API
3. Hoặc chạy integration tests
