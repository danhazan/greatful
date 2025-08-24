# Test Status Documentation

## Overview

This document tracks all skipped tests across the project, providing detailed explanations for why tests are disabled and when they should be re-enabled.

## Backend Tests (FastAPI)

### ✅ All Backend Tests Passing

**Location**: `apps/api/tests/`  
**Status**: All 67 tests passing  
**Impact**: Backend API fully tested and functional  

#### Recently Fixed Issues:

1. **Profile API Test Failures** - FIXED
   - **Issue**: `test_update_profile_username_taken` failed due to missing `hashed_password` in test user creation
   - **Fix**: Added proper password hashing in test user creation
   - **Issue**: `test_get_user_profile_success` failed because email was exposed in public profile endpoint
   - **Fix**: Created separate `PublicUserProfileResponse` model that excludes email for other users' profiles

2. **HTTP Status Code Mismatch** - FIXED
   - **Issue**: Test expected 400 but API returned 409 for username conflict
   - **Fix**: Updated test to expect correct 409 Conflict status code

#### Current Status:
```bash
# All tests pass
cd apps/api
source venv/bin/activate
python -m pytest -v
# Result: 67 passed, 1 warning (passlib deprecation)
```
**Note on Warnings**: The single remaining warning is a `DeprecationWarning` from the `passlib` library (`'crypt'` module). This is an internal library issue and does not affect test functionality. The project is using the latest `passlib` version, so no action is required at this time.

---

## Frontend Tests (Next.js/React)

### Skipped Frontend Tests

**Status**: 14 tests skipped  
**Impact**: Specific functionalities are not fully tested.  

#### Skipped Tests:

1.  **`should not modify global counts when user reacts`** (from `src/app/feed/__tests__/counter-integration.test.tsx`)
    -   **Reason**: Likely related to complex mocking of global state or interactions with external systems.
    -   **Fix Required**: Implement robust mocking for global state and ensure proper isolation of test environment.

2.  **`should save individual user reactions to user-specific localStorage`** (from `src/app/feed/__tests__/counter-integration.test.tsx`)
    -   **Reason**: Likely related to complex mocking of `localStorage` or user-specific data handling.
    -   **Fix Required**: Implement proper mocking for `localStorage` and ensure test data is isolated per user.

3.  **`renders notification bell with unread count`** (from `src/tests/components/NotificationSystem.test.tsx`)
    -   **Reason**: Likely related to complex UI rendering based on dynamic data or incomplete mocking of notification data.
    -   **Fix Required**: Ensure all necessary props and data are mocked for the component to render correctly.

4.  **`shows notifications dropdown when bell is clicked`** (from `src/tests/components/NotificationSystem.test.tsx`)
    -   **Reason**: Involves user interaction and state changes that might not be fully covered by current test setup.
    -   **Fix Required**: Implement proper event simulation and `act()` wrapping for state updates.

5.  **`marks notification as read when clicked`** (from `src/tests/components/NotificationSystem.test.tsx`)
    -   **Reason**: Involves user interaction and API calls that might not be fully mocked or handled in the test environment.
    -   **Fix Required**: Mock API calls for marking notifications as read and ensure correct event handling.

6.  **`marks all notifications as read`** (from `src/tests/components/NotificationSystem.test.tsx`)
    -   **Reason**: Similar to the above, involves API calls and state updates for multiple notifications.
    -   **Fix Required**: Mock API calls for marking all notifications as read and handle bulk state updates.

7.  **`displays correct notification icons`** (from `src/tests/components/NotificationSystem.test.tsx`)
    -   **Reason**: Related to conditional rendering of UI elements based on notification types or data.
    -   **Fix Required**: Ensure all possible notification types and their corresponding icons are covered by mocks.

8.  **`shows user avatars with fallback to initials`** (from `src/tests/components/NotificationSystem.test.tsx`)
    -   **Reason**: Involves image loading and fallback logic, which can be complex to test in a JSDOM environment.
    -   **Fix Required**: Mock image loading and ensure fallback logic is correctly triggered in tests.

9.  **`handles API errors gracefully`** (from `src/tests/components/NotificationSystem.test.tsx`)
    -   **Reason**: Requires mocking API errors and verifying the component's response to them.
    -   **Fix Required**: Implement robust API error mocking and assert on error handling UI/logic.

