# Common Fixes for Development Issues

This document contains solutions to recurring issues that happen during development, especially when implementing new notification types or social features.

> 📊 **For current system status and active issues, see [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)**

## 🎉 NOTIFICATION SYSTEM REFACTORED (December 2024)

**IMPORTANT**: The notification issues documented below have been **PERMANENTLY SOLVED** through a comprehensive refactoring.

### ✅ What Was Fixed
- **Issue 1: Notifications Not Arriving** → Solved with `NotificationFactory`
- **Issue 2: "Unknown User" Display** → Solved with `NotificationUserResolver`

### 🚀 New Implementation (Use This!)
```python
# ✅ NEW WAY - Use NotificationFactory
from app.core.notification_factory import NotificationFactory

notification_factory = NotificationFactory(db)
await notification_factory.create_your_notification(
    recipient_id=user_id,
    sender_username=sender.username,
    # ... other params
)
# Automatically handles all error cases and logging
```

```typescript
// ✅ NEW WAY - Use NotificationUserResolver
import { resolveNotificationUser } from '@/utils/notificationUserResolver'

const transformedNotifications = notifications.map(notification => ({
  ...notification,
  fromUser: resolveNotificationUser(notification)
}))
// Automatically extracts usernames from any notification type
```

### 📚 Documentation
- See `docs/NOTIFICATION_REFACTORING_COMPLETE.md` for full details
- All services have been updated to use the new patterns
- Frontend routes automatically handle all notification types

**These issues should NOT occur again with the new architecture!**

---

## 🔔 Legacy Notification System Issues (SOLVED - For Reference Only)

*The following issues have been permanently resolved but are kept for historical reference.*

### Issue 1: Notifications Not Arriving

**Symptoms:**
- API calls succeed (200/201 status)
- Backend tests pass
- Frontend shows success states
- But notifications don't appear in the notification dropdown

**Root Cause:**
The notification creation method is trying to use instance methods from within static methods, causing silent failures.

**Common Culprit:**
```python
# ❌ WRONG - This will fail silently
@staticmethod
async def create_some_notification(...):
    # Trying to call instance method from static method
    notification_service = NotificationService(db)
    if not await notification_service._check_notification_rate_limit(...):
        return None
```

**Solution:**
Follow the pattern used by working notifications (like `create_emoji_reaction_notification`):

```python
# ✅ CORRECT - Use NotificationRepository directly
@staticmethod
async def create_some_notification(
    db: AsyncSession,
    user_id: int,
    sender_username: str,
    # ... other params
) -> Optional[Notification]:
    """Create notification for some action."""
    
    # Don't create notification if user is acting on their own content (when applicable)
    if sender_id == user_id:  # Only for self-action prevention
        return None
    
    # Create notification directly using repository (like reaction notifications)
    notification_repo = NotificationRepository(db)
    created_notification = await notification_repo.create(
        user_id=user_id,
        type='your_notification_type',
        title='Your Title',
        message=f'{sender_username} did something',
        data={
            'sender_username': sender_username,
            'relevant_id': some_id,
            # ... other data
        }
    )
    
    logger.info(f"Created notification for user {user_id}")
    return created_notification
```

**Key Points:**
- Use `NotificationRepository(db)` directly, not `NotificationService` instance methods
- Don't use rate limiting unless you implement the method properly
- Follow the exact pattern from `create_emoji_reaction_notification`
- Always log successful creation for debugging

### Issue 2: "Unknown User" in Notifications

**Symptoms:**
- Notifications arrive successfully
- But show "Unknown User [username]" instead of just "[username]"
- Happens with new notification types

**Root Cause:**
The frontend notification route handlers only check for `reactor_username` but new notification types store usernames in different fields.

**Common Pattern:**
```typescript
// ❌ WRONG - Only checks reactor_username
fromUser: {
  name: notification.from_user?.username || notification.data?.reactor_username || 'Unknown User'
}
```

**Solution:**
Update both notification route handlers to check ALL possible username fields:

