# Notification System Debug - Two Critical Bugs Need Fixes

I need help debugging two critical bugs in my Next.js + FastAPI notification system for a social gratitude app called "Grateful". I've attached all the relevant source files.

## System Architecture
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: FastAPI with SQLAlchemy and PostgreSQL
- **Authentication**: JWT tokens stored in localStorage
- **API Flow**: Next.js API routes proxy requests to FastAPI backend

## Bug 1: 500 Error When Clicking Notifications

**Error Details:**
```
POST http://localhost:3000/api/notifications/cd18fe08-10c0... 500 (Internal Server Error)
markAsRead @ NotificationSystem.tsx:94
onClick @ NotificationSystem.tsx:226
```

**Expected Behavior:**
- User clicks notification in dropdown
- Notification marked as read in database
- UI updates to show notification as read
- No errors

**Current Behavior:**
- Clicking any notification triggers 500 error
- Notification remains unread
- Frontend shows error in console

## Bug 2: Missing Emoji Reaction Notifications

**Expected Behavior:**
- User A reacts to User B's post with emoji (😍, 🙏, etc.)
- User B receives notification: "User A reacted with 😍 to your post"
- Notification appears in User B's notification dropdown

**Current Behavior:**
- Emoji reactions save correctly to database
- Reaction counts update in UI
- Emoji picker works perfectly
- BUT no notifications are created for post authors

## What Currently Works
- User authentication and JWT tokens
- Post creation and display
- Emoji reaction UI (picker, display, counts)
- Emoji reaction saving to database
- Notification fetching and display (when they exist)
- Heart/like notifications (these work correctly)

## Database Schema Context
```sql
-- Notifications table
notifications (
  id UUID PRIMARY KEY,
  user_id INTEGER,      -- notification recipient
  type VARCHAR(50),     -- 'reaction', 'like', 'comment', etc.
  title VARCHAR(100),
  message TEXT,
  data JSONB,           -- stores reaction details
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  read_at TIMESTAMP
)

-- Emoji reactions table
emoji_reactions (
  id UUID PRIMARY KEY,
  user_id INTEGER,      -- who made the reaction
  post_id UUID,         -- which post was reacted to
  emoji_code VARCHAR(20), -- 'heart_eyes', 'pray', etc.
  created_at TIMESTAMP
)
```

## Key Files Attached

**Backend (FastAPI):**
- `notifications.py` - Notification API endpoints
- `reactions.py` - Emoji reaction API endpoints  
- `notification_service.py` - Notification business logic
- `reaction_service.py` - Reaction business logic
- `notification.py` - Database model

**Frontend (Next.js):**
- `NotificationSystem.tsx` - Main notification UI component
- `[notificationId]/read/route.ts` - Next.js API route for marking as read
- `route.ts` - Next.js API route for fetching notifications

## Specific Questions

1. **Bug 1 Analysis**: Does the FastAPI backend have a `PUT/PATCH /api/v1/notifications/{id}/read` endpoint? The frontend is trying to call this via the Next.js proxy.

2. **Bug 2 Analysis**: In the reaction creation flow, is the notification service being called? The flow should be:
   - User clicks emoji → Frontend calls reaction API
   - Backend saves reaction to database
   - Backend calls notification service to create notification
   - Post author receives notification

3. **Integration Issues**: Are there missing service calls or endpoint implementations?

## What I Need

Please analyze the attached files and provide:

1. **Root cause identification** for each bug
2. **Specific code fixes** with exact file locations
3. **Step-by-step implementation** instructions
4. **Testing commands** to verify the fixes work
5. **Any missing database migrations** or schema changes needed

The system handles heart/like notifications correctly, so use that as a reference for how emoji reaction notifications should work.

Focus on the exact missing pieces in the code - likely missing API endpoints, missing service integration calls, or incorrect API routing.