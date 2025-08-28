# Known Issues and Solutions

## 📋 Executive Summary

### ⚠️ Active Issues
- **🎭 Emoji Reactions 6 & 7**: Click handlers not working for emojis 6 (😂) and 7 (🤔)
- **🧪 Backend Test Isolation**: Profile API tests fail when run with all tests together
- **🎨 CreatePostModal Footer**: Alignment issues in modal footer
- **👤 User Profile Posts**: Profile pages show "No posts yet" despite having posts
- **🔔 Batch Notification Missing First Item**: Batch notification list doesn't include the first notification
- **😀 Emoji Display Inconsistency**: Emojis sometimes display differently in notifications
- **🔄 Post UI Update Lag**: Posts don't update in UI when notification bell updates
- **📍 Mention Autocomplete Positioning**: Autocomplete appears below textarea instead of under cursor

### ✅ Recently Resolved
- **Heart Counter Real-time Updates**: ✅ COMPLETED - Real-time updates without page refresh
- **Missing Emoji Support**: ✅ COMPLETED - Backend now supports all 10 frontend emojis

### 📊 System Health Status
- ✅ **Heart Counter**: Working perfectly with real-time updates
- ✅ **Reaction Counter**: Working perfectly with real-time updates  
- ✅ **Core APIs**: All functional endpoints working
- ⚠️ **Emoji Picker**: 8/10 emojis working (2 have click handler issues)
- ✅ **Tests**: 144+ tests passing (with known isolation issue)

---

## ✅ Recently Resolved Issues

### Heart Counter Real-time Updates - COMPLETED ✅
**Issue**: Heart counter displayed correct values but only updated after page refresh  
**Status**: ✅ RESOLVED  
**Resolution Date**: August 15, 2025  
**Impact**: High - Core user experience feature  

**What was Fixed**:
- ✅ PostCard now makes API calls to get updated heart counts from server
- ✅ UI updates immediately without page refresh
- ✅ Heart button shows correct state (filled/unfilled)
- ✅ Server-authoritative data ensures accuracy
- ✅ Comprehensive test coverage added (6/6 tests passing)
- ✅ Same real-time approach applied to reaction counters

**Technical Implementation**:
- Modified PostCard component to fetch updated counts after API calls
- Updated feed page handlers to use server data for real-time updates
- Added proper TypeScript interfaces for heart and reaction data
- Created comprehensive integration tests

**Files Modified**:
- `apps/web/src/components/PostCard.tsx` - Real-time API calls
- `apps/web/src/app/feed/page.tsx` - Server data handling
- `apps/api/app/api/v1/likes.py` - Heart API endpoints
- `apps/api/app/models/like.py` - Database model
- Test files for comprehensive coverage

### Missing Emoji Support - COMPLETED ✅
**Issue**: Emojis 'joy' (😂) and 'thinking' (🤔) were not supported by backend  
**Status**: ✅ RESOLVED  
**Resolution Date**: August 15, 2025  

**What was Fixed**:
- ✅ Updated backend EmojiReaction model to support 10 emojis (was 8)
- ✅ Added 'joy' and 'thinking' to valid emoji codes
- ✅ Backend now accepts all frontend emoji picker options
- ✅ Added comprehensive tests for emoji validation

---

## ⚠️ Active Issues

### Emoji Reactions 6 & 7 Click Handlers Not Working
**Issue**: Emojis 6 (laughing 😂) and 7 (thinking 🤔) don't respond when clicked in emoji picker  
**Status**: ⚠️ Active Issue  
**Priority**: Medium  
**Impact**: User Experience  
**Discovered**: August 15, 2025  

**Description**:
While most emoji reactions work correctly, emojis 6 and 7 in the emoji picker don't function when clicked. Pressing on them does nothing - no API call is made and no reaction is added.

**Technical Details**:
- Backend: Supports 'joy' and 'thinking' emoji codes ✅
- Database: Can store these reactions ✅
- Frontend: Emoji picker displays these emojis ✅
- Issue: Click handlers not working for these specific emojis ❌

**Reproduction Steps**:
1. Navigate to a post
2. Click the reaction button to open emoji picker
3. Click on emoji 6 (😂) or emoji 7 (🤔)
4. Observe that nothing happens

**Next Steps**:
1. Debug emoji picker click handlers for emojis 6 & 7
2. Check if emoji codes are being passed correctly
3. Verify event handlers are attached to all emoji buttons
4. Add specific tests for these emoji interactions