**File 1: `apps/web/src/app/api/notifications/route.ts`**
```typescript
// ✅ CORRECT - Check all username fields
fromUser: {
  id: notification.from_user?.id || 
      notification.data?.reactor_username || 
      notification.data?.sharer_username || 
      notification.data?.author_username || 
      notification.data?.sender_username ||  // Add your new field here
      'unknown',
  name: notification.from_user?.username || 
        notification.data?.reactor_username || 
        notification.data?.sharer_username || 
        notification.data?.author_username || 
        notification.data?.sender_username ||  // Add your new field here
        'Unknown User',
  image: notification.from_user?.profile_image_url || undefined
}
```

**File 2: `apps/web/src/app/api/notifications/[notificationId]/children/route.ts`**
```typescript
// ✅ CORRECT - Same pattern for batch notifications
fromUser: {
  id: child.from_user?.id || 
      child.data?.reactor_username || 
      child.data?.sharer_username || 
      child.data?.author_username || 
      child.data?.sender_username ||  // Add your new field here
      'unknown',
  name: child.from_user?.username || 
       child.data?.reactor_username || 
       child.data?.sharer_username || 
       child.data?.author_username || 
       child.data?.sender_username ||  // Add your new field here
       'Unknown User',
  image: child.from_user?.profile_image_url || undefined
}
```

**Username Field Patterns by Notification Type:**
- **Reactions**: `reactor_username`
- **Mentions**: `author_username` 
- **Shares**: `sharer_username`
- **Follows**: `follower_username`
- **Likes**: `liker_username`
- **Comments**: `commenter_username`

**Testing the Fix:**
Create a test to verify username extraction:
```typescript
// Test file: src/tests/api/notifications-username-fix.test.ts
const extractUsername = (notification: any) => {
  return notification.from_user?.username || 
         notification.data?.reactor_username || 
         notification.data?.sharer_username || 
         notification.data?.author_username || 
         notification.data?.your_new_field ||  // Add your field
         'Unknown User'
}

it('should extract your_field from your notifications', () => {
  const notification = {
    data: { your_new_field: 'testuser' },
    from_user: null
  }
  expect(extractUsername(notification)).toBe('testuser')
})
```

## 🧪 Testing Patterns

### Backend Notification Tests

Always create a test to verify notification creation:

```python
# File: tests/integration/test_your_notification_fixes.py
@pytest.mark.asyncio
async def test_your_notification_shows_correct_username(db_session: AsyncSession):
    """Test that your notifications show correct username, not 'Unknown User'."""
    
    # Create test users
    sender = User(username="sender_user", email="sender@example.com", hashed_password="hash")
    recipient = User(username="recipient_user", email="recipient@example.com", hashed_password="hash")
    
    db_session.add_all([sender, recipient])
    await db_session.commit()
    await db_session.refresh(sender)
    await db_session.refresh(recipient)
    
    # Trigger your action that creates notification
    your_service = YourService(db_session)
    await your_service.your_action(sender.id, recipient.id, ...)
    
    # Verify notification was created correctly
    from app.repositories.notification_repository import NotificationRepository
    notification_repo = NotificationRepository(db_session)
    notifications = await notification_repo.get_user_notifications(recipient.id, limit=10)
    
    assert len(notifications) == 1
    notification = notifications[0]
    
    # Verify notification shows correct username
    assert notification.type == "your_notification_type"
    assert "sender_user" in notification.message
    assert "Unknown User" not in notification.message
    
    # Verify data field contains username
    assert notification.data.get("sender_username") == "sender_user"
```

### Frontend Username Tests

```typescript
// Test username extraction logic
describe('Your Notification Username Extraction', () => {
  it('should extract sender_username from your notifications', () => {
    const notification = {
      data: { sender_username: 'testuser' },
      from_user: null
    }
    const username = extractUsername(notification)
    expect(username).toBe('testuser')
    expect(username).not.toBe('Unknown User')
  })
})
```

## 🔄 Quick Checklist for New Notifications

When implementing a new notification type, follow this checklist:

### Backend ✅
- [ ] Create notification method following `create_emoji_reaction_notification` pattern
- [ ] Use `NotificationRepository(db)` directly, not `NotificationService` instance methods
- [ ] Store username in `data` field with descriptive name (e.g., `sender_username`)
- [ ] Add logging for successful creation
- [ ] Create backend test verifying notification creation and username storage

