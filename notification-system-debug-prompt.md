# COMPREHENSIVE NOTIFICATION SYSTEM DEBUG PROMPT FOR GPT-5

## PROBLEM STATEMENT
The notification system in our Grateful social app is not working in the live application, despite all tests passing (97/97 backend tests, 23/23 frontend test suites). When users react with emojis to posts, notifications should be created and displayed in the purple bell dropdown, but they are not appearing.

## SYSTEM ARCHITECTURE

### Backend (FastAPI + PostgreSQL)
- **Notification Service**: `apps/api/app/services/notification_service.py`
- **Reaction Service**: `apps/api/app/services/reaction_service.py` 
- **Notification API**: `apps/api/app/api/v1/notifications.py`
- **Reaction API**: `apps/api/app/api/v1/reactions.py`

### Frontend (Next.js + TypeScript)
- **Notification System Component**: `apps/web/src/components/NotificationSystem.tsx`
- **Navbar Component**: `apps/web/src/components/Navbar.tsx`
- **API Route**: `apps/web/src/app/api/notifications/route.ts`

## EXPECTED FLOW
1. User A reacts with emoji 😍 to User B's post
2. `ReactionService.add_reaction()` is called
3. Inside `add_reaction()`, `NotificationService.create_emoji_reaction_notification()` is called
4. Notification is created in database with type 'emoji_reaction'
5. Frontend fetches notifications via `/api/notifications`
6. Notifications appear in purple bell dropdown with unread count

## CURRENT IMPLEMENTATION DETAILS

### Backend Notification Creation
```python
# In ReactionService.add_reaction()
if post.author_id != user_id:  # Don't notify if user reacts to their own post
    notification = await NotificationService.create_emoji_reaction_notification(
        db=db,
        post_author_id=post.author_id,
        reactor_username=user.username,
        emoji_code=emoji_code,
        post_id=post_id
    )
```

### Frontend Notification Fetching
```typescript
// In NotificationSystem.tsx
const fetchNotifications = async () => {
  const response = await fetch('/api/notifications', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const data = await response.json()
  setNotifications(data)
  const unreadCount = data.filter((n: Notification) => !n.read).length
  setUnreadCount(unreadCount)
}
```

### Data Transformation
```typescript
// In /api/notifications/route.ts
const transformedNotifications = notifications.map((notification: any) => ({
  id: notification.id,
  type: notification.type === 'emoji_reaction' ? 'reaction' : notification.type,
  message: notification.message,
  postId: notification.post_id || notification.data?.post_id || '',
  fromUser: {
    id: notification.from_user?.id || notification.data?.reactor_username || 'unknown',
    name: notification.from_user?.username || notification.data?.reactor_username || 'Unknown User',
    image: notification.from_user?.profile_image_url || undefined
  },
  createdAt: notification.created_at,
  read: notification.read
}))
```

## DEBUGGING EVIDENCE

### Test Results
- ✅ All 97 backend tests pass (including notification creation tests)
- ✅ All 23 frontend test suites pass (including notification API tests)
- ✅ Database cleared successfully before testing

### Debug Logs from Previous Session
```
🔍 DEBUG: Starting add_reaction - user: 2, post: 1eccf66a-83a7-487b-bd7d-f68321ef123a, emoji: heart_eyes
🔍 DEBUG: Calling notification service for new reaction...
🔍 DEBUG: Post author: 1, Reactor: 2
🔍 DEBUG: create_emoji_reaction_notification called
✅ DEBUG: Creating notification for user 1
🔍 DEBUG: Notification object created: <Notification(id=None, user_id=1, type=emoji_reaction)>
✅ DEBUG: Notification committed to database with ID: 91ffc8ac-ccd1-41a5-ab6d-781535c964a8
```

## POTENTIAL ISSUES TO INVESTIGATE

### 1. Database Session/Transaction Issues
- Are notifications being created in a different database session than what the API queries?
- Are transactions being properly committed?
- Is there a race condition between creation and fetching?

### 2. Authentication/Authorization Issues
- Is the frontend properly sending the JWT token?
- Is the backend properly extracting the user ID from the token?
- Are notifications being created for the correct user ID?

### 3. Data Format/Transformation Issues
- Is the backend returning notifications in the expected format?
- Is the frontend transformation logic working correctly?
- Are there missing fields causing the frontend to filter out notifications?

### 4. API Routing Issues
- Is the frontend calling the correct API endpoint?
- Is the Next.js API route properly forwarding requests to the backend?
- Are there CORS or network issues?

### 5. Frontend State Management Issues
- Is the NotificationSystem component properly mounted with a valid user ID?
- Is the polling mechanism working correctly?
- Are there React state update issues?

### 6. Rate Limiting Issues
- Is the rate limiting logic preventing notification creation?
- Are notifications being created but immediately filtered out?

## DEBUGGING TASKS NEEDED

### 1. End-to-End Flow Verification
- Create a minimal test that creates a reaction and immediately checks for notifications
- Add comprehensive logging at each step of the flow
- Verify database state after each operation

### 2. API Response Analysis
- Log the exact response from the backend `/api/v1/notifications` endpoint
- Log the transformed response from the frontend `/api/notifications` route
- Compare expected vs actual data structures

### 3. Authentication Flow Verification
- Verify JWT token is being properly sent and decoded
- Ensure user IDs match between reaction creation and notification fetching
- Check for any authentication-related filtering

### 4. Database State Inspection
- Query the notifications table directly after creating reactions
- Verify notification records exist with correct user_id and data
- Check for any database constraints or triggers affecting notifications

### 5. Frontend Component Analysis
- Add detailed logging to NotificationSystem component
- Verify the component is receiving the correct user ID
- Check if notifications are being fetched but not displayed due to UI logic

## SPECIFIC QUESTIONS FOR GPT-5

1. **What is the most likely root cause** given that tests pass but live functionality doesn't work?

2. **What debugging steps** should be prioritized to quickly identify the issue?

3. **Are there any obvious gaps** in the current implementation that could cause this disconnect?

4. **What logging/monitoring** should be added to trace the complete notification flow?

5. **Could this be a timing/async issue** where notifications are created after the frontend has already fetched them?

6. **Are there any Next.js-specific considerations** for the API route that might be causing issues?

## ENVIRONMENT DETAILS
- **Backend**: FastAPI with async SQLAlchemy, PostgreSQL database
- **Frontend**: Next.js 14 with App Router, TypeScript
- **Authentication**: JWT tokens stored in localStorage
- **Database**: PostgreSQL with UUID primary keys
- **Deployment**: Development environment (localhost)

## REQUEST
Please provide a systematic debugging approach to identify why notifications are not appearing in the live application, including specific code changes, logging additions, and verification steps. Focus on the most likely causes first and provide actionable steps to resolve the issue.