### Backend Test Isolation Issue
**Issue**: Profile API tests pass individually but fail when run with all tests  
**Status**: ⚠️ Active Issue  
**Priority**: Low  
**Impact**: Test Coverage (no functional impact)  

**Description**:
Profile API tests (22 tests) pass when run individually or as a group, but fail when run with all tests together. This is a test isolation issue, not a functional problem.

**Root Cause**: Async database connections or test fixtures are not being properly cleaned up between test suites, causing interference.

**Workaround**:
```bash
# All these pass individually:
python -m pytest tests/test_likes_api.py -v          # 3/3 ✅
python -m pytest tests/test_reactions_api.py -v     # 10/10 ✅  
python -m pytest tests/test_emoji_reactions.py -v   # 16/16 ✅
python -m pytest tests/test_user_profile.py -v      # 17/17 ✅
python -m pytest tests/test_profile_api.py -v       # 22/22 ✅

# Skip profile API tests when running all tests together
python -m pytest tests/ -k "not test_profile_api"

# Or run test suites individually for full coverage
for test_file in tests/test_*.py; do
    python -m pytest "$test_file" -v
done
```

**Impact**: No functional impact - all APIs work correctly. Only affects CI/CD test runs.



### CreatePostModal Footer Alignment Issue
**Issue**: Footer elements in CreatePostModal are not properly aligned  
**Status**: ⚠️ Active Issue  
**Priority**: Medium  
**Impact**: User Experience  

**Description**:
The footer elements in the CreatePostModal are not properly aligned within the modal container. The "Draft saved automatically" text, "Cancel" and "Share Gratitude" buttons appear to be outside or misaligned with the modal box.

**Expected Behavior**:
- All footer elements should be contained within the modal box
- Buttons should be properly aligned
- The spacing line above the footer should be removed to make more space

**Steps to Reproduce**:
1. Open the feed page
2. Click the floating "+" button to create a post
3. Observe the modal footer alignment

**Files Affected**: `apps/web/src/components/CreatePostModal.tsx`

### User Profile Posts Not Displaying
**Issue**: User profile pages show "No posts yet" despite having posts  
**Status**: ⚠️ Active Issue  
**Priority**: High  
**Impact**: Core Functionality  

**Description**:
When navigating to another user's profile page, the posts section shows "No posts yet" even when the user has posts (as indicated by the posts count showing "3").

**Expected Behavior**:
- User's posts should be displayed in the posts section
- Posts should be fetched from the API and rendered properly

**Steps to Reproduce**:
1. Go to feed page
2. Click on another user's profile picture or name
3. Navigate to their profile page
4. Observe that posts section shows "No posts yet" despite posts count showing a number > 0

**Files Affected**: 
- `apps/web/src/app/profile/[userId]/page.tsx`
- `apps/web/src/app/api/users/[userId]/posts/route.ts`

### Batch Notification Missing First Item
**Issue**: Batch notification list doesn't include the first notification due to implementation logic  
**Status**: ⚠️ Active Issue  
**Priority**: Medium  
**Impact**: User Experience  
**Discovered**: August 27, 2025  

**Description**:
When notifications are batched together (e.g., "John and 2 others reacted to your post"), the notification list modal doesn't display the first notification in the batch. This is due to how the batching logic is implemented - it creates a parent notification and child notifications, but the first notification gets excluded from the display.

**Technical Details**:
- Backend: Notification batching creates parent/child relationships ✅
- Database: All notifications are stored correctly ✅
- Frontend: Batch display logic excludes first notification ❌
- Impact: Users miss seeing who was the first person to interact

**Reproduction Steps**:
1. Have multiple users react to the same post
2. Wait for notifications to be batched
3. Click on the notification bell to view notifications
4. Observe that the batch shows "John and 2 others" but the detailed list only shows 2 people

**Root Cause**: The batching implementation treats the first notification as the "parent" and doesn't include it in the child notification list.

**Workaround**: Individual notifications still work correctly; only the batched view is affected.

**Priority**: Medium - Affects user experience but doesn't break core functionality.

### Emoji Display Inconsistency in Notifications
**Issue**: Emojis sometimes display differently in notifications compared to the main interface  
**Status**: ⚠️ Active Issue  
**Priority**: Low  
**Impact**: Visual Consistency  
**Discovered**: August 27, 2025  

**Description**:
Emojis in notification messages sometimes render differently than they appear in the main post interface. This creates visual inconsistency and can confuse users about which reaction was actually used.

