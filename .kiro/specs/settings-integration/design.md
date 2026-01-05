# Design Document: Settings Integration

## Overview

This design document describes the completion and integration of the Settings feature for both frontend and backend. The system allows users to manage their profile, privacy, notifications, chat preferences, data storage, appearance, and device sessions through a comprehensive settings interface.

The implementation focuses on:
1. Completing missing backend update handlers
2. Implementing service layer methods for settings updates
3. Adding proper request DTOs and validation
4. Fixing device response mapping
5. Completing the frontend settings UI
6. Implementing avatar upload functionality
7. Adding proper error handling and validation

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Settings Page  │──│ Settings     │──│ Settings API    │ │
│  │ (UI Component) │  │ Store        │  │ Service         │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP/REST
┌──────────────────────────────┴──────────────────────────────┐
│                     Backend (Rust/Axum)                      │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Settings       │──│ Settings     │──│ Database        │ │
│  │ Routes         │  │ Service      │  │ (PostgreSQL)    │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Settings Load**: Frontend → API GET → Service → Database → Response
2. **Settings Update**: Frontend → API PUT → Service → Database → Response
3. **Optimistic Update**: Frontend updates UI immediately, then syncs with backend
4. **Error Rollback**: If backend fails, frontend reverts to previous state

## Components and Interfaces

### Backend Components

#### 1. Settings Routes (`backend/src/routes/settings.rs`)

**Purpose**: Handle HTTP requests for settings operations

**Endpoints**:
- `GET /settings/profile` - Get user profile
- `PUT /settings/profile` - Update user profile
- `GET /settings/privacy` - Get privacy settings
- `PUT /settings/privacy` - Update privacy settings
- `GET /settings/notifications` - Get notification settings
- `PUT /settings/notifications` - Update notification settings
- `GET /settings/chat` - Get chat settings
- `PUT /settings/chat` - Update chat settings
- `GET /settings/data-storage` - Get data storage settings
- `PUT /settings/data-storage` - Update data storage settings
- `POST /settings/clear-cache` - Clear cached data
- `GET /settings/appearance` - Get appearance settings
- `PUT /settings/appearance` - Update appearance settings
- `GET /settings/devices` - Get active device sessions
- `DELETE /settings/devices/:id` - Terminate specific device session
- `DELETE /settings/devices` - Terminate all other device sessions

**Request DTOs**:

```rust
// Chat Settings Update
#[derive(Debug, Deserialize)]
pub struct UpdateChatSettingsRequest {
    #[serde(rename = "sendByEnter")]
    send_by_enter: Option<bool>,
    #[serde(rename = "mediaAutoDownload")]
    media_auto_download: Option<String>,
    #[serde(rename = "saveToGallery")]
    save_to_gallery: Option<bool>,
    #[serde(rename = "autoPlayGifs")]
    auto_play_gifs: Option<bool>,
    #[serde(rename = "autoPlayVideos")]
    auto_play_videos: Option<bool>,
    #[serde(rename = "raiseToSpeak")]
    raise_to_speak: Option<bool>,
}

// Data Storage Update
#[derive(Debug, Deserialize)]
pub struct UpdateDataStorageRequest {
    #[serde(rename = "keepMedia")]
    keep_media: Option<String>,
    #[serde(rename = "autoDownloadPhotos")]
    auto_download_photos: Option<bool>,
    #[serde(rename = "autoDownloadVideos")]
    auto_download_videos: Option<bool>,
    #[serde(rename = "autoDownloadFiles")]
    auto_download_files: Option<bool>,
    #[serde(rename = "dataSaver")]
    data_saver: Option<bool>,
}
```

#### 2. Settings Service (`backend/src/services/settings.rs`)

**Purpose**: Business logic for settings operations

**Methods to Implement**:

