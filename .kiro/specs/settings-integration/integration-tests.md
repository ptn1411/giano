# Settings Integration Tests

This document provides comprehensive integration testing procedures for the Settings Integration feature.

## Test Environment Setup

### Prerequisites
- Backend server running on `http://localhost:3000`
- Frontend development server running
- Valid user account with authentication token
- PostgreSQL database with migrations applied

### Test Data Setup
1. Create a test user account
2. Log in to obtain authentication token
3. Ensure user has default settings initialized

## Task 9.1: Test Complete Settings Update Flow

### Requirements: 1.1, 1.2, 6.2, 12.1

### Test 1: Profile Update End-to-End

**Objective**: Verify profile settings can be updated and persisted

**Steps**:
1. GET `/settings/profile` to fetch current profile
2. Note current values
3. PUT `/settings/profile` with updated values:
   ```json
   {
     "name": "Updated Name",
     "username": "updated_username",
     "bio": "Updated bio",
     "phone": "+1234567890",
     "email": "updated@example.com"
   }
   ```
4. Verify response contains updated values
5. GET `/settings/profile` again to verify persistence
6. Refresh browser page and verify settings are still updated

**Expected Results**:
- ✅ PUT request returns 200 OK
- ✅ Response contains all updated fields
- ✅ Subsequent GET returns same updated values
- ✅ Settings persist across page reloads

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 2: Privacy Settings Update

**Objective**: Verify privacy settings can be updated and persisted

**Steps**:
1. GET `/settings/privacy` to fetch current settings
2. PUT `/settings/privacy` with updated values:
   ```json
   {
     "lastSeen": "contacts",
     "profilePhoto": "nobody",
     "calls": "contacts",
     "groups": "contacts",
     "forwards": false,
     "readReceipts": false,
     "twoFactorAuth": true
   }
   ```
3. Verify response contains updated values
4. GET `/settings/privacy` again to verify persistence

**Expected Results**:
- ✅ PUT request returns 200 OK
- ✅ All privacy settings are updated correctly
- ✅ Settings persist in database

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 3: Notification Settings Update

**Objective**: Verify notification settings can be updated and persisted

**Steps**:
1. GET `/settings/notifications` to fetch current settings
2. PUT `/settings/notifications` with updated values:
   ```json
   {
     "messageNotifications": false,
     "groupNotifications": false,
     "channelNotifications": true,
     "inAppSounds": false,
     "inAppVibrate": false,
     "inAppPreview": true,
     "contactJoined": true
   }
   ```
3. Verify response contains updated values
4. GET `/settings/notifications` again to verify persistence

**Expected Results**:
- ✅ PUT request returns 200 OK
- ✅ All notification settings are updated correctly
- ✅ Settings persist in database

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 4: Chat Settings Update

**Objective**: Verify chat settings can be updated and persisted

**Steps**:
1. GET `/settings/chat` to fetch current settings
2. PUT `/settings/chat` with updated values:
   ```json
   {
     "sendByEnter": false,
     "mediaAutoDownload": "always",
     "saveToGallery": true,
     "autoPlayGifs": false,
     "autoPlayVideos": false,
     "raiseToSpeak": true
   }
   ```
3. Verify response contains updated values
4. GET `/settings/chat` again to verify persistence

**Expected Results**:
- ✅ PUT request returns 200 OK
- ✅ All chat settings are updated correctly
- ✅ Settings persist in database

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 5: Data Storage Settings Update

**Objective**: Verify data storage settings can be updated and persisted

**Steps**:
1. GET `/settings/data-storage` to fetch current settings
2. PUT `/settings/data-storage` with updated values:
   ```json
   {
     "keepMedia": "3months",
     "autoDownloadPhotos": false,
     "autoDownloadVideos": false,
     "autoDownloadFiles": true,
     "dataSaver": true
   }
   ```
3. Verify response contains updated values
4. GET `/settings/data-storage` again to verify persistence