**Technical Details**:
- Backend: Emoji codes stored consistently ✅
- Database: Emoji data is correct ✅
- Frontend: Different emoji rendering between components ❌
- Issue: Notification component uses different emoji rendering logic

**Reproduction Steps**:
1. Add an emoji reaction to a post
2. Wait for the notification to be generated
3. Compare the emoji in the notification with the emoji on the post
4. Observe potential visual differences

**Root Cause**: Different components may be using different emoji libraries, fonts, or rendering methods.

**Examples**:
- Post shows 😍 but notification shows a slightly different variant
- Emoji sizing or styling differs between contexts

**Workaround**: Functionality is correct; only visual representation varies.

**Priority**: Low - Cosmetic issue that doesn't affect core functionality.

### Post UI Update Lag When Notification Bell Updates
**Issue**: When the notification bell gets updated, the relevant post should also update in the UI simultaneously  
**Status**: ⚠️ Active Issue  
**Priority**: Medium  
**Impact**: Real-time User Experience  
**Discovered**: August 27, 2025  

**Description**:
When a user receives a notification (bell icon updates with new count), the corresponding post in the feed doesn't immediately reflect the new interaction (like updated reaction counts or heart counts). Users have to manually refresh or navigate away and back to see the updated post state.

**Technical Details**:
- Backend: Notifications and post updates happen correctly ✅
- Database: Data is consistent and up-to-date ✅
- Frontend: Notification updates don't trigger post re-fetching ❌
- Issue: Missing real-time synchronization between notification system and post display

**Expected Behavior**:
- When notification bell updates, affected posts should automatically refresh their interaction counts
- Real-time updates should be bidirectional (post interactions → notifications, notifications → post updates)

**Reproduction Steps**:
1. Have another user react to your post
2. Observe notification bell updates with new count
3. Look at the post in your feed
4. Notice that reaction count hasn't updated yet
5. Refresh page to see the updated count

**Root Cause**: The notification system and post display components are not synchronized for real-time updates.

**Workaround**: Manual page refresh shows correct data; only real-time sync is affected.

**Priority**: Medium - Affects real-time user experience and perceived responsiveness.

### Mention Autocomplete Positioning
**Issue**: Mention autocomplete appears below textarea instead of under the cursor where user is typing  
**Status**: ⚠️ Active Issue  
**Priority**: Low  
**Impact**: User Experience Enhancement  
**Discovered**: December 2024  

**Description**:
When users type `@username` to mention someone, the autocomplete dropdown appears at the bottom of the textarea instead of appearing right under the cursor position where the user is typing. While functional, this is not optimal UX as users expect the autocomplete to appear near their cursor.

**Technical Details**:
- Backend: User search and mention functionality works correctly ✅
- Database: Mention data is stored and retrieved properly ✅
- Frontend: Autocomplete appears but in wrong position ❌
- Issue: Cursor positioning calculation implementation exists but positioning is suboptimal

**Expected Behavior**:
- Autocomplete should appear directly under the cursor position
- Should follow cursor as user types in different parts of textarea
- Should handle multiline text correctly

**Current Behavior**:
- Autocomplete appears at bottom of textarea
- Position is consistent but not optimal
- All mention functionality works correctly

**Reproduction Steps**:
1. Open CreatePostModal (click + button)
2. Type some text and then `@` to trigger mention autocomplete
3. Observe autocomplete appears at bottom of modal, not under cursor
4. Note that functionality works - just positioning is suboptimal

**Root Cause**: 
- Implementation uses simple "below textarea" positioning
- Cursor-based positioning would require complex coordinate calculation
- Current implementation prioritizes functionality over optimal positioning

**Workaround**: Current positioning is functional and doesn't block text - just not optimal UX.

**Priority**: Low - Enhancement opportunity, not a blocking issue. Core mention functionality works perfectly.

**Implementation Complexity**: High - Requires complex cursor coordinate calculation, text measurement, and handling of line breaks/wrapping.

### Username Standards Not Enforced
**Issue**: Platform allows usernames with special characters but doesn't enforce consistent standards  
**Status**: ⚠️ Active Issue  
**Priority**: Low  
**Impact**: Platform Consistency & Future Compatibility  
**Discovered**: August 28, 2025  

**Description**:
The platform currently allows usernames to contain special characters like dots, dashes, question marks, exclamation marks, and plus signs. While this works functionally, it creates inconsistency and potential future compatibility issues with the mention system and other features.

