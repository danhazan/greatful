# GPT-5 Debugging Prompt: Grateful App Notification System Issues

## Context
You are debugging a Next.js + FastAPI social gratitude app called "Grateful". The notification system has two critical bugs that need immediate resolution.

## Current Tech Stack
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), SQLAlchemy, PostgreSQL
- **Authentication**: JWT tokens
- **Architecture**: Frontend proxies API calls to FastAPI backend

## Bug Reports

### 🚨 **BUG 1: Notification Click Handler 500 Error**

**Error Details:**
```
POST http://localhost:3000/api/notifications/cd18fe08-10c0... 500 (Internal Server Error)
markAsRead @ NotificationSystem.tsx:94
onClick @ NotificationSystem.tsx:226
```

**Current Implementation:**
- Frontend calls: `POST /api/notifications/{notificationId}/read`
- This should mark a notification as read
- Getting 500 error when clicking any notification

**Expected Behavior:**
- User clicks notification → notification marked as read → UI updates → no errors

### 🚨 **BUG 2: Missing Emoji Reaction Notifications**

**Issue:**
- When users react to posts with emojis, no notifications are created
- The reaction system works (emojis are saved, counts update)
- But post authors never receive notifications about reactions

**Expected Behavior:**
- User A reacts to User B's post with 😍 emoji
- User B receives notification: "User A reacted with 😍 to your post"
- Notification appears in User B's notification dropdown

**Current Status:**
- Emoji reactions save correctly to database
- Reaction viewer shows reactions properly
- But notification creation is missing/broken

## Current File Structure

### Backend Files (FastAPI)
```
apps/api/app/
├── api/v1/
│   ├── notifications.py     # Notification API endpoints
│   ├── reactions.py         # Emoji reaction endpoints
│   └── likes.py            # Heart/like endpoints
├── models/
│   ├── notification.py     # Notification database model
│   └── emoji_reaction.py   # Reaction database model
├── services/
│   ├── notification_service.py  # Notification business logic
│   └── reaction_service.py      # Reaction business logic
```

### Frontend Files (Next.js)
```
apps/web/src/
├── app/api/notifications/
│   ├── route.ts                    # Proxy to FastAPI notifications
│   └── [notificationId]/read/route.ts  # Mark as read endpoint
├── components/
│   ├── NotificationSystem.tsx      # Main notification UI
│   ├── PostCard.tsx               # Post component with reactions
│   └── EmojiPicker.tsx            # Emoji reaction picker
```

## Key Questions for Investigation

### For Bug 1 (500 Error):
1. **Does the backend endpoint exist?** Check if `POST /api/v1/notifications/{id}/read` exists in FastAPI
2. **Is the frontend proxy correct?** Verify `/api/notifications/{id}/read` route.ts properly forwards to backend
3. **Are notification IDs valid?** Check if notification IDs from frontend match backend format
4. **Database constraints?** Verify notification table structure and foreign key constraints

### For Bug 2 (Missing Notifications):
1. **Is notification creation called?** Check if `reaction_service.py` calls notification service when reactions are added
2. **Are reaction notifications implemented?** Verify if notification service has emoji reaction notification logic
3. **Database integration?** Check if notifications are being saved to database when reactions occur
4. **Frontend integration?** Verify if reaction API calls trigger notification creation

## Debugging Approach

### Step 1: Analyze Current Code
Please examine these key files to understand the current implementation:
- `apps/api/app/api/v1/notifications.py`
- `apps/api/app/services/notification_service.py`
- `apps/api/app/api/v1/reactions.py`
- `apps/web/src/app/api/notifications/[notificationId]/read/route.ts`
- `apps/web/src/components/NotificationSystem.tsx`

### Step 2: Identify Root Causes
For each bug, determine:
- What's missing in the current implementation?
- Are there API endpoint mismatches?
- Are there database/model issues?
- Are there frontend-backend integration problems?

### Step 3: Provide Solutions
For each identified issue:
- Provide specific code fixes
- Explain the root cause
- Include any necessary database changes
- Ensure solutions maintain existing functionality

## Expected Deliverables

1. **Root Cause Analysis**: Clear explanation of what's causing each bug
2. **Code Fixes**: Specific code changes needed for each file
3. **Testing Strategy**: How to verify the fixes work
4. **Prevention**: Recommendations to prevent similar issues

## Additional Context

### Notification Types Currently Supported:
- `reaction` - Emoji reactions to posts
- `like` - Heart/like notifications  
- `comment` - Comment notifications (future)
- `follow` - Follow notifications (future)

### Database Schema (Key Tables):
```sql
-- Notifications table
notifications (
  id UUID PRIMARY KEY,
  user_id INTEGER,  -- recipient
  type VARCHAR(50),
  title VARCHAR(100),
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  read_at TIMESTAMP
)

-- Emoji reactions table  
emoji_reactions (
  id UUID PRIMARY KEY,
  user_id INTEGER,  -- who reacted
  post_id UUID,     -- which post
  emoji_code VARCHAR(20),  -- which emoji
  created_at TIMESTAMP
)
```

### Current Working Features:
- User authentication ✅
- Post creation ✅  
- Emoji reaction UI ✅
- Emoji reaction saving ✅
- Notification UI component ✅
- Notification fetching ✅

### Broken Features:
- Notification click handling ❌
- Emoji reaction notification creation ❌

Please analyze the codebase and provide comprehensive solutions for both bugs.