**Expected Results**:
- ✅ PUT request returns 200 OK
- ✅ All data storage settings are updated correctly
- ✅ Settings persist in database

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 6: Appearance Settings Update

**Objective**: Verify appearance settings can be updated and persisted

**Steps**:
1. GET `/settings/appearance` to fetch current settings
2. PUT `/settings/appearance` with updated values:
   ```json
   {
     "theme": "dark",
     "accentColor": "#ff0000",
     "fontSize": "large",
     "chatBackground": "custom",
     "bubbleStyle": "square",
     "animationsEnabled": false
   }
   ```
3. Verify response contains updated values
4. GET `/settings/appearance` again to verify persistence
5. Check localStorage for appearance settings persistence

**Expected Results**:
- ✅ PUT request returns 200 OK
- ✅ All appearance settings are updated correctly
- ✅ Settings persist in database
- ✅ Settings also persist in localStorage

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

## Task 9.2: Test Device Management Flow

### Requirements: 10.1, 10.2, 10.3, 10.4, 10.5

### Test 7: Fetching Device List

**Objective**: Verify device list can be fetched and displays correct information

**Steps**:
1. Log in from multiple devices/browsers (at least 2)
2. GET `/settings/devices` from one session
3. Verify response contains all active sessions
4. Verify current session is marked with `isCurrent: true`
5. Verify other sessions have `isCurrent: false`
6. Verify devices are ordered by `lastActive` (most recent first)

**Expected Results**:
- ✅ GET request returns 200 OK
- ✅ Response contains all active sessions
- ✅ Current session is correctly identified
- ✅ Device information is complete (name, type, location, lastActive)
- ✅ Devices are ordered correctly

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 8: Terminating a Device

**Objective**: Verify a specific device session can be terminated

**Steps**:
1. Log in from two different browsers/devices
2. GET `/settings/devices` to get device list
3. Note the ID of a non-current device
4. DELETE `/settings/devices/{device_id}` for the non-current device
5. Verify response is 200 OK
6. GET `/settings/devices` again
7. Verify the terminated device is no longer in the list
8. Try to use the terminated session (should fail with 401)

**Expected Results**:
- ✅ DELETE request returns 200 OK
- ✅ Device is removed from list
- ✅ Terminated session can no longer access protected endpoints
- ✅ Current session remains active

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 9: Terminating All Other Devices

**Objective**: Verify all other device sessions can be terminated at once

**Steps**:
1. Log in from three or more different browsers/devices
2. GET `/settings/devices` to verify multiple sessions
3. DELETE `/settings/devices` (without device ID)
4. Verify response is 200 OK
5. GET `/settings/devices` again
6. Verify only current device remains in the list
7. Try to use one of the terminated sessions (should fail with 401)

**Expected Results**:
- ✅ DELETE request returns 200 OK
- ✅ Only current device remains in list
- ✅ All other sessions are terminated
- ✅ Current session remains active

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 10: Current Session Protection

**Objective**: Verify current session cannot be terminated

**Steps**:
1. Log in and get authentication token
2. GET `/settings/devices` to get current device ID
3. Find the device with `isCurrent: true`
4. DELETE `/settings/devices/{current_device_id}`
5. Verify response is 403 Forbidden or appropriate error
6. GET `/settings/devices` again
7. Verify current session is still active

**Expected Results**:
- ✅ DELETE request returns 403 Forbidden
- ✅ Error message indicates cannot terminate current session
- ✅ Current session remains active
- ✅ Can still access protected endpoints

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

## Task 9.3: Test Cache Clearing Flow

### Requirements: 9.1, 9.2, 9.3, 9.4, 9.5

### Test 11: Cache Clear Operation

**Objective**: Verify cache can be cleared and cache_size updates to 0