### Frontend ✅
- [ ] Add your username field to both notification route handlers:
  - `apps/web/src/app/api/notifications/route.ts`
  - `apps/web/src/app/api/notifications/[notificationId]/children/route.ts`
- [ ] Add your field to the fallback chain in both `id` and `name` properties
- [ ] Create frontend test for username extraction logic

### Testing ✅
- [ ] Backend test: Verify notification creation and data storage
- [ ] Frontend test: Verify username extraction from your field
- [ ] Integration test: End-to-end notification flow
- [ ] Manual test: Check notification appears with correct username in UI

## 🚨 Common Pitfalls

1. **Don't use rate limiting** unless you properly implement the instance method
2. **Always update BOTH notification route files** - main route and children route
3. **Use descriptive field names** - `sender_username` not just `username`
4. **Test the complete flow** - backend creation AND frontend display
5. **Follow existing patterns** - don't reinvent notification creation logic

## 📚 Reference Examples

- **Working notification**: `create_emoji_reaction_notification` in `notification_service.py`
- **Username extraction**: `apps/web/src/app/api/notifications/route.ts`
- **Backend test**: `tests/integration/test_mention_fixes.py`
- **Frontend test**: `src/tests/api/notifications-username-fix.test.ts`

---

## 🍞 Toast Notification System Issues (SOLVED - December 2024)

### Issue: Toasts Not Visible in Browser

**Symptoms:**
- Toast functions are called successfully
- Tests pass and can find toast elements in DOM
- Console logs show toasts being created
- But toasts are completely invisible in the actual browser

**Root Cause:**
Ancestor elements with CSS properties like `transform`, `filter`, `contain`, or `overflow: hidden` create new stacking contexts that break `position: fixed` positioning. The toast container was rendered inside the normal component tree, making it subject to these stacking context constraints.

**Solution: Portal-Based Rendering**

The fix involves rendering toasts directly into `document.body` via React Portal to completely isolate them from ancestor stacking contexts.

**Key Files Changed:**

1. **`ToastPortal.tsx`** - New portal component:
```typescript
export default function ToastPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let el = document.getElementById("toast-root") as HTMLElement | null
    if (!el) {
      el = document.createElement("div")
      el.id = "toast-root"
      Object.assign(el.style, {
        position: "fixed",
        top: "0",
        right: "0",
        zIndex: String(2147483647),
        pointerEvents: "none",
      })
      document.body.appendChild(el)
    }
    setTarget(el)
  }, [])

  if (!target) return null
  return createPortal(children, target)
}
```

2. **`ToastContext.tsx`** - Updated to use portal:
```typescript
return (
  <ToastContext.Provider value={value}>
    {children}
    <ToastPortal>
      <div className="p-4 space-y-2 pointer-events-none flex flex-col items-end max-w-full">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastNotification toast={toast} onClose={hideToast} />
          </div>
        ))}
      </div>
    </ToastPortal>
  </ToastContext.Provider>
)
```

3. **`ToastNotification.tsx`** - Fixed animation timing:
```typescript
useEffect(() => {
  // Use double requestAnimationFrame for proper animation timing
  let raf1 = requestAnimationFrame(() => {
    let raf2 = requestAnimationFrame(() => setIsVisible(true))
    ;(setIsVisible as any)._raf2 = raf2
  })
  return () => {
    cancelAnimationFrame(raf1)
    if ((setIsVisible as any)._raf2) cancelAnimationFrame((setIsVisible as any)._raf2)
  }
}, [])
```

**Why This Works:**
- **Portal Isolation**: Toasts render outside the normal component tree, avoiding stacking context issues
- **Proper Animation**: `requestAnimationFrame` ensures transitions fire correctly
- **Maximum Z-Index**: Uses the highest possible z-index value
- **Pointer Events**: Proper event handling prevents click-through issues

**Testing:**
- All existing tests continue to pass (they only check DOM presence, not visual rendering)
- Manual testing shows toasts now appear reliably in all browsers
- Portal doesn't affect test behavior since JSDOM doesn't apply CSS

