# Notification System Features

## Core Features (Implemented/Planned)

### 1. In-App Notifications (MVP)
- Notification bell in navbar with unread count
- Dropdown panel showing recent notifications
- Mark as read functionality
- Clickable notifications (link to post, profile, etc.)
- Priority field for sorting/highlighting

### 2. Notification Types
- Like
- Comment
- Follow
- Mention
- System (account/security)
- Reminder
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
- GET /api/notifications (list, unread filter, pagination)
- POST /api/notifications (trigger notification)
- (Planned) POST /api/notifications/mark-read (mark as read)

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
- Mark all as read
- Delete notifications
- (Planned, not implemented yet)

### 10. Extensibility
- Add new notification types and channels easily
- Priority/highlighting for urgent notifications
- Flexible data model for linking to posts, users, etc.

---

## Summary
- The notification system is designed to be generic, extensible, and user-friendly.
- MVP focuses on in-app notifications, with future support for email, real-time, and user settings.
- All features are documented for easy tracking and future planning. 