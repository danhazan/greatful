# Common Fixes for Development Issues

This document contains solutions to recurring issues that happen during development, especially when implementing new notification types or social features.

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

---

*This document should be updated whenever new notification patterns are discovered or when these issues are encountered again.*