### Issue: Toast Click-Through

**Symptoms:**
- Toasts appear but clicking on them doesn't close them
- Clicks pass through to elements behind the toast

**Solution:**
Ensure proper pointer events on the toast element itself:

```typescript
<div 
  className="rounded-lg border shadow-lg p-4 cursor-pointer relative"
  onClick={handleToastClick}
  style={{ pointerEvents: 'auto' }}
>
```

**Key Points:**
- Container has `pointer-events-none` to allow clicks outside toasts
- Individual toast wrappers have `pointer-events-auto` 
- Toast content itself needs explicit `pointerEvents: 'auto'` style

### Issue: Unwanted Reaction/Heart Toasts

**Symptoms:**
- Success toasts appear when users react to posts or heart them
- Creates visual clutter and interrupts user flow
- "Reaction Added!" and "Post Hearted!" messages show unnecessarily

**Solution:**
Remove success toast notifications for reactions and hearts while keeping error toasts:

```typescript
// ❌ WRONG - Shows success toast for every reaction
hideToast(loadingToastId)
showSuccess('Reaction Added!', 'Your reaction has been added to the post')

// ✅ CORRECT - Only hide loading toast, no success message
hideToast(loadingToastId)
```

**Key Points:**
- Keep loading toasts during the action for user feedback
- Remove success toasts to reduce visual noise
- Maintain error toasts for failed actions
- Visual feedback from UI state changes (heart count, reaction display) is sufficient

### Issue: Loading Toast "Metrics Bar" Appearance (December 2024)

**Symptoms:**
- Blue horizontal bar-like elements appear at top-right when liking/reacting
- Users perceive loading toasts as unwanted "metrics bars"
- Visual clutter during common user interactions
- Loading toasts appear more prominent after ToastPortal implementation

**Root Cause:**
Loading toasts for reactions and hearts create unnecessary visual noise since:
1. These actions are typically fast (< 1 second)
2. The UI provides immediate visual feedback (heart count changes, reaction animations)
3. The blue `bg-blue-50 border-blue-200` styling creates a bar-like appearance
4. ToastPortal positioning makes toasts more visible at top-right

**Solution:**
Remove loading toasts for reactions and hearts entirely:

```typescript
// ❌ WRONG - Shows loading toast for fast actions
const loadingToastId = showLoading('Adding reaction...', 'Please wait')
// ... API call ...
hideToast(loadingToastId)

// ✅ CORRECT - No loading toast for reactions/hearts
const loadingToastId = '' // Placeholder for error handling
// ... API call ...
// Note: No loading toast to hide
```

**Implementation:**
1. **Remove loading toast creation** for reactions and hearts
2. **Keep error toasts** for failed actions (network errors, etc.)
3. **Maintain visual feedback** through UI state changes
4. **Use placeholder loadingToastId** for error handling compatibility

**Files Changed:**
- `apps/web/src/components/PostCard.tsx` - Removed loading toasts for reactions and hearts
- `apps/web/src/components/ToastNotification.tsx` - Changed loading toast colors to gray (less prominent)

**Key Points:**
- Fast actions (< 1 second) don't need loading toasts
- UI state changes provide sufficient feedback
- Error toasts remain for actual failures
- Reduces visual noise and improves user experience

---

## 🔍 Mention System Console Errors (SOLVED - December 2024)

### Issue: Console 404 Errors for Invalid Usernames

**Symptoms:**
- Console shows multiple 404 errors like:
  ```
  GET http://localhost:3000/api/users/username/Bob7%3F%3F 404 (Not Found)
  ```
- Errors appear when posts contain mentions with special characters
- Valid usernames still work, but console is cluttered with errors

**Root Cause:**
The mention regex was too permissive, allowing special characters like `?`, `!`, `+` in usernames:

```javascript
// ❌ OLD (problematic)
/@([a-zA-Z0-9_\-\.\?\!\+]+)/g
```

This caused extraction of invalid usernames like:
- `@Bob7??` → extracted `Bob7??` 
- `@user+name` → extracted `user+name`
- `@test!user` → extracted `test!user`