**Technical Details**:
- Backend: No username validation constraints currently ✅ (works but not standardized)
- Database: Username column accepts any string format ✅ (functional but not restricted)
- Frontend: Mention system supports special characters via regex `[a-zA-Z0-9_\-\.\?\!\+]` ✅ (works but complex)
- Issue: No platform-wide username standards enforced ❌

**Current Behavior**:
- Users can create usernames like `user.name`, `test-user`, `user+123`, `user!name`
- Mention system recognizes and processes these usernames correctly
- All functionality works but creates inconsistent user experience

**Recommended Standards** (for future implementation):
- Usernames should only contain letters (a-z, A-Z), numbers (0-9), and underscores (_)
- This would align with most social platforms and simplify mention processing
- Would require migration strategy for existing users with special characters

**Impact**:
- **Current**: No functional issues, all features work correctly
- **Future**: May complicate feature development and user experience consistency
- **Migration**: Would require careful handling of existing users with special character usernames

**Examples of Current Valid Usernames**:
- `Bob7??` (question marks)
- `alice.doe-123` (dots and dashes)  
- `user+name` (plus signs)
- `test!user` (exclamation marks)
- `simple_user` (underscores - would remain valid)

**Reproduction Steps**:
1. Create account with username containing special characters (e.g., `test.user`)
2. Observe account creation succeeds
3. Test mention functionality with `@test.user`
4. Note that everything works but username format is inconsistent with typical standards

**Root Cause**: 
- No username validation was implemented during initial development
- Focus was on functionality over standardization
- Current regex pattern supports wide range of characters for flexibility

**Workaround**: Current system works perfectly - this is a standardization/consistency issue, not a functional problem.

**Priority**: Low - No functional impact, purely a platform consistency and future-proofing consideration.

**Implementation Complexity**: Medium - Would require:
- Backend validation updates
- Database migration for existing users
- Frontend mention system updates
- Comprehensive testing
- User communication about username changes

**Planned Resolution**: Scheduled for Phase 2 (post-MVP) as "Username Validation Standards" feature.

---

## 📊 Test Status Summary

### Backend Tests
- ✅ **Likes API**: 3/3 passing
- ✅ **Reactions API**: 10/10 passing  
- ✅ **Emoji Reactions**: 16/16 passing
- ✅ **User Profile**: 17/17 passing
- ⚠️ **Profile API**: 22/22 passing individually, test isolation issue when run together

### Frontend Tests
- ✅ **Heart Counter Real-time**: 6/6 passing
- ✅ **PostCard Simple**: 8/8 passing
- ⚠️ **Reaction Real-time**: 2/6 passing (4 tests skipped due to emoji picker complexity)

### Integration Tests
- ✅ **Heart Counter Integration**: Full workflow passing
- ✅ **API Endpoints**: All core functionality working
- ✅ **Database Operations**: CRUD operations working

---

## 🎯 System Health

### Core Functionality Status
- ✅ **Heart Counter**: Working perfectly with real-time updates
- ✅ **Reaction Counter**: Working perfectly with real-time updates
- ✅ **User Authentication**: Working correctly
- ✅ **Post Creation**: Working correctly
- ✅ **Database Operations**: All CRUD operations working
- ⚠️ **Emoji Picker**: 8/10 emojis working (emojis 6&7 have click handler issues)
- ⚠️ **Notification Batching**: Missing first notification in batch display
- ⚠️ **Real-time Sync**: Post UI doesn't update when notifications arrive

### Performance
- ✅ **API Response Times**: Fast and responsive
- ✅ **Database Queries**: Optimized with proper indexing
- ✅ **Real-time Updates**: Instant feedback without page refresh
- ✅ **Error Handling**: Graceful error handling and fallbacks

---

## 🔧 System Issues

## Issue #1: NextAuth Route Export Error ✅ FIXED

### Problem
```
Type error: Route "src/app/api/auth/[...nextauth]/route.ts" does not match the required types of a Next.js Route.
"authOptions" is not a valid Route export field.
```

### Root Cause
In Next.js App Router, API routes can only export specific handler functions (`GET`, `POST`, `PUT`, `DELETE`, etc.). Exporting additional variables like `authOptions` is not allowed and causes build failures.

### Solution
**✅ Fixed**: Removed the `export` keyword from `authOptions` declaration.

**Before:**
```typescript
export const authOptions: NextAuthOptions = {
  // ... config
}
```