```rust
impl SettingsService {
    // Update chat settings
    pub async fn update_chat_settings(
        db: &Database,
        user_id: Uuid,
        send_by_enter: Option<bool>,
        media_auto_download: Option<String>,
        save_to_gallery: Option<bool>,
        auto_play_gifs: Option<bool>,
        auto_play_videos: Option<bool>,
        raise_to_speak: Option<bool>,
    ) -> AppResult<ChatSettings>;

    // Update data storage settings
    pub async fn update_data_storage(
        db: &Database,
        user_id: Uuid,
        keep_media: Option<String>,
        auto_download_photos: Option<bool>,
        auto_download_videos: Option<bool>,
        auto_download_files: Option<bool>,
        data_saver: Option<bool>,
    ) -> AppResult<DataStorageSettings>;

    // Clear cache (implement actual logic)
    pub async fn clear_cache(
        db: &Database,
        user_id: Uuid,
    ) -> AppResult<DataStorageSettings>;
}
```

#### 3. Models (`backend/src/models/settings.rs`)

**Purpose**: Data structures for settings

**Add DeviceResponse Export**:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceResponse {
    pub id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub device_type: String,
    pub location: String,
    #[serde(rename = "lastActive")]
    pub last_active: DateTime<Utc>,
    #[serde(rename = "isCurrent")]
    pub is_current: bool,
}
```

### Frontend Components

#### 1. Settings Page (`src/pages/Settings.tsx`)

**Purpose**: Main settings UI component

**Sections**:
- Main menu (navigation to subsections)
- Account & Profile (edit profile information)
- Privacy & Security (privacy controls)
- Notifications (notification preferences)
- Chat Settings (chat behavior)
- Data & Storage (storage management)
- Appearance (theme and colors)
- Devices & Sessions (session management)

**Key Features**:
- Section-based navigation
- Optimistic updates
- Error handling with rollback
- Toast notifications for feedback
- Loading states
- Form validation

#### 2. Settings Store (`src/stores/settingsStore.ts`)

**Purpose**: State management for settings

**State**:
- All settings categories (profile, privacy, notifications, etc.)
- Loading states per category
- Error state
- Devices list

**Actions**:
- Fetch methods for each category
- Update methods with optimistic updates
- Device management methods
- Cache clearing
- Reset method

#### 3. Settings API Service (`src/services/api/settings.ts`)

**Purpose**: API client for settings endpoints

**Methods**:
- `getProfile()` - Fetch profile settings
- `updateProfile(updates)` - Update profile
- `getPrivacy()` - Fetch privacy settings
- `updatePrivacy(updates)` - Update privacy
- `getNotifications()` - Fetch notification settings
- `updateNotifications(updates)` - Update notifications
- `getChatSettings()` - Fetch chat settings
- `updateChatSettings(updates)` - Update chat settings
- `getDataStorage()` - Fetch data storage settings
- `updateDataStorage(updates)` - Update data storage
- `getAppearance()` - Fetch appearance settings
- `updateAppearance(updates)` - Update appearance
- `clearCache()` - Clear cache
- `getDevices()` - Fetch device list
- `terminateDevice(id)` - Terminate device
- `terminateAllOtherDevices()` - Terminate all others

## Data Models

### Database Schema

The `user_settings` table already exists with all required fields:

```sql
CREATE TABLE user_settings (
    id UUID PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    
    -- Privacy
    last_seen_visibility VARCHAR(20) DEFAULT 'everyone',
    profile_photo_visibility VARCHAR(20) DEFAULT 'everyone',
    calls_visibility VARCHAR(20) DEFAULT 'contacts',
    groups_visibility VARCHAR(20) DEFAULT 'contacts',
    forwards_enabled BOOLEAN DEFAULT TRUE,
    read_receipts_enabled BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    
    -- Notifications
    message_notifications BOOLEAN DEFAULT TRUE,
    group_notifications BOOLEAN DEFAULT TRUE,
    channel_notifications BOOLEAN DEFAULT TRUE,
    in_app_sounds BOOLEAN DEFAULT TRUE,
    in_app_vibrate BOOLEAN DEFAULT TRUE,
    in_app_preview BOOLEAN DEFAULT TRUE,
    contact_joined_notify BOOLEAN DEFAULT FALSE,
    
    -- Chat
    send_by_enter BOOLEAN DEFAULT TRUE,
    media_auto_download VARCHAR(20) DEFAULT 'wifi',
    save_to_gallery BOOLEAN DEFAULT FALSE,
    auto_play_gifs BOOLEAN DEFAULT TRUE,
    auto_play_videos BOOLEAN DEFAULT TRUE,
    raise_to_speak BOOLEAN DEFAULT FALSE,
    
    -- Data Storage
    keep_media VARCHAR(20) DEFAULT '1month',
    auto_download_photos BOOLEAN DEFAULT TRUE,
    auto_download_videos BOOLEAN DEFAULT FALSE,
    auto_download_files BOOLEAN DEFAULT FALSE,
    data_saver BOOLEAN DEFAULT FALSE,
    
    -- Appearance
    theme VARCHAR(20) DEFAULT 'system',
    accent_color VARCHAR(20) DEFAULT '#6366f1',
    font_size VARCHAR(20) DEFAULT 'medium',
    chat_background VARCHAR(50) DEFAULT 'default',
    bubble_style VARCHAR(20) DEFAULT 'rounded',
    animations_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### TypeScript Types

```typescript
export interface ProfileSettings {
  name: string;
  username: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  email?: string;
}

export interface PrivacySettings {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  calls: 'everyone' | 'contacts' | 'nobody';
  groups: 'everyone' | 'contacts' | 'nobody';
  forwards: boolean;
  readReceipts: boolean;
  twoFactorAuth: boolean;
}

export interface NotificationSettings {
  messageNotifications: boolean;
  groupNotifications: boolean;
  channelNotifications: boolean;
  inAppSounds: boolean;
  inAppVibrate: boolean;
  inAppPreview: boolean;
  contactJoined: boolean;
}

export interface ChatSettings {
  sendByEnter: boolean;
  mediaAutoDownload: 'wifi' | 'always' | 'never';
  saveToGallery: boolean;
  autoPlayGifs: boolean;
  autoPlayVideos: boolean;
  raiseToSpeak: boolean;
}

export interface DataStorageSettings {
  storageUsed: number;
  cacheSize: number;
  keepMedia: '1week' | '1month' | '3months' | 'forever';
  autoDownloadPhotos: boolean;
  autoDownloadVideos: boolean;
  autoDownloadFiles: boolean;
  dataSaver: boolean;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  chatBackground: string;
  bubbleStyle: 'rounded' | 'square';
  animationsEnabled: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'web';
  location: string;
  lastActive: string;
  isCurrent: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Settings Update Idempotence
*For any* settings update operation, applying the same update twice should result in the same final state as applying it once.
**Validates: Requirements 1.3, 2.3**

### Property 2: Optimistic Update Rollback
*For any* failed settings update, the frontend state should match the backend state after rollback.
**Validates: Requirements 6.4, 11.3**

### Property 3: Partial Update Preservation
*For any* partial settings update, all fields not included in the update should retain their previous values.
**Validates: Requirements 1.3, 2.3**

### Property 4: Device Session Consistency
*For any* device termination operation, the terminated device should not appear in subsequent device list queries.
**Validates: Requirements 10.2, 10.3**

### Property 5: Current Session Protection
*For any* device termination request, if the device ID matches the current session, the operation should fail.
**Validates: Requirements 10.4**

### Property 6: Settings Persistence
*For any* settings update that succeeds, querying the same settings should return the updated values.
**Validates: Requirements 12.1, 12.2**

### Property 7: Cache Clear Effectiveness
*For any* cache clear operation that succeeds, the cache_size field should be 0 in subsequent queries.
**Validates: Requirements 9.4, 9.5**

### Property 8: Validation Rejection
*For any* invalid settings value (e.g., invalid email format), the update operation should be rejected.
**Validates: Requirements 8.1, 8.2, 8.3**

## Error Handling

### Backend Error Handling

**Error Types**:
1. **Validation Errors**: Invalid input data (400 Bad Request)
2. **Authentication Errors**: Missing or invalid token (401 Unauthorized)
3. **Authorization Errors**: Cannot terminate current session (403 Forbidden)
4. **Not Found Errors**: Device or settings not found (404 Not Found)
5. **Database Errors**: Database operation failures (500 Internal Server Error)

**Error Response Format**:
```json
{
  "error": "Error message describing what went wrong"
}
```

### Frontend Error Handling

**Error Handling Strategy**:
1. **Network Errors**: Show "Connection failed" message
2. **Server Errors**: Display error message from response
3. **Validation Errors**: Show inline validation messages
4. **Optimistic Update Failures**: Revert UI to previous state
5. **Unexpected Errors**: Log to console and show generic error

**Error Display**:
- Toast notifications for operation results
- Inline validation messages for form fields
- Error state in settings store
- Console logging for debugging

## Testing Strategy

### Unit Tests

**Backend Tests**:
1. Test settings service methods with valid inputs
2. Test settings service methods with partial updates
3. Test settings service methods with invalid inputs
4. Test device termination logic
5. Test cache clearing logic
6. Test error handling for each endpoint

**Frontend Tests**:
1. Test settings store actions
2. Test optimistic updates and rollback
3. Test API service methods
4. Test form validation logic
5. Test error handling in components

### Integration Tests

1. Test complete settings update flow (frontend → backend → database)
2. Test device management flow
3. Test cache clearing flow
4. Test error scenarios end-to-end
5. Test settings persistence across page reloads

### Property-Based Tests

1. **Property 1**: Test idempotence of settings updates
2. **Property 2**: Test optimistic update rollback
3. **Property 3**: Test partial update preservation
4. **Property 4**: Test device session consistency
5. **Property 5**: Test current session protection
6. **Property 6**: Test settings persistence
7. **Property 7**: Test cache clear effectiveness
8. **Property 8**: Test validation rejection

Each property test should run a minimum of 100 iterations with randomized inputs to ensure comprehensive coverage.

## Implementation Notes

### Backend Implementation

1. **Complete Update Handlers**: Implement missing `update_chat_settings` and `update_data_storage` handlers in `routes/settings.rs`
2. **Add Request DTOs**: Define `UpdateChatSettingsRequest` and `UpdateDataStorageRequest` structs
3. **Implement Service Methods**: Add `update_chat_settings` and `update_data_storage` methods in `services/settings.rs`
4. **Fix Device Mapping**: Ensure `DeviceResponse` is properly constructed from `Session` data
5. **Export Models**: Add `DeviceResponse` to model exports in `models/mod.rs`
6. **Implement Cache Clearing**: Add actual cache clearing logic (currently just returns current state)

### Frontend Implementation

1. **Complete Settings Page**: Ensure all sections are fully functional
2. **Add Avatar Upload**: Implement file picker and upload logic
3. **Add Form Validation**: Implement validation for username, email, phone
4. **Improve Error Handling**: Add comprehensive error handling with rollback
5. **Add Loading States**: Show loading indicators during operations
6. **Test All Flows**: Verify all settings can be updated and persisted

### Database Considerations

- The `user_settings` table already exists with all required fields
- No migrations needed
- Ensure indexes are in place for performance
- Consider adding a trigger to auto-update `updated_at` timestamp

### Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only access their own settings
3. **Session Protection**: Cannot terminate current session
4. **Input Validation**: Validate all user inputs on backend
5. **SQL Injection**: Use parameterized queries (already handled by sqlx)

