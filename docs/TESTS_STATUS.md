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
# Result: 67 passed, 12 warnings
```

---

## Frontend Tests (Next.js/React)

### PostCard Interaction Tests - Complex Component Mocking

**Location**: `apps/web/src/components/__tests__/PostCard.interactions.test.tsx`  
**Status**: 4/8 tests failing due to complex component interactions  
**Impact**: Core interaction functionality testing incomplete  

#### Failing Tests:

1. **`test_heart_event_tracking`**
   - **Issue**: Mock function call signature mismatch
   - **Expected**: `mockOnHeart('test-post-1', false)`
   - **Received**: `mockOnHeart('test-post-1', false, [])`
   - **Cause**: Additional parameter being passed from component

2. **`test_remove_reaction`**
   - **Issue**: Mock function not being called
   - **Expected**: `mockOnRemoveReaction('test-post-1')`
   - **Received**: No calls
   - **Cause**: Event handler not triggering properly

3. **`test_reaction_add_tracking`**
   - **Issue**: Mock function not being called
   - **Expected**: `mockOnReaction('test-post-1', 'heart_eyes')`
   - **Received**: No calls
   - **Cause**: Emoji selection not triggering callback

4. **`test_emoji_picker_closes`**
   - **Issue**: Emoji picker not closing after selection
   - **Expected**: Picker to be removed from DOM
   - **Received**: Picker still visible
   - **Cause**: State update not properly handled in test

#### Fix Required:
- Update mock function signatures to match actual component calls
- Fix emoji picker event handling in test environment
- Ensure proper state updates are wrapped in `act()`

### PostCard Real-time Tests - Skipped Due to Complexity

**Location**: `apps/web/src/components/__tests__/PostCard.reactions.realtime.test.tsx`  
**Status**: 4/6 tests skipped  
**Impact**: Real-time reaction functionality not fully tested  

#### Skipped Tests:

1. **`test_emoji_picker_interactions`** (Skipped)
   - **Reason**: "Emoji picker interactions are complex to test"
   - **Issue**: Requires complex DOM manipulation and event simulation
   - **Alternative**: Manual testing and integration tests

2. **`test_reaction_viewer_modal`** (Skipped)
   - **Reason**: "Modal interactions require complex setup"
   - **Issue**: Modal rendering and interaction testing complexity
   - **Alternative**: Component-specific modal tests

3. **`test_keyboard_shortcuts`** (Skipped)
   - **Reason**: "Keyboard event simulation needs refinement"
   - **Issue**: Keyboard event handling in test environment
   - **Alternative**: E2E tests for keyboard shortcuts

4. **`test_real_time_updates`** (Skipped)
   - **Reason**: "Real-time updates require WebSocket mocking"
   - **Issue**: Complex async state management testing
   - **Alternative**: Integration tests with mock WebSocket

#### Fix Required:
- Implement proper emoji picker test utilities
- Create modal testing helpers
- Add keyboard event simulation utilities
- Mock WebSocket connections for real-time tests

### React `act()` Warnings - Multiple Components

**Locations**: Multiple test files  
**Status**: Warnings in 6+ test files  
**Impact**: Test reliability and React best practices compliance  

#### Affected Components:

1. **PostCard** (`PostCard.interactions.test.tsx`)
   - **Warning**: State updates not wrapped in `act()`
   - **Cause**: `setShowEmojiPicker(false)` calls

2. **NotificationSystem** (`NotificationSystem.test.tsx`)
   - **Warning**: State updates not wrapped in `act()`
   - **Cause**: `setShowNotifications()` calls

3. **CreatePostModal** (Multiple test files)
   - **Warning**: State updates during image upload
   - **Cause**: Async state updates not properly handled

#### Fix Required:
- Wrap all user interactions in `act()` calls
- Use `waitFor()` for async state updates
- Implement proper async test patterns

### Test Environment Issues

#### Missing Fetch API

**Location**: `apps/web/src/components/__tests__/CreatePostModal.test.tsx`  
**Status**: Image upload tests failing  
**Error**: `ReferenceError: fetch is not defined`  

**Fix Required**:
- Add fetch polyfill to Jest setup
- Mock fetch for image upload tests

#### ✅ Invalid JSON Parsing - FIXED

**Location**: `apps/web/src/utils/__tests__/localStorage.test.ts`  
**Status**: Error handling test now properly mocks console.error  
**Fix Applied**: Added console.error mock to suppress expected error output during test

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