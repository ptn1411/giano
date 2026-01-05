# Implementation Plan: Settings Integration

## Overview

This implementation plan breaks down the Settings Integration feature into discrete, manageable tasks. The plan follows a bottom-up approach, starting with backend completion, then frontend integration, and finally testing and validation.

## Tasks

- [x] 1. Complete Backend Settings Update Handlers
  - Add request DTOs for chat and data storage updates
  - Implement update_chat_settings handler
  - Implement update_data_storage handler
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 1.1 Write unit tests for update handlers
  - Test chat settings update with valid data
  - Test data storage update with valid data
  - Test partial updates
  - Test error cases
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement Missing Service Layer Methods
  - [x] 2.1 Implement update_chat_settings service method
    - Accept partial updates using Option types
    - Use COALESCE in SQL to preserve existing values
    - Update updated_at timestamp
    - Return updated ChatSettings
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 2.2 Implement update_data_storage service method
    - Accept partial updates using Option types
    - Use COALESCE in SQL to preserve existing values
    - Update updated_at timestamp
    - Return updated DataStorageSettings
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 2.3 Implement actual cache clearing logic
    - Clear cached files from storage
    - Reset cache_size to 0 in database
    - Return updated DataStorageSettings
    - _Requirements: 9.4, 9.5_

- [ ]* 2.4 Write unit tests for service methods
  - Test update_chat_settings with various inputs
  - Test update_data_storage with various inputs
  - Test cache clearing
  - Test partial updates preserve existing values
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Fix Device Response Mapping and Model Exports
  - [x] 3.1 Add DeviceResponse to model exports
    - Export DeviceResponse from models/settings.rs
    - Add to models/mod.rs exports
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 3.2 Fix device response mapping in service
    - Map session data to DeviceResponse correctly
    - Include device name, type, location, last_active
    - Mark current session with is_current: true
    - Provide default names for devices without names
    - Order by last_active DESC
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 3.3 Write unit tests for device mapping
  - Test device response construction
  - Test current session marking
  - Test default name generation
  - Test ordering by last_active
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4. Checkpoint - Backend Completion
  - Ensure all backend tests pass
  - Verify API endpoints work with Postman/curl
  - Ask the user if questions arise

- [x] 5. Complete Frontend Settings Page
  - [x] 5.1 Add avatar upload functionality
    - Add file input for avatar selection
    - Implement upload to /upload endpoint
    - Update profile with new avatar URL
    - Show loading indicator during upload
    - Handle upload errors
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.2 Add form validation
    - Validate username format
    - Validate email format
    - Validate phone number format
    - Disable save button when validation fails
    - Show inline validation errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 5.3 Improve error handling
    - Add try-catch blocks for all API calls
    - Display user-friendly error messages
    - Implement rollback for failed optimistic updates
    - Log errors to console
    - Prevent crashes on errors
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 5.4 Add loading states
    - Show skeleton loaders while fetching settings
    - Show spinners during save operations
    - Disable inputs during save operations
    - _Requirements: 6.1, 6.4_

- [ ]* 5.5 Write unit tests for frontend components
  - Test settings page rendering
  - Test form validation
  - Test error handling
  - Test optimistic updates
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6. Complete Settings Store Integration
  - [x] 6.1 Verify all store actions work correctly
    - Test fetchAllSettings
    - Test update methods with optimistic updates
    - Test rollback on errors
    - Test device management methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Add settings persistence
    - Verify appearance settings persist to localStorage
    - Verify settings sync with backend on changes
    - Test settings restoration on page reload
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 6.3 Write unit tests for settings store
  - Test all fetch actions
  - Test all update actions
  - Test optimistic updates and rollback
  - Test persistence
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7. Implement Device Management Features
  - [x] 7.1 Complete device list display
    - Show all active sessions
    - Display device info (name, type, location, last active)
    - Mark current session
    - _Requirements: 10.1, 10.4_

  - [x] 7.2 Implement device termination
    - Add terminate button for each device
    - Prevent terminating current session
    - Remove device from list on success
    - Show error if termination fails
    - _Requirements: 10.2, 10.4_

  - [x] 7.3 Implement terminate all other sessions
    - Add "Terminate All Other Sessions" button
    - Keep only current session
    - Update device list on success
    - _Requirements: 10.3_

- [ ]* 7.4 Write unit tests for device management
  - Test device list rendering
  - Test device termination
  - Test terminate all other sessions
  - Test current session protection
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 8. Checkpoint - Frontend Completion
  - Ensure all frontend features work
  - Test all settings sections
  - Verify error handling works
  - Ask the user if questions arise

- [x] 9. Integration Testing
  - [x] 9.1 Test complete settings update flow
    - Test profile update end-to-end
    - Test privacy settings update
    - Test notification settings update
    - Test chat settings update
    - Test data storage settings update
    - Test appearance settings update
    - _Requirements: 1.1, 1.2, 6.2, 12.1_

  - [x] 9.2 Test device management flow
    - Test fetching device list
    - Test terminating a device
    - Test terminating all other devices
    - Test current session protection
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.3 Test cache clearing flow
    - Test cache clear operation
    - Verify cache_size updates to 0
    - Verify success message displays
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 9.4 Test error scenarios
    - Test network errors
    - Test server errors
    - Test validation errors
    - Test optimistic update rollback
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 9.5 Test settings persistence
    - Test settings save to database
    - Test settings load on login
    - Test settings restore on page reload
    - Test appearance settings persist to localStorage
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 9.6 Write property-based tests
  - **Property 1: Settings Update Idempotence**
  - **Validates: Requirements 1.3, 2.3**
  - **Property 2: Optimistic Update Rollback**
  - **Validates: Requirements 6.4, 11.3**
  - **Property 3: Partial Update Preservation**
  - **Validates: Requirements 1.3, 2.3**
  - **Property 4: Device Session Consistency**
  - **Validates: Requirements 10.2, 10.3**
  - **Property 5: Current Session Protection**
  - **Validates: Requirements 10.4**
  - **Property 6: Settings Persistence**
  - **Validates: Requirements 12.1, 12.2**
  - **Property 7: Cache Clear Effectiveness**
  - **Validates: Requirements 9.4, 9.5**
  - **Property 8: Validation Rejection**
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 10. Final Checkpoint
  - Ensure all tests pass
  - Verify all requirements are met
  - Test the complete feature end-to-end
  - Ask the user for final review

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows

