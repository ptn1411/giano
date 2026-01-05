# Settings Integration Test Execution Guide

## Quick Start

This guide provides quick instructions for executing the integration tests for the Settings Integration feature.

## Prerequisites

- ✅ Backend server running on `http://localhost:3000`
- ✅ Frontend development server running
- ✅ PostgreSQL database with migrations applied
- ✅ Valid test user account

## Test Execution Options

### Option 1: Manual Integration Tests (Recommended for QA)

**Location**: `.kiro/specs/settings-integration/integration-tests.md`

**Steps**:
1. Open the integration tests document
2. Follow the test environment setup instructions
3. Execute each test case in order
4. Mark tests as passed/failed using the checkboxes
5. Document any issues found

**Time Required**: ~2-3 hours for complete test suite

**Best For**:
- QA testing
- User acceptance testing
- Regression testing
- UI/UX verification

---

### Option 2: Automated Backend Tests (Recommended for Development)

**Location**: `backend/src/services/settings_integration_tests.rs`

**Setup**:
```bash
# Create test database
createdb chat_test

# Run migrations on test database
cd backend
DATABASE_URL="postgres://postgres:postgres@localhost/chat_test" sqlx migrate run

# Set environment variable
export DATABASE_URL="postgres://postgres:postgres@localhost/chat_test"
```

**Execution**:
```bash
cd backend
cargo test settings_integration_tests -- --nocapture
```

**Time Required**: ~30 seconds

**Best For**:
- Development testing
- CI/CD pipelines
- Quick verification
- Regression testing

---

## Test Categories

### 1. Settings Update Flow (6 tests)
Tests all settings categories can be updated and persisted:
- Profile settings
- Privacy settings
- Notification settings
- Chat settings
- Data storage settings
- Appearance settings

**Manual**: Tests 1-6 in integration-tests.md
**Automated**: `test_*_settings_update` functions

---

### 2. Device Management (4 tests)
Tests device session management:
- Fetching device list
- Terminating specific device
- Terminating all other devices
- Current session protection

**Manual**: Tests 7-10 in integration-tests.md
**Automated**: `test_*_device*` functions

---

### 3. Cache Clearing (1 test)
Tests cache management:
- Clear cache operation
- Verify cache_size updates

**Manual**: Test 11 in integration-tests.md
**Automated**: `test_cache_clear_operation` function

---

### 4. Error Scenarios (4 tests)
Tests error handling:
- Network errors
- Server errors
- Validation errors
- Optimistic update rollback

**Manual**: Tests 12-15 in integration-tests.md
**Automated**: `test_*_nonexistent_*` functions

---

### 5. Settings Persistence (6 tests)
Tests data persistence:
- Database persistence
- Load on login
- Page reload restoration
- localStorage persistence
- Partial updates
- Idempotence

**Manual**: Tests 16-21 in integration-tests.md
**Automated**: `test_settings_*` and `test_partial_*` functions

---

## Running Specific Test Categories

### Backend Tests

```bash
# Run all integration tests
cargo test settings_integration_tests

# Run specific test
cargo test test_profile_update_end_to_end

# Run tests matching pattern
cargo test test_device

# Run with output
cargo test settings_integration_tests -- --nocapture
```

### Manual Tests

Navigate to specific test sections in `integration-tests.md`:
- **Task 9.1**: Tests 1-6 (Settings Update Flow)
- **Task 9.2**: Tests 7-10 (Device Management)
- **Task 9.3**: Test 11 (Cache Clearing)
- **Task 9.4**: Tests 12-15 (Error Scenarios)
- **Task 9.5**: Tests 16-21 (Settings Persistence)

---

## Test Data Setup

### Create Test User

```bash
# Using curl
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "name": "Test User",
    "password": "testpassword123"
  }'

# Login to get token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpassword123"
  }'
```

### Using the Frontend

1. Navigate to the registration page
2. Create a new account
3. Log in with the credentials
4. Navigate to Settings page

---

## Troubleshooting

### Backend Tests Fail with Database Error

**Problem**: `database "chat_test" does not exist`

**Solution**:
```bash
createdb chat_test
cd backend
DATABASE_URL="postgres://postgres:postgres@localhost/chat_test" sqlx migrate run
```

---

### Manual Tests: Cannot Connect to Backend

**Problem**: Network errors when testing

**Solution**:
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check backend logs for errors
3. Verify DATABASE_URL is set correctly
4. Restart backend server

---

### Manual Tests: Settings Not Persisting

**Problem**: Settings revert after page reload

**Solution**:
1. Check browser console for errors
2. Verify authentication token is valid
3. Check Network tab for failed API requests
4. Clear browser cache and try again

---

### Automated Tests: Compilation Errors

**Problem**: Rust compilation errors

**Solution**:
```bash
cd backend
cargo clean
cargo build
cargo test settings_integration_tests
```

---

## Test Reporting

### For Manual Tests

Document results in the integration-tests.md file:
- Mark tests as ✅ Passed or ❌ Failed
- Add notes for any issues found
- Include steps to reproduce failures
- Attach screenshots if helpful

### For Automated Tests

```bash
# Run tests and save output
cargo test settings_integration_tests -- --nocapture > test_results.txt 2>&1

# Check for failures
grep "FAILED" test_results.txt
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: chat_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Run migrations
        run: |
          cd backend
          cargo install sqlx-cli
          sqlx migrate run
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost/chat_test
      
      - name: Run integration tests
        run: |
          cd backend
          cargo test settings_integration_tests
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost/chat_test
```

---

## Performance Benchmarks

Expected test execution times:

| Test Category | Manual | Automated |
|--------------|--------|-----------|
| Settings Update Flow | 30-45 min | 5-10 sec |
| Device Management | 20-30 min | 3-5 sec |
| Cache Clearing | 5-10 min | 2-3 sec |
| Error Scenarios | 20-30 min | 2-3 sec |
| Settings Persistence | 30-45 min | 5-10 sec |
| **Total** | **2-3 hours** | **20-30 sec** |

---

## Best Practices

### For Manual Testing
1. ✅ Test in a clean browser profile
2. ✅ Clear cache before starting
3. ✅ Use browser DevTools to inspect requests
4. ✅ Document all failures with screenshots
5. ✅ Test on multiple browsers (Chrome, Firefox, Safari)

### For Automated Testing
1. ✅ Use a dedicated test database
2. ✅ Run tests in isolation
3. ✅ Clean up test data after each test
4. ✅ Use meaningful test names
5. ✅ Add comments for complex test logic

---

## Support

For issues or questions:
1. Check the main integration tests document
2. Review the design document for requirements
3. Check backend logs for errors
4. Review browser console for frontend errors
5. Consult the INTEGRATION_TESTS_COMPLETE.md summary

---

## Summary

- **Manual Tests**: 21 comprehensive test cases
- **Automated Tests**: 16 backend integration tests
- **Total Coverage**: All requirements and acceptance criteria
- **Execution Time**: 20-30 seconds (automated) or 2-3 hours (manual)
- **Requirements Coverage**: 100%

Choose the testing approach that best fits your needs:
- **Development**: Use automated backend tests
- **QA/UAT**: Use manual integration tests
- **CI/CD**: Use automated backend tests
- **Regression**: Use both approaches
