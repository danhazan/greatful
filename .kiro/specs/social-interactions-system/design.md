# Social Interactions System - Design Document

## Overview

This design document outlines the technical architecture and implementation approach for the comprehensive social interactions system for the Grateful platform. The system extends the existing stable foundation (authentication, navbar, basic posts) with advanced social features including emoji reactions, sharing, mentions, and enhanced notifications.

The design follows the established patterns from the reference implementation, maintaining consistency with the purple-themed UI, component architecture, and API proxy patterns between Next.js frontend and FastAPI backend.

## Architecture

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                          │
├─────────────────────────────────────────────────────────────────┤
│  Components:                                                    │
│  • EmojiPicker          • ShareModal         • NotificationBell │
│  • ReactionViewer       • MentionAutocomplete • FollowButton    │
│  • Enhanced PostCard    • Enhanced Navbar                      │
├─────────────────────────────────────────────────────────────────┤
│  API Routes (Proxy):                                           │
│  • /api/reactions/*     • /api/shares/*      • /api/follows/*  │
│  • /api/mentions/*      • /api/notifications/*                 │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                            │
├─────────────────────────────────────────────────────────────────┤
│  API Endpoints:                                                 │
│  • /api/v1/posts/{id}/reactions  • /api/v1/posts/{id}/share    │
│  • /api/v1/users/search          • /api/v1/notifications       │
│  • /api/v1/follows/*             • /api/v1/mentions/*          │
├─────────────────────────────────────────────────────────────────┤
│  Services:                                                      │
│  • ReactionService      • ShareService       • NotificationSvc │
│  • MentionService       • FollowService      • AlgorithmSvc    │
├─────────────────────────────────────────────────────────────────┤
│  Database Models:                                               │
│  • EmojiReaction        • Share              • Mention         │
│  • Notification         • Follow             • UserPreference  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                Database (PostgreSQL)                           │
│  Tables: users, posts, emoji_reactions, shares, mentions,      │
│          notifications, follows, user_preferences              │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. EmojiPicker Component

**Purpose**: Modal component for selecting positive emoji reactions

**Props Interface**:
```typescript
interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onEmojiSelect: (emoji: string) => void
  currentReaction?: string
  position: { x: number, y: number }
}
```

**Features**:
- 8 predefined positive emojis: 😍, 🤗, 🙏, 💪, 🌟, 🔥, 🥰, 👏
- Smooth animation entrance/exit
- Keyboard navigation support
- Click outside to close
- Highlight currently selected emoji

**Styling**: Purple theme with rounded-lg borders, shadow-lg, and hover animations

#### 2. ReactionViewer Component

**Purpose**: Modal displaying all users who reacted and their specific reactions

**Props Interface**:
```typescript
interface ReactionViewerProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  reactions: Array<{
    user: { id: string, name: string, image: string }
    emoji: string
    createdAt: string
  }>
}
```

**Features**:
- Scrollable list of reactions
- User avatars and names
- Emoji display next to each user
- Click user to view profile
- Empty state for no reactions

#### 3. ShareModal Component

**Purpose**: Multi-option sharing interface with URL copy and simple message sending

**Props Interface**:
```typescript
interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  post: {
    id: string
    content: string
    author: { name: string }
  }
  onShare: (method: 'url' | 'message', data: any) => void
}
```

**Features**:
- Copy URL button with clipboard integration
- User search with mention autocomplete for message sending
- Simple "Send" button (no message composition)
- Multiple user selection (max 5)
- Share analytics tracking

#### 4. MentionAutocomplete Component

**Purpose**: User search dropdown for @username mentions

**Props Interface**:
```typescript
interface MentionAutocompleteProps {
  isOpen: boolean
  searchQuery: string
  onUserSelect: (user: User) => void
  onClose: () => void
  position: { x: number, y: number }
}
```

**Features**:
- Real-time user search
- Profile picture and name display
- Keyboard navigation (arrow keys, enter)
- Debounced search queries
- Maximum 10 results displayed

#### 5. NotificationDropdown Component

**Purpose**: In-app notification center in navbar

**Props Interface**:
```typescript
interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  unreadCount: number
  onNotificationClick: (notification: Notification) => void
}
```

**Features**:
- Unread count badge on bell icon
- Scrollable notification list
- Different icons for different notification types
- Mark as read on click
- "View all" link to full notifications page

#### 6. Enhanced PostCard Component

**Purpose**: Extended post display with new interaction options

**New Features Added**:
- Emoji reaction button and display
- Enhanced share button functionality
- Mention highlighting in post content
- Follow button on author info
- Reaction count display

### Backend Services

#### 1. ReactionService

**Purpose**: Handle emoji reactions on posts

**Key Methods**:
```python
class ReactionService:
    async def add_reaction(self, user_id: int, post_id: str, emoji: str) -> EmojiReaction
    async def remove_reaction(self, user_id: int, post_id: str) -> bool
    async def get_post_reactions(self, post_id: str) -> List[EmojiReaction]
    async def get_user_reaction(self, user_id: int, post_id: str) -> Optional[EmojiReaction]
```

**Business Logic**:
- One reaction per user per post (can change)
- Validate emoji against allowed list
- Create notifications for post authors
- Update post engagement scores

#### 2. ShareService

**Purpose**: Handle post sharing via URL and messages

**Key Methods**:
```python
class ShareService:
    async def generate_share_url(self, post_id: str) -> str
    async def share_via_message(self, sender_id: int, post_id: str, recipients: List[int]) -> List[Share]
    async def track_share_analytics(self, user_id: int, post_id: str, method: str) -> None
    async def check_rate_limit(self, user_id: int) -> bool
```

**Business Logic**:
- Generate SEO-friendly URLs
- Respect privacy settings
- Rate limiting (20 shares/hour)
- Create simple notifications for recipients
- Track share analytics

#### 3. MentionService

**Purpose**: Handle @username mentions in posts and messages

**Key Methods**:
```python
class MentionService:
    async def extract_mentions(self, content: str) -> List[str]
    async def create_mention_notifications(self, author_id: int, post_id: str, mentions: List[str]) -> None
    async def search_users(self, query: str, limit: int = 10) -> List[User]
    async def validate_mention_permissions(self, author_id: int, mentioned_user_id: int) -> bool
```

**Business Logic**:
- Parse @username patterns from text
- Validate mentioned users exist
- Check privacy/blocking settings
- Create mention notifications
- Highlight mentions in UI

#### 4. NotificationService

**Purpose**: Manage all notification types and delivery

**Key Methods**:
```python
class NotificationService:
    async def create_notification(self, user_id: int, type: str, data: dict) -> Notification
    async def get_user_notifications(self, user_id: int, limit: int = 50) -> List[Notification]
    async def mark_as_read(self, notification_ids: List[str]) -> None
    async def get_unread_count(self, user_id: int) -> int
```

**Notification Types**:
- `emoji_reaction`: "[User] reacted with [emoji] to your post"
- `post_shared`: "[User] shared your post"
- `post_sent`: "[User] sent you a post"
- `mention`: "[User] mentioned you in a post"
- `new_follower`: "[User] started following you"
- `share_milestone`: "Your post was shared [X] times today"

#### 5. FollowService

**Purpose**: Manage user follow relationships

**Key Methods**:
```python
class FollowService:
    async def follow_user(self, follower_id: int, followed_id: int) -> Follow
    async def unfollow_user(self, follower_id: int, followed_id: int) -> bool
    async def get_followers(self, user_id: int) -> List[User]
    async def get_following(self, user_id: int) -> List[User]
    async def is_following(self, follower_id: int, followed_id: int) -> bool
```

**Business Logic**:
- Prevent self-following
- Handle privacy settings
- Create follow notifications
- Update feed algorithm weights

#### 6. AlgorithmService

**Purpose**: Enhanced content scoring and feed generation

**Key Methods**:
```python
class AlgorithmService:
    async def calculate_post_score(self, post: Post, user_id: int) -> float
    async def get_personalized_feed(self, user_id: int, limit: int = 20) -> List[Post]
    async def update_post_scores(self, post_id: str) -> None
```

**Scoring Formula**:
```python
score = (
    (hearts_count * 1.0) +
    (emoji_reactions_count * 1.5) +
    (shares_count * 4.0) +
    (photo_bonus * 2.5) +
    (daily_gratitude_multiplier * 3.0) +
    (relationship_multiplier * 2.0) +
    recency_bonus -
    (reports_count * 10.0)
)
```

## Data Models

### Database Schema Extensions

#### 1. EmojiReaction Model

```sql
CREATE TABLE emoji_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    emoji_code VARCHAR(20) NOT NULL, -- 'heart_eyes', 'pray', 'star', etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, post_id) -- One reaction per user per post
);

CREATE INDEX idx_emoji_reactions_post_id ON emoji_reactions(post_id);
CREATE INDEX idx_emoji_reactions_user_id ON emoji_reactions(user_id);
```

#### 2. Share Model

```sql
CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    share_method VARCHAR(20) NOT NULL, -- 'url', 'message'
    recipient_user_ids INTEGER[], -- For message shares
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shares_post_id ON shares(post_id);
CREATE INDEX idx_shares_user_id ON shares(user_id);
CREATE INDEX idx_shares_created_at ON shares(created_at);
```

#### 3. Mention Model

```sql
CREATE TABLE mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    mentioned_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, mentioned_user_id) -- One mention per user per post
);

CREATE INDEX idx_mentions_mentioned_user_id ON mentions(mentioned_user_id);
CREATE INDEX idx_mentions_post_id ON mentions(post_id);
```

#### 4. Enhanced Notification Model

```sql
-- Extend existing notification table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emoji_code VARCHAR(20);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_user_id INTEGER REFERENCES users(id);

-- Add new notification types
-- 'emoji_reaction', 'post_shared', 'mention', 'new_follower', 'share_milestone'
```

#### 5. Follow Model

```sql
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    followed_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'pending', 'blocked'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(follower_id, followed_id),
    CHECK(follower_id != followed_id) -- Prevent self-following
);

CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_followed_id ON follows(followed_id);
```

#### 6. UserPreference Model

```sql
CREATE TABLE user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    allow_mentions BOOLEAN DEFAULT TRUE,
    allow_sharing BOOLEAN DEFAULT TRUE,
    privacy_level VARCHAR(20) DEFAULT 'public', -- 'public', 'followers', 'private'
    notification_settings JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Error Handling

### Frontend Error Handling

1. **Network Errors**: Show toast notifications with retry options
2. **Rate Limiting**: Display friendly messages about usage limits
3. **Permission Errors**: Clear messaging about privacy settings
4. **Validation Errors**: Inline form validation with helpful hints

### Backend Error Handling

1. **Rate Limiting**: HTTP 429 with retry-after headers
2. **Permission Denied**: HTTP 403 with clear error messages
3. **Not Found**: HTTP 404 for invalid post/user IDs
4. **Validation Errors**: HTTP 422 with detailed field errors

### Error Response Format

```json
{
  "error": "rate_limit_exceeded",
  "message": "You can only share 20 posts per hour. Try again in 15 minutes.",
  "details": {
    "limit": 20,
    "reset_time": "2025-01-08T15:30:00Z"
  }
}
```

## Testing Strategy

### Frontend Testing

1. **Component Tests**: Jest + React Testing Library
   - EmojiPicker interaction flows
   - ShareModal form validation
   - NotificationDropdown state management

2. **Integration Tests**: API route testing
   - Share functionality end-to-end
   - Mention autocomplete behavior
   - Notification delivery

3. **E2E Tests**: Playwright (future)
   - Complete social interaction workflows
   - Cross-browser compatibility

### Backend Testing

1. **Unit Tests**: Pytest
   - Service layer business logic
   - Database model relationships
   - Algorithm calculations

2. **Integration Tests**: FastAPI TestClient
   - API endpoint functionality
   - Authentication flows
   - Database transactions

3. **Performance Tests**: Load testing for:
   - Feed algorithm performance
   - Notification delivery at scale
   - Search functionality

## Performance Considerations

### Frontend Optimizations

1. **Component Lazy Loading**: Load modals only when needed
2. **Debounced Search**: 300ms delay for mention autocomplete
3. **Virtual Scrolling**: For large notification lists
4. **Optimistic Updates**: Immediate UI feedback for interactions

### Backend Optimizations

1. **Database Indexing**: Strategic indexes on foreign keys and timestamps
2. **Query Optimization**: Efficient joins for feed generation
3. **Caching Strategy**: Redis for frequently accessed data
4. **Rate Limiting**: Prevent abuse and ensure fair usage

### Caching Strategy

```python
# Example caching for user search
@cache(expire=300)  # 5 minutes
async def search_users(query: str) -> List[User]:
    # Implementation

# Example caching for post reactions
@cache(expire=60)  # 1 minute
async def get_post_reactions(post_id: str) -> List[EmojiReaction]:
    # Implementation
```

## Security Considerations

### Input Validation

1. **Emoji Validation**: Only allow predefined positive emojis
2. **Mention Validation**: Sanitize @username inputs
3. **Message Content**: XSS prevention in share messages
4. **Rate Limiting**: Prevent spam and abuse

### Privacy Controls

1. **Mention Permissions**: Users can disable mentions
2. **Share Permissions**: Users can disable sharing of their posts
3. **Follow Privacy**: Private accounts require approval
4. **Blocking System**: Blocked users cannot interact

### Data Protection

1. **GDPR Compliance**: User data deletion cascades
2. **Audit Logging**: Track sensitive operations
3. **Encryption**: Sensitive data encrypted at rest
4. **Access Control**: Proper authorization checks

## Deployment Strategy

### Database Migrations

1. **Incremental Migrations**: Add new tables without breaking existing functionality
2. **Index Creation**: Create indexes concurrently to avoid locks
3. **Data Migration**: Migrate existing interaction data if needed
4. **Rollback Plan**: Ensure all migrations are reversible

### Feature Rollout

1. **Feature Flags**: Gradual rollout of new features
2. **A/B Testing**: Test engagement improvements
3. **Monitoring**: Track performance and error rates
4. **Rollback Strategy**: Quick rollback if issues arise

### Monitoring and Analytics

1. **User Engagement Metrics**: Track reaction usage, share rates
2. **Performance Metrics**: API response times, database query performance
3. **Error Tracking**: Monitor error rates and types
4. **Business Metrics**: Measure impact on user retention and growth

This design provides a comprehensive foundation for implementing the social interactions system while maintaining consistency with the existing Grateful platform architecture and design patterns.