These invalid usernames were then validated against the API, causing 404 errors.

**Solution:**

1. **Restricted the regex** to only match realistic username patterns:
   ```javascript
   // ✅ NEW (fixed)
   /@([a-zA-Z0-9_\-\.]+)/g
   ```

2. **Added validation filter** in PostCard to prevent API calls for invalid usernames:
   ```javascript
   const validFormatUsernames = usernames.filter(isValidUsername)
   ```

3. **Updated validation function** to match the new regex:
   ```javascript
   const usernameRegex = /^[a-zA-Z0-9_\-\.]{1,50}$/
   ```

**What Changed:**
- **Allowed characters**: letters, numbers, underscores, dots, dashes
- **Removed support for**: `?`, `!`, `+`, `@`, spaces, and other special characters
- **Added client-side validation** to prevent unnecessary API calls

**Result:**
- ✅ No more console 404 errors for invalid usernames
- ✅ Only realistic usernames are validated against the API
- ✅ Valid usernames like `alice.doe-123`, `user_name`, `Bob7` still work
- ✅ All tests pass

**Files Modified:**
- `apps/web/src/utils/mentionUtils.ts` - Updated regex and validation
- `apps/web/src/components/PostCard.tsx` - Added validation filter
- `apps/web/src/tests/utils/mentionUtils.special-chars.test.ts` - Updated tests

**Key Points:**
- Username extraction should match realistic patterns only
- Client-side validation prevents unnecessary API calls
- Console errors indicate potential user experience issues
- Regex patterns should be conservative for usernames

---

## 📤 File Upload FormData Issues (SOLVED - August 2025)

### Issue: 422 Unprocessable Entity on File Uploads

**Symptoms:**
- File upload endpoints return 422 "Unprocessable Entity" errors
- Frontend FormData creation appears correct
- Backend logs show requests reaching the endpoint
- FastAPI validation fails with "field required" errors
- File uploads work with direct curl but fail through Next.js API routes

**Root Cause:**
The `createAuthHeaders()` function in `apps/web/src/lib/api-utils.ts` was **always** setting `Content-Type: application/json`, which overrode the multipart boundary that fetch automatically sets for FormData.

**Evidence of the Problem:**
```typescript
// ❌ PROBLEMATIC - Always sets Content-Type
export function createAuthHeaders(request: NextRequest): Record<string, string> {
  const token = getAuthToken(request)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',  // ← THIS BREAKS FORMDATA!
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}
```

**Debug Evidence:**
- ✅ Next.js FormData creation was perfect
- ✅ Raw request body contained proper multipart data with boundaries
- ❌ Content-Type header was `application/json` instead of `multipart/form-data; boundary=...`
- ❌ FastAPI couldn't parse the file because of wrong Content-Type

**Solution:**

**File: `apps/web/src/app/api/users/me/profile/photo/route.ts`**

```typescript
// ❌ WRONG - Uses createAuthHeaders which sets Content-Type
const authHeaders = createAuthHeaders(request)
const response = await fetch(url, {
  headers: authHeaders, // ← Overrides FormData Content-Type
  body: backendFormData
})

// ✅ CORRECT - Create headers WITHOUT Content-Type for FormData
const token = getAuthToken(request)
const headers: Record<string, string> = {}
if (token) {
  headers['Authorization'] = `Bearer ${token}`
}

// ✅ Let fetch set Content-Type automatically for FormData
const response = await fetch(url, {
  headers, // ← Only Authorization, no Content-Type
  body: backendFormData
})
```

**Key Technical Points:**

1. **Never set Content-Type manually with FormData**: Let fetch handle it automatically
2. **FormData requires proper multipart boundaries**: Manual Content-Type breaks this
3. **Authentication headers can be set separately**: Only Authorization is needed
4. **Debug raw request bodies**: Essential for diagnosing multipart issues

**Verification Results:**

**Before Fix:**
```
🔍 Content-Type: application/json
🔍 Parsed file: None
🔍 File received: false
```

**After Fix:**
```
🔍 Content-Type: multipart/form-data; boundary=----formdata-undici-027685962229
🔍 Parsed file: test.png
🔍 File content type: application/octet-stream
🔍 File size: 15
🔍 File received: true
```