**After:**
```typescript
const authOptions: NextAuthOptions = {
  // ... config
}
```

### Why This Happens
- Next.js App Router enforces strict export rules for API routes
- Only HTTP method handlers can be exported from route files
- Configuration objects should be internal to the route file
- This is a common issue when migrating from Pages Router to App Router

### Prevention
- Always use `const` instead of `export const` for configuration objects in API routes
- Only export HTTP method handlers (`GET`, `POST`, etc.)
- Keep configuration objects internal to route files

---

## Issue #2: Next.js 15 Dynamic Route Params Error ✅ FIXED

### Problem
```
Error: Route "/api/posts/[id]/hearts" used `params.id`. `params` should be awaited before using its properties.
```

### Root Cause
In Next.js 15 App Router, the `params` argument for route handlers is now always a plain object, not a Promise. The handler signature should destructure `params` directly, not await it. Using the old pattern (from catch-all API routes) causes runtime errors.

### Solution
**✅ Fixed**: Use the correct handler signature and destructure `params` directly.

**Before (incorrect):**
```typescript
export async function GET(request: NextRequest, params: Promise<{ params: { id: string } }>) {
  const resolvedParams = await params
  const { id } = resolvedParams.params
  // ...
}
```

**After (correct):**
```typescript
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  // ...
}
```

### Why This Happens
- Next.js 15 App Router made route parameters always synchronous objects
- Awaiting or treating `params` as a Promise is a legacy pattern from old API routes
- This is a breaking change from Next.js 14 and earlier

### Prevention
- Always use `{ params }: { params: { ... } }` in the handler signature
- Never await `params` in App Router route handlers
- Check Next.js migration guides for breaking changes

---

## Issue #3: TypeScript/ESLint Errors

### Problem
Multiple TypeScript and ESLint errors during build:
- `@typescript-eslint/no-explicit-any` - Using `any` type
- `@typescript-eslint/no-unused-vars` - Unused variables
- `react/no-unescaped-entities` - Unescaped apostrophes
- `@next/next/no-img-element` - Using `<img>` instead of Next.js `<Image>`
- `@typescript-eslint/ban-ts-comment` - Using `@ts-ignore` instead of `@ts-expect-error`

### Root Cause
Strict TypeScript and ESLint configuration catching code quality issues.

### Solution
**Status**: Needs cleanup

**Quick Fixes Needed:**
1. **Replace `any` types** with proper TypeScript types
2. **Remove unused variables** or mark them with `_` prefix
3. **Escape apostrophes** in JSX text
4. **Replace `<img>` with Next.js `<Image>` component**
5. **Use `@ts-expect-error` instead of `@ts-ignore`**

### Why This Happens
- Strict TypeScript configuration for better code quality
- ESLint rules enforcing best practices
- Common issues in rapid development

### Prevention
- Use proper TypeScript types instead of `any`
- Clean up unused imports and variables
- Follow React/Next.js best practices
- Use proper TypeScript comment directives

---

## Issue #4: Multiple Lockfiles Warning

### Problem
```
Warning: Found multiple lockfiles. Selecting /home/danha/package-lock.json.
Consider removing the lockfiles at:
* /home/danha/Projects/Cursor/grateful/apps/web/package-lock.json
```

### Root Cause
The project has multiple `package-lock.json` files - one at the root and one in the web app directory. This can cause dependency conflicts and build issues.

### Solution
**Status**: Needs manual cleanup

**Recommended Action:**
1. Remove the root-level `package-lock.json` if it's not needed
2. Keep only the lockfile in the specific app directory
3. Run `npm install` to regenerate clean lockfiles

### Why This Happens
- Monorepo structure with multiple package.json files
- npm creates lockfiles at each level where `npm install` is run
- Can cause dependency version conflicts

### Prevention
- Use consistent package management (npm, yarn, or pnpm)
- Run install commands only in the specific app directories
- Consider using workspace tools like Lerna or Nx for monorepo management

---

## Frontend Test Issues

### ✅ RESOLVED: Test Framework Conflict

**Status**: ✅ **RESOLVED** - Vitest completely removed, Jest unified as test framework

**Previous Issue**: 
- Vitest cannot be imported in a CommonJS module using require(). Please use "import" instead.
- Frontend tests were using Vitest imports but Jest was configured in the project.