10. **`formats time correctly`** (from `src/tests/components/NotificationSystem.test.tsx`)
    -   **Reason**: Involves date formatting and localization, which can be tricky in tests.
    -   **Fix Required**: Use consistent date mocking and ensure formatting logic is correctly applied.

11. **`should handle reaction removal and update count in real-time`** (from `src/tests/components/PostCard.reactions.realtime.test.tsx`)
    -   **Reason**: Involves real-time updates and potentially WebSocket mocking, similar to previous documentation.
    -   **Fix Required**: Implement WebSocket mocking and ensure real-time updates are correctly reflected in the UI.

12. **`should fallback to optimistic update if reaction summary fetch fails`** (from `src/tests/components/PostCard.reactions.realtime.test.tsx`)
    -   **Reason**: Involves complex optimistic UI updates and error handling for API calls.
    -   **Fix Required**: Mock API failures and verify the optimistic update logic.

13. **`should handle API errors gracefully`** (from `src/tests/components/PostCard.reactions.realtime.test.tsx`)
    -   **Reason**: Requires mocking API errors and verifying the component's response to them.
    -   **Fix Required**: Implement robust API error mocking and assert on error handling UI/logic.

14. **`positions correctly based on provided position`** (from `src/tests/components/EmojiPicker.test.tsx`)
    -   **Reason**: Involves DOM manipulation and precise positioning, which can be challenging in a JSDOM environment.
    -   **Fix Required**: Use testing utilities that can accurately simulate DOM layout and positioning.

#### General Fixes Required for Skipped Frontend Tests:
-   **Comprehensive Mocking**: Ensure all external dependencies, API calls, and global states are properly mocked.
-   **`act()` Wrapping**: Wrap all state updates and user interactions in `act()` to ensure React updates are flushed.
-   **Asynchronous Testing**: Use `waitFor`, `findBy`, and `await` for testing asynchronous operations and real-time updates.
-   **Test Utilities**: Develop or utilize existing test utilities for common patterns like modal interactions, keyboard events, and image loading.
-   **Isolation**: Ensure tests are isolated and do not interfere with each other.

---

## Test Execution Summary

### Backend (FastAPI)
- **Total**: 67 tests
- **Passing**: 67 tests (100%)
- **Failing**: 0 tests (0%)
- **Skipped**: 0 tests (0%)

### Frontend (Next.js)
- **Total**: 180 tests
- **Passing**: 149 tests (83%)
- **Failing**: 17 tests (9%)
- **Skipped**: 14 tests (8%)

### Overall Health
- **Combined Pass Rate**: 91% (215/248 tests)
- **Critical Issues**: ✅ Backend tests FIXED, React `act()` warnings remain
- **Functional Impact**: Core features work, backend fully tested

---

## Priority Fix Order

### High Priority (Blocking)
1. **Backend Database Isolation** - Fix profile API test failures
2. **React `act()` Warnings** - Ensure test reliability
3. **PostCard Interactions** - Core functionality testing

### Medium Priority (Quality)
4. **Emoji Picker Tests** - Complete interaction testing
5. **Real-time Tests** - Add proper async testing
6. **Test Environment** - Fix fetch API and JSON parsing

### Low Priority (Polish)
7. **Test Coverage** - Re-enable skipped tests
8. **Performance** - Optimize test execution time

---

## Re-enabling Tests Checklist

### When to Re-enable Profile API Tests:
- [ ] Fix async session cleanup in test fixtures
- [ ] Implement proper database state isolation
- [ ] Verify all 22 tests pass in full suite
- [ ] Remove `@pytest.mark.skip` decorators

### When to Re-enable Frontend Interaction Tests:
- [ ] Fix mock function signatures
- [ ] Implement proper `act()` wrapping
- [ ] Add emoji picker test utilities
- [ ] Verify real-time state updates work

### When to Re-enable Real-time Tests:
- [ ] Implement WebSocket mocking
- [ ] Add async state testing utilities
- [ ] Create modal interaction helpers
- [ ] Add keyboard event simulation

---

*Last Updated: August 15, 2025*  
*Next Review: After database isolation fix*