**Testing the Fix:**

Create a test to verify FormData forwarding:

```javascript
// Test file: test_formdata_fix.js
async function testFormDataFix() {
  const formData = new FormData();
  formData.append('file', new Blob(['test data'], { type: 'image/png' }), 'test.png');
  
  const response = await fetch('http://localhost:3000/api/users/me/profile/photo', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer fake-token' },
    body: formData
  });
  
  // Should get 401 (auth error) not 422 (validation error)
  expect(response.status).toBe(401); // Not 422!
}
```

**Files Modified:**
- `apps/web/src/app/api/users/me/profile/photo/route.ts` - Fixed FormData forwarding
- `apps/web/src/lib/api-utils.ts` - Documented the Content-Type issue

**Common Patterns for File Upload Routes:**

```typescript
// ✅ CORRECT Pattern for any file upload API route
export async function POST(request: NextRequest) {
  // Get file from FormData
  const formData = await request.formData()
  const file = formData.get('file') as File
  
  // Create FormData for backend
  const backendFormData = new FormData()
  backendFormData.append('file', file, file.name)
  
  // ✅ CRITICAL: Create headers WITHOUT Content-Type
  const token = getAuthToken(request)
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // DO NOT SET Content-Type!
  
  // ✅ Let fetch handle Content-Type automatically
  const response = await fetch(backendUrl, {
    method: 'POST',
    headers, // Only auth headers
    body: backendFormData
  })
}
```

**Key Debugging Commands:**

```bash
# Test FastAPI endpoint directly (should work)
curl -X POST "http://localhost:8000/api/v1/users/me/profile/photo" \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.png"

# Test Next.js proxy (should also work after fix)
curl -X POST "http://localhost:3000/api/users/me/profile/photo" \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.png"
```

**Error Status Code Guide:**
- **422 Unprocessable Entity**: FormData/validation issue (the bug we fixed)
- **401 Unauthorized**: Authentication issue (expected with fake tokens)
- **400 Bad Request**: Missing file or other client error
- **500 Internal Server Error**: Backend processing error

**Prevention Checklist:**
- [ ] Never use `createAuthHeaders()` for file upload routes
- [ ] Never manually set `Content-Type` when sending FormData
- [ ] Always let fetch set Content-Type automatically for multipart data
- [ ] Test with both valid and invalid auth tokens
- [ ] Verify 401 (not 422) errors with invalid auth
- [ ] Check backend logs for proper multipart parsing

**Key Points:**
- This bug affects ALL file upload endpoints using Next.js API routes
- The fix is simple but critical: don't set Content-Type manually
- Always test the complete flow: frontend → Next.js → FastAPI
- 422 errors indicate FormData serialization issues, not business logic errors

---

## 🔐 User Authentication Context Issues (SOLVED - January 2025)

### Issue: Users Logged Out When Visiting Post Pages

**Symptoms:**
- User is logged in and can access feed, profile pages normally
- When visiting a shared post link (e.g., `/post/a2378e28-1d32-4eb3-82eb-145d6109d53c`), user appears logged out
- Navbar shows "Log In / Sign Up" buttons instead of authenticated user info
- Console error: `TypeError: Cannot read properties of undefined (reading 'toString')`
- User gets logged out and has to log in again

**Root Cause:**
The UserContext was trying to access user data directly from the API response, but the backend wraps responses in a standardized format. The frontend was accessing `userData.id` when it should have been accessing `userData.data.id`.

