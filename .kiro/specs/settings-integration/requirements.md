# Requirements Document: Settings Integration

## Introduction

This document specifies the requirements for completing and integrating the Settings feature in both the frontend and backend of the messaging application. The Settings feature allows users to manage their profile, privacy, notifications, chat preferences, data storage, appearance, and active device sessions.

## Glossary

- **Settings_System**: The complete settings management system including frontend UI and backend API
- **Backend_API**: The Rust-based backend server that handles settings data persistence
- **Frontend_UI**: The React-based user interface for settings management
- **User_Settings**: The database table storing all user preferences
- **Device_Session**: An active login session on a specific device
- **Profile_Settings**: User profile information (name, username, bio, avatar, etc.)
- **Privacy_Settings**: Privacy controls (last seen, profile photo visibility, etc.)
- **Notification_Settings**: Notification preferences for messages and groups
- **Chat_Settings**: Chat behavior preferences (enter to send, media auto-download, etc.)
- **Data_Storage_Settings**: Storage and cache management settings
- **Appearance_Settings**: UI theme and visual preferences
- **API_Endpoint**: A REST API route that handles specific settings operations

## Requirements

### Requirement 1: Complete Backend Update Handlers

**User Story:** As a backend developer, I want complete update handlers for all settings categories, so that users can save their preferences.

#### Acceptance Criteria

1. WHEN a PUT request is made to `/settings/chat`, THE Backend_API SHALL update the chat settings and return the updated values
2. WHEN a PUT request is made to `/settings/data-storage`, THE Backend_API SHALL update the data storage settings and return the updated values
3. WHEN update requests include partial data, THE Backend_API SHALL only update the provided fields
4. WHEN update requests are successful, THE Backend_API SHALL return the complete updated settings object
5. IF an update request fails, THEN THE Backend_API SHALL return an appropriate error message

### Requirement 2: Implement Missing Service Methods

**User Story:** As a backend developer, I want complete service layer methods for updating settings, so that the API handlers can persist changes.

#### Acceptance Criteria

1. THE SettingsService SHALL implement `update_chat_settings` method that accepts partial updates
2. THE SettingsService SHALL implement `update_data_storage` method that accepts partial updates
3. WHEN service methods receive partial updates, THE SettingsService SHALL use COALESCE to preserve existing values
4. WHEN service methods complete successfully, THE SettingsService SHALL return the updated settings
5. THE SettingsService SHALL update the `updated_at` timestamp on every settings change

### Requirement 3: Add Request DTOs for Updates

**User Story:** As a backend developer, I want proper request DTOs for update operations, so that the API can validate and deserialize incoming data.

#### Acceptance Criteria

1. THE Backend_API SHALL define `UpdateChatSettingsRequest` struct with optional fields
2. THE Backend_API SHALL define `UpdateDataStorageRequest` struct with optional fields
3. WHEN request DTOs are deserialized, THE Backend_API SHALL use camelCase to snake_case conversion
4. THE Backend_API SHALL validate that at least one field is provided in update requests
5. THE Backend_API SHALL reject requests with invalid enum values

### Requirement 4: Fix Device Response Mapping

**User Story:** As a user, I want to see accurate device information in my sessions list, so that I can identify and manage my active sessions.

#### Acceptance Criteria

1. WHEN fetching devices, THE Backend_API SHALL map session data to DeviceResponse correctly
2. THE Backend_API SHALL include device name, type, location, and last active timestamp
3. THE Backend_API SHALL mark the current session with `is_current: true`
4. WHEN no device name is stored, THE Backend_API SHALL provide a default name based on device type
5. THE Backend_API SHALL order devices by last active timestamp (most recent first)

### Requirement 5: Add Missing Model Exports

**User Story:** As a backend developer, I want all settings models exported from the models module, so that they can be used throughout the application.

#### Acceptance Criteria

1. THE Backend_API SHALL export `DeviceResponse` from the models module
2. THE Backend_API SHALL export all settings-related types from the models module
3. WHEN models are imported, THE Backend_API SHALL not produce compilation errors
4. THE Backend_API SHALL maintain consistent naming between model definitions and exports

