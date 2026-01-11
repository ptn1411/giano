# Tính năng Upload File Ghi Âm lên Server

## Tổng quan
Đã cập nhật tính năng ghi âm để upload file lên server thay vì chỉ gửi Blob trực tiếp.

## Các thay đổi

### 1. VoiceRecorder Component (`src/components/chat/VoiceRecorder.tsx`)

#### Thay đổi Interface
```typescript
// Trước
interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

// Sau
interface VoiceRecorderProps {
  onSend: (text: string, attachments?: Attachment[]) => void;
  onCancel: () => void;
}
```

#### Thêm State mới
- `isUploading`: Trạng thái đang upload
- `uploadProgress`: Phần trăm tiến trình upload (0-100)
- `uploadError`: Thông báo lỗi nếu upload thất bại

#### Cập nhật handleSend Function
```typescript
const handleSend = useCallback(async () => {
  if (!audioBlob) return;
  
  setIsUploading(true);
  setUploadError(null);
  setUploadProgress(0);
  
  try {
    // Convert Blob to File
    const fileName = `voice-${Date.now()}.${audioBlob.type.includes('webm') ? 'webm' : 'mp4'}`;
    const audioFile = new File([audioBlob], fileName, { type: audioBlob.type });
    
    // Upload to server
    const result = await uploadService.uploadFile(
      audioFile,
      'voice',
      (progress) => {
        setUploadProgress(progress.percentage);
      }
    );
    
    if (result.success && result.attachment) {
      // Send message with uploaded attachment
      const voiceAttachment: Attachment = {
        id: result.attachment.id,
        type: 'file',
        name: result.attachment.name,
        size: result.attachment.size,
        url: result.attachment.url,
        mimeType: result.attachment.mimeType,
        duration,
      };
      
      onSend('', [voiceAttachment]);
      cleanup();
    } else {
      setUploadError(result.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Error uploading voice message:', error);
    setUploadError('Failed to upload voice message');
  } finally {
    setIsUploading(false);
  }
}, [audioBlob, duration, onSend, cleanup]);
```

#### UI Improvements
- Hiển thị progress bar khi đang upload
- Hiển thị loading spinner trên nút Send
- Hiển thị thông báo lỗi nếu upload thất bại
- Disable các nút khi đang upload

### 2. MessageInput Component (`src/components/chat/MessageInput.tsx`)

#### Cập nhật handleVoiceSend
```typescript
// Trước
const handleVoiceSend = useCallback((audioBlob: Blob, duration: number) => {
  const audioUrl = URL.createObjectURL(audioBlob);
  const voiceAttachment: Attachment = {
    id: `voice-${Date.now()}`,
    type: 'file',
    name: 'Voice message',
    size: audioBlob.size,
    url: audioUrl,
    mimeType: audioBlob.type,
    duration,
  };
  onSend('', [voiceAttachment], replyingTo ? {...} : undefined);
  setIsRecordingVoice(false);
  onCancelReply?.();
}, [onSend, replyingTo, onCancelReply]);

// Sau
const handleVoiceSend = useCallback((text: string, attachments?: Attachment[]) => {
  onSend(text, attachments, replyingTo ? {...} : undefined);
  setIsRecordingVoice(false);
  onCancelReply?.();
}, [onSend, replyingTo, onCancelReply]);
```

## Backend Support

Backend đã hỗ trợ upload file audio với các định dạng:
- mp3
- wav
- ogg
- m4a
- webm (từ MediaRecorder API)

Route: `POST /api/v1/upload`
- Max file size: 500MB
- Validation: Magic bytes checking
- Storage: Local filesystem (`uploads/` directory)

## Luồng hoạt động

1. User nhấn nút Mic để bắt đầu ghi âm
2. VoiceRecorder component sử dụng MediaRecorder API để ghi âm
3. User nhấn Stop để dừng ghi âm
4. Audio preview hiển thị với audio player
5. User nhấn Send:
   - Convert Blob thành File object
   - Upload file lên server qua `uploadService.uploadFile()`
   - Hiển thị progress bar trong quá trình upload
   - Nhận response với attachment info (id, url, name, size, mimeType)
   - Gửi message với attachment đã upload
6. Nếu upload thất bại, hiển thị error message

## Testing

Để test tính năng:
1. Mở chat
2. Nhấn nút Mic (khi không có text)
3. Cho phép truy cập microphone
4. Nhấn nút Mic đỏ để bắt đầu ghi
5. Nhấn nút Stop để dừng
6. Nghe lại audio preview
7. Nhấn Send và quan sát:
   - Progress bar hiển thị
   - Loading spinner trên nút Send
   - Message được gửi với file đã upload lên server

## Lợi ích

1. **Persistent Storage**: File được lưu trên server, không mất khi reload page
2. **Sharing**: URL có thể chia sẻ và truy cập từ nhiều client
3. **Bandwidth**: Chỉ upload một lần, nhiều người có thể download
4. **Security**: Server có thể validate và scan file
5. **Backup**: File được backup cùng với server data