**Backend API Response Format:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "username": "user",
    "email": "user@example.com",
    "display_name": "User Name",
    // ... other user fields
  },
  "timestamp": "2025-01-01T00:00:00Z",
  "request_id": "uuid"
}
```

**Problem Code:**
```typescript
// ❌ WRONG - Accessing wrapped response directly
if (response.ok) {
  const userData = await response.json()
  if (userData && userData.id) {  // ← userData.id is undefined!
    setCurrentUser({
      id: userData.id.toString(),  // ← Causes toString() error
      name: userData.name || userData.username,
      // ...
    })
  }
}
```

**Solution:**

**File: `apps/web/src/contexts/UserContext.tsx`**

```typescript
// ✅ CORRECT - Extract data from wrapped response
if (response.ok) {
  const apiResponse = await response.json()
  const userData = apiResponse.data  // ← Extract data from wrapper
  
  // Safely handle user data and ensure id exists before converting
  if (userData && userData.id) {
    setCurrentUser({
      id: userData.id.toString(),
      name: userData.display_name || userData.name || userData.username,
      username: userData.username,
      email: userData.email,
      image: userData.profile_image_url
    })
  } else {
    // Invalid user data, remove token
    localStorage.removeItem('access_token')
    setCurrentUser(null)
  }
}
```

**Key Changes:**
1. **Extract data from wrapper**: `const userData = apiResponse.data`
2. **Better name handling**: Use `display_name` as primary, fallback to `name` or `username`
3. **Robust error handling**: Remove invalid tokens and handle malformed responses
4. **Safe property access**: Check `userData` exists before accessing properties

**API Response Patterns:**
- **User Profile API** (`/api/v1/users/me/profile`): Returns wrapped response with `success_response()`
- **Posts API** (`/api/v1/posts/{id}`): Returns direct `PostResponse` (not wrapped)
- **Notifications API** (`/api/v1/notifications`): Returns direct array (not wrapped)

**Testing the Fix:**

Create comprehensive tests to verify the fix:

```typescript
// Test file: src/tests/integration/user-context-authentication.test.tsx
describe('UserContext Authentication Fix', () => {
  it('should correctly parse wrapped API response from backend', async () => {
    const mockApiResponse = {
      success: true,
      data: {
        id: 123,
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        profile_image_url: 'https://example.com/avatar.jpg'
      },
      timestamp: '2023-01-01T00:00:00Z',
      request_id: 'test-request-id'
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    })

    // Test that user data is correctly extracted and parsed
    // ... test implementation
  })

  it('should handle malformed API response correctly', async () => {
    const malformedResponse = {
      success: true,
      // Missing 'data' field
      timestamp: '2023-01-01T00:00:00Z'
    }
    
    // Should handle gracefully and remove invalid token
    // ... test implementation
  })
})
```

**Verification Results:**

**Before Fix:**
- ❌ Console error: `Cannot read properties of undefined (reading 'toString')`
- ❌ User appears logged out on post pages
- ❌ Shows "Log In / Sign Up" buttons for authenticated users
- ❌ User gets logged out and loses session

**After Fix:**
- ✅ No console errors
- ✅ User stays logged in on all pages
- ✅ Shows authenticated navbar with user info
- ✅ User can interact with posts (heart, react, etc.)
- ✅ Authentication state maintained across navigation

**Files Modified:**
- `apps/web/src/contexts/UserContext.tsx` - Fixed API response parsing
- `apps/web/src/tests/integration/user-context-authentication.test.tsx` - Added comprehensive tests

**Prevention Checklist:**
- [ ] Always check backend API response format before parsing
- [ ] Test authentication flow on all pages, not just main app pages
- [ ] Verify shared/public links work for both authenticated and unauthenticated users
- [ ] Add error handling for malformed API responses
- [ ] Test with both valid and invalid tokens
- [ ] Check console for JavaScript errors during authentication

**Key Points:**
- Different backend endpoints may use different response formats (wrapped vs direct)
- Always extract data from the correct level of the response object
- Shared post links are a common place where authentication issues surface
- UserContext errors can cause users to be unexpectedly logged out
- Proper error handling prevents authentication state corruption

**Debugging Commands:**

```bash
# Test backend API directly
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/users/me/profile

# Check response format
{
  "success": true,
  "data": { ... },  # ← Data is nested here
  "timestamp": "...",
  "request_id": "..."
}

# Test frontend API proxy
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/users/me/profile
```

**Related Issues:**
- This pattern may affect other API calls that expect wrapped responses
- Always verify response format when integrating new backend endpoints
- Consider creating a utility function for parsing wrapped API responses

---

*This document should be updated whenever new notification patterns are discovered or when these issues are encountered again.*