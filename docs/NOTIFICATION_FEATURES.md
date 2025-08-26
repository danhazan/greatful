# Notification System Features

## Core Features (Implemented/Planned)

### 1. In-App Notifications ✅ (Implemented)
- ✅ Notification bell in navbar with unread count
- ✅ Dropdown panel showing recent notifications
- ✅ Mark as read functionality (individual and bulk)
- ✅ Notification data includes post/user context
- ✅ Rate limiting and spam prevention
- ✅ Real-time notification creation from user actions

### 2. Notification Types
- **emoji_reaction**: When someone reacts with an emoji to your post
- **like**: When someone likes your post
- **comment**: When someone comments on your post
- **follow**: When someone follows you (new_follower)
- **mention**: When someone mentions you in a post
- **post_shared**: When someone shares your post
- **system**: Account/security notifications
- (Easily extensible for new types)

### 3. Notification Data Model
- type: string (like, comment, follow, etc.)
- priority: string (low, normal, high)
- title: string
- message: string
- data: JSON (postId, userId, etc.)
- channel: string (in_app, email, ...)
- readAt: timestamp
- createdAt: timestamp

### 4. API Endpoints
- GET /api/v1/notifications (list, unread filter, pagination)
- GET /api/v1/notifications/summary (unread count and total count)
- POST /api/v1/notifications/{notification_id}/read (mark specific notification as read)
- POST /api/v1/notifications/read-all (mark all notifications as read)
- GET /api/v1/notifications/stats (notification statistics and rate limit info)

### 5. Rate Limiting & Spam Prevention

#### Rate Limiting Configuration
- **Maximum Notifications**: 20 notifications per hour per notification type
- **Time Window**: Rolling 1-hour window
- **Per-Type Limits**: Each notification type has separate rate limits
- **Behavior**: When limit is exceeded, additional notifications are blocked (not queued)

#### Rate Limiting by Type
| Notification Type | Max Per Hour | Purpose |
|------------------|--------------|---------|
| emoji_reaction   | 20          | Prevent reaction spam while allowing social engagement |
| like             | 20          | Prevent like spam |
| comment          | 20          | Prevent comment notification spam |
| follow           | 20          | Prevent follow spam |
| mention          | 20          | Prevent mention spam |
| post_shared      | 20          | Prevent share spam |

#### Rate Limit Monitoring
- **Stats Endpoint**: `/api/v1/notifications/stats` provides rate limit information
- **Remaining Count**: Shows how many notifications can still be sent
- **Time Window**: Shows current hour's notification count
- **Per-Type Tracking**: Separate limits for each notification type

#### Implementation Details
- Rate limiting is enforced at the service layer (`NotificationService`)
- Uses database queries to count notifications in the last hour
- Timezone-aware calculations (UTC-based)
- Graceful degradation: blocked notifications are logged but don't cause errors

#### Example Rate Limit Response
```json
{
  "user_id": 123,
  "notification_type": "emoji_reaction",
  "last_hour": 15,
  "last_day": 45,
  "total": 150,
  "rate_limit_remaining": 5
}
```

---

## Future Features

### 5. Notification Settings
- User can subscribe/unsubscribe to notification types
- User can enable/disable channels (in-app, email, push)
- Centralized settings page (future)

### 6. Email Notifications
- Support for email channel (high-priority or user-selected types)
- Email templates for different notification types
- (Planned, not implemented yet)

### 7. Real-Time Notifications
- Websockets or polling for instant updates
- Live update of bell and dropdown
- (Planned, not implemented yet)

### 8. Notification Details Page
- Full page to view all notifications
- Filter by type, mark all as read, batch actions
- (Planned, not implemented yet)

### 9. Batch Actions
- ✅ Mark all as read (implemented)
- Delete notifications (planned)
- Bulk notification management (planned)

### 10. Extensibility
- Add new notification types and channels easily
- Priority/highlighting for urgent notifications
- Flexible data model for linking to posts, users, etc.

---

## Summary
- The notification system is designed to be generic, extensible, and user-friendly.
- MVP focuses on in-app notifications, with future support for email, real-time, and user settings.
- All features are documented for easy tracking and future planning. 