**Steps**:
1. Upload some files to create cache (use message attachments)
2. GET `/settings/data-storage` to check initial cache_size
3. Note the cache_size value (should be > 0)
4. POST `/settings/clear-cache`
5. Verify response is 200 OK
6. Verify response contains updated DataStorageSettings
7. Verify cache_size in response is 0 or very small
8. GET `/settings/data-storage` again
9. Verify cache_size is still 0

**Expected Results**:
- ✅ POST request returns 200 OK
- ✅ cache_size updates to 0 (or very small value)
- ✅ Cache directory is cleared
- ✅ Success message is displayed in UI
- ✅ Storage statistics are updated

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

## Task 9.4: Test Error Scenarios

### Requirements: 11.1, 11.2, 11.3, 11.4, 11.5

### Test 12: Network Errors

**Objective**: Verify proper handling of network errors

**Steps**:
1. Open Settings page
2. Open browser DevTools → Network tab
3. Set network to "Offline"
4. Try to update any setting
5. Verify error message is displayed
6. Verify UI shows "Connection failed" or similar message
7. Set network back to "Online"
8. Verify setting can now be updated

**Expected Results**:
- ✅ Error message is displayed to user
- ✅ Message indicates network/connection issue
- ✅ UI doesn't crash
- ✅ Error is logged to console
- ✅ Setting reverts to previous value (optimistic update rollback)

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 13: Server Errors

**Objective**: Verify proper handling of server errors

**Steps**:
1. Stop the backend server
2. Open Settings page (should load from cache/localStorage)
3. Try to update any setting
4. Verify error message is displayed
5. Restart backend server
6. Try to update setting again
7. Verify update succeeds

**Expected Results**:
- ✅ Error message is displayed to user
- ✅ Message indicates server error
- ✅ UI doesn't crash
- ✅ Error is logged to console
- ✅ Setting reverts to previous value

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 14: Validation Errors

**Objective**: Verify proper handling of validation errors

**Steps**:
1. Open Settings page → Profile section
2. Try to enter invalid email (e.g., "notanemail")
3. Verify inline validation error is shown
4. Verify save button is disabled
5. Enter valid email
6. Verify validation error clears
7. Verify save button is enabled

**Expected Results**:
- ✅ Inline validation errors are displayed
- ✅ Save button is disabled when validation fails
- ✅ Validation errors clear when input is corrected
- ✅ Invalid data is not sent to server

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 15: Optimistic Update Rollback

**Objective**: Verify optimistic updates are rolled back on error

**Steps**:
1. Open Settings page
2. Note current value of a setting (e.g., theme)
3. Open browser DevTools → Network tab
4. Set network throttling to "Slow 3G"
5. Change the setting
6. Observe: Setting changes immediately (optimistic update)
7. Before request completes, set network to "Offline"
8. Wait for request to fail
9. Observe: Setting reverts to original value (rollback)

**Expected Results**:
- ✅ Setting changes immediately (optimistic update)
- ✅ Setting reverts on error (rollback)
- ✅ Error message is displayed
- ✅ UI state matches backend state after rollback

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

## Task 9.5: Test Settings Persistence

### Requirements: 12.1, 12.2, 12.3, 12.4, 12.5

### Test 16: Settings Save to Database

**Objective**: Verify settings are persisted to database

**Steps**:
1. Update multiple settings (profile, privacy, notifications, etc.)
2. Verify each update returns 200 OK
3. Log out
4. Log in again
5. Navigate to Settings page
6. Verify all settings are still updated

**Expected Results**:
- ✅ All settings persist across logout/login
- ✅ Settings are fetched from database on login
- ✅ No settings are lost

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 17: Settings Load on Login

**Objective**: Verify settings are loaded when user logs in

**Steps**:
1. Log out if logged in
2. Open browser DevTools → Network tab
3. Log in with valid credentials
4. Navigate to Settings page
5. Observe network requests
6. Verify GET requests are made to all settings endpoints
7. Verify settings are displayed correctly

