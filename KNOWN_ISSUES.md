# Known Issues

## 🔄 Heart Counter Real-time Updates

**Issue**: Heart counter displays correct values but only updates after page refresh
**Status**: ⚠️ Active Issue
**Priority**: High
**Impact**: User Experience

### Description
The heart counter functionality works correctly on the backend:
- Hearts are properly saved to database ✅
- API returns correct counts ✅
- Authentication works ✅
- Database relationships intact ✅

However, the frontend UI does not update in real-time when users click the heart button. Users must refresh the page to see the updated heart count.

### Expected Behavior
When a user clicks the heart button:
1. Heart should be added/removed from database ✅
2. UI should immediately reflect the new count ❌
3. Heart button should show correct state (filled/unfilled) ❌

### Current Behavior
When a user clicks the heart button:
1. Heart is added/removed from database ✅
2. UI shows old count until page refresh ❌
3. Heart button state doesn't update ❌

### Root Cause Analysis
Likely causes:
- Frontend state not updating after API call
- Missing state management in PostCard component
- API response not being used to update UI
- React state not re-rendering after heart action

### Reproduction Steps
1. Navigate to a post
2. Click the heart button
3. Observe that count remains the same
4. Refresh page
5. Count now shows correct value

### Technical Details
- Backend API: Working correctly
- Database: Storing hearts properly
- Frontend API routes: Proxying correctly
- Issue: Frontend state management

### Next Steps
1. Examine PostCard component heart click handler
2. Check if API response is being used to update state
3. Add proper state management for real-time updates
4. Add test for real-time UI updates
5. Implement optimistic UI updates

---

## 📋 Other Issues

### Backend Profile API Tests
**Status**: ⚠️ 16 tests failing
**Priority**: Medium
**Impact**: Test Coverage

Profile API tests are failing with 500 errors, but this doesn't affect the heart counter functionality. These need to be addressed separately.

---

*Last Updated: 2025-08-15*
*Next Review: After heart counter real-time fix*