### Requirement 6: Complete Frontend Settings Page

**User Story:** As a user, I want a fully functional settings page, so that I can manage all my preferences in one place.

#### Acceptance Criteria

1. WHEN I open the settings page, THE Frontend_UI SHALL load all settings categories
2. WHEN I update any setting, THE Frontend_UI SHALL save changes to the backend immediately
3. WHEN a save operation succeeds, THE Frontend_UI SHALL show a success toast notification
4. IF a save operation fails, THEN THE Frontend_UI SHALL show an error toast and revert the change
5. THE Frontend_UI SHALL use optimistic updates for immediate visual feedback

### Requirement 7: Implement Avatar Upload

**User Story:** As a user, I want to upload a custom avatar, so that I can personalize my profile.

#### Acceptance Criteria

1. WHEN I click the camera icon on my avatar, THE Frontend_UI SHALL open a file picker
2. WHEN I select an image file, THE Frontend_UI SHALL upload it to the server
3. WHEN the upload succeeds, THE Frontend_UI SHALL update my profile with the new avatar URL
4. THE Frontend_UI SHALL show a loading indicator during upload
5. IF the upload fails, THEN THE Frontend_UI SHALL show an error message

### Requirement 8: Add Settings Validation

**User Story:** As a user, I want my settings inputs to be validated, so that I don't save invalid data.

#### Acceptance Criteria

1. WHEN I enter a username, THE Frontend_UI SHALL validate it matches the required format
2. WHEN I enter an email, THE Frontend_UI SHALL validate it is a valid email address
3. WHEN I enter a phone number, THE Frontend_UI SHALL validate it matches the expected format
4. THE Frontend_UI SHALL disable the save button when validation fails
5. THE Frontend_UI SHALL show inline validation error messages

### Requirement 9: Implement Cache Clearing

**User Story:** As a user, I want to clear cached data, so that I can free up storage space.

#### Acceptance Criteria

1. WHEN I click "Clear Cache", THE Frontend_UI SHALL call the clear cache API endpoint
2. WHEN cache clearing succeeds, THE Frontend_UI SHALL show updated storage statistics
3. WHEN cache clearing succeeds, THE Frontend_UI SHALL show a success message
4. THE Backend_API SHALL implement actual cache clearing logic (not just return current state)
5. THE Backend_API SHALL update the cache_size field to 0 after clearing

### Requirement 10: Complete Device Management

**User Story:** As a user, I want to manage my active sessions, so that I can secure my account.

#### Acceptance Criteria

1. WHEN I view the devices section, THE Frontend_UI SHALL show all my active sessions
2. WHEN I click "Terminate" on a device, THE Frontend_UI SHALL end that session
3. WHEN I click "Terminate All Other Sessions", THE Frontend_UI SHALL end all sessions except the current one
4. THE Frontend_UI SHALL prevent me from terminating my current session
5. WHEN a session is terminated, THE Frontend_UI SHALL remove it from the list immediately

### Requirement 11: Add Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened.

#### Acceptance Criteria

1. WHEN a network error occurs, THE Frontend_UI SHALL show a user-friendly error message
2. WHEN the backend returns an error, THE Frontend_UI SHALL display the error message from the response
3. WHEN an operation fails, THE Frontend_UI SHALL revert optimistic updates
4. THE Frontend_UI SHALL log errors to the console for debugging
5. THE Frontend_UI SHALL not crash when errors occur

### Requirement 12: Implement Settings Persistence

**User Story:** As a user, I want my settings to persist across sessions, so that I don't have to reconfigure them every time.

#### Acceptance Criteria

1. WHEN I change a setting, THE Backend_API SHALL persist it to the database
2. WHEN I log in, THE Frontend_UI SHALL load my saved settings
3. WHEN I refresh the page, THE Frontend_UI SHALL restore my settings from the store
4. THE Frontend_UI SHALL persist appearance settings to localStorage for offline access
5. THE Frontend_UI SHALL sync settings with the backend on every change