**Expected Results**:
- ✅ Settings are fetched on page load
- ✅ All settings categories are loaded
- ✅ Loading states are shown during fetch
- ✅ Settings are displayed once loaded

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 18: Settings Restore on Page Reload

**Objective**: Verify settings are restored when page is reloaded

**Steps**:
1. Log in and navigate to Settings page
2. Wait for all settings to load
3. Note current settings values
4. Refresh the page (F5)
5. Verify settings are loaded again
6. Verify all settings match previous values

**Expected Results**:
- ✅ Settings are fetched on page reload
- ✅ All settings are restored correctly
- ✅ No settings are lost or reset

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 19: Appearance Settings Persist to localStorage

**Objective**: Verify appearance settings are persisted to localStorage

**Steps**:
1. Open Settings page → Appearance section
2. Change theme to "dark"
3. Change accent color to "#ff0000"
4. Open browser DevTools → Application → Local Storage
5. Find key "settings-storage"
6. Verify it contains appearance settings
7. Refresh page (F5)
8. Verify appearance settings are still applied
9. Verify settings were loaded from localStorage (check Network tab - should be instant)

**Expected Results**:
- ✅ Appearance settings are saved to localStorage
- ✅ Settings persist across page reloads
- ✅ Settings are loaded instantly from localStorage
- ✅ Theme and colors are applied immediately

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 20: Partial Update Preservation

**Objective**: Verify partial updates don't overwrite other fields

**Steps**:
1. Set initial profile values:
   - Name: "Initial Name"
   - Username: "initial_username"
   - Bio: "Initial bio"
2. Verify all fields are set
3. Update only name: PUT `/settings/profile` with `{"name": "Updated Name"}`
4. GET `/settings/profile`
5. Verify name is updated but username and bio are unchanged

**Expected Results**:
- ✅ Only specified fields are updated
- ✅ Other fields retain their previous values
- ✅ No data is lost during partial updates

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### Test 21: Settings Update Idempotence

**Objective**: Verify applying same update twice produces same result

**Steps**:
1. Update chat settings: PUT `/settings/chat` with specific values
2. Note the response
3. Apply the exact same update again
4. Compare responses
5. GET `/settings/chat` to verify final state

**Expected Results**:
- ✅ Both updates return 200 OK
- ✅ Both responses are identical
- ✅ Final state matches the update values
- ✅ No errors or unexpected behavior

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

## Test Summary

### Task 9.1: Complete Settings Update Flow
- [ ] Test 1: Profile Update End-to-End
- [ ] Test 2: Privacy Settings Update
- [ ] Test 3: Notification Settings Update
- [ ] Test 4: Chat Settings Update
- [ ] Test 5: Data Storage Settings Update
- [ ] Test 6: Appearance Settings Update

### Task 9.2: Device Management Flow
- [ ] Test 7: Fetching Device List
- [ ] Test 8: Terminating a Device
- [ ] Test 9: Terminating All Other Devices
- [ ] Test 10: Current Session Protection

### Task 9.3: Cache Clearing Flow
- [ ] Test 11: Cache Clear Operation

### Task 9.4: Error Scenarios
- [ ] Test 12: Network Errors
- [ ] Test 13: Server Errors
- [ ] Test 14: Validation Errors
- [ ] Test 15: Optimistic Update Rollback

### Task 9.5: Settings Persistence
- [ ] Test 16: Settings Save to Database
- [ ] Test 17: Settings Load on Login
- [ ] Test 18: Settings Restore on Page Reload
- [ ] Test 19: Appearance Settings Persist to localStorage
- [ ] Test 20: Partial Update Preservation
- [ ] Test 21: Settings Update Idempotence

## Notes

- These tests should be run manually as they require a full integration environment
- Tests can be automated using tools like Playwright or Cypress for E2E testing
- Backend integration tests require a test database setup
- Some tests require multiple browser sessions/devices
- All tests should be run with both frontend and backend servers running
- Check browser console for error logs during testing
- Use browser DevTools Network tab to inspect API requests/responses