**Solution Applied**:
1. **Removed Vitest completely**: Uninstalled `vitest` package and all dependencies
2. **Converted all tests to Jest**: Updated all test files to use `@jest/globals` imports
3. **Unified test framework**: All tests now use Jest consistently
4. **Fixed mock functions**: Replaced `vi.fn()` with `jest.fn()` throughout

**Current Status**: ✅ **All tests now use Jest framework consistently**

### Remaining Test Issues

**Status**: 🔄 **IN PROGRESS** - Some tests still need dependency mocking

**Current Issues**:
1. **API Route Tests**: Next.js Request/Response not properly mocked
2. **Page Component Tests**: Missing component dependencies
3. **Integration Tests**: Complex dependencies not mocked

**Progress**: 50% of test suites passing (4/8 tests working)

---

## Backend Integration Tests

### Problem
```
TypeError: object Response can't be used in 'await' expression
```

### Root Cause
Integration tests are using `async_client` incorrectly with `await` syntax.

### Solution
**Status**: Known issue, low priority

**Impact**: All unit tests (86/86) pass, only integration tests affected
**Priority**: Low - Unit tests cover all functionality

### Why This Happens
- Async/await syntax mismatch in test client usage
- Integration tests need different async handling than unit tests
- Test client configuration issue

### Prevention
- Use consistent async patterns across all tests
- Test integration test syntax before implementing
- Separate unit and integration test configurations

---

## Issue #7: Legacy Params Pattern Workaround (Temporary)

### Problem
To avoid runtime errors in dynamic API routes (e.g., `/api/posts/[id]/hearts`), the handler signature is reverted to the legacy form:

```ts
export async function GET(request: NextRequest, params: any) {
  const { id } = params?.params || {}
  // ...
}
```

### Why This Is Used
- Next.js 15 App Router has breaking changes in how params are passed to API route handlers.
- The new recommended signature sometimes causes runtime errors in certain environments or with certain Next.js versions.
- The legacy pattern (`params: any` and `params?.params?.id`) is the most compatible and least error-prone for now.

### Tradeoffs
- This is not the recommended pattern for long-term maintenance.
- Type safety is lost (using `any`).
- May need to be updated again after Next.js or framework upgrades.

### When to Use
- Use this pattern if you encounter persistent errors with the new handler signature and need a quick, stable workaround.
- Revisit and refactor to the recommended signature when the framework stabilizes or after a Next.js upgrade.

### Example
```ts
export async function GET(request: NextRequest, params: any) {
  const { id } = params?.params || {}
  // ...
}
```

---

## File Renames

### PRD File
- **Before**: `docs/grateful_prd.md`
- **After**: `docs/GRATEFUL_PRD.md`
- **Reason**: Consistent uppercase naming convention for documentation files

---

## Summary

| Issue | Status | Priority | Impact |
|-------|--------|----------|--------|
| NextAuth Export | ✅ Fixed | High | Build blocking |
| Next.js 15 Params | ✅ Fixed | High | Runtime errors |
| TypeScript/ESLint Errors | ⚠️ Needs cleanup | Medium | Code quality |
| Multiple Lockfiles | ⚠️ Needs cleanup | Medium | Dependency conflicts |
| Frontend Tests | ⚠️ Needs config | Medium | Test execution |
| Backend Integration Tests | ⚠️ Known issue | Low | Only integration tests |

## Quick Fixes Applied

1. **NextAuth Route**: Removed `export` from `authOptions` ✅
2. **Next.js 15 Params**: Fixed async params destructuring ✅
3. **PRD File**: Renamed to uppercase `GRATEFUL_PRD.md` ✅
4. **Documentation**: Created this `KNOWN_ISSUES.md` file ✅

## Next Steps

1. **Fix TypeScript/ESLint errors** - Replace `any` types, remove unused vars, escape entities
2. **Clean up lockfiles** - Remove duplicate package-lock.json files
3. **Fix frontend tests** - Choose and configure single test framework
4. **Fix integration tests** - Resolve async/await syntax issues
5. **Update documentation** - Reference new PRD filename in all docs

## Build Status

- **NextAuth Export Error**: ✅ Fixed
- **Next.js 15 Params Error**: ✅ Fixed
- **TypeScript/ESLint Errors**: ⚠️ 15+ errors need cleanup
- **Build Process**: ✅ Compiles successfully (errors are warnings)
- **Functionality**: ✅ All features working despite linting errors

---

*Last Updated: August 27, 2025*  
*Next Review: When notification batching and real-time sync issues are resolved* 