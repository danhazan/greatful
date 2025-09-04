# Notification System Refactoring and Planning

## Current Architecture Analysis

### Overview
The current notification system is a comprehensive implementation with batching capabilities, rate limiting, and multiple notification types. It follows a service-repository pattern with proper separation of concerns.

### Current Components

#### Backend Architecture

**1. Database Schema (PostgreSQL)**
- **notifications table**: Core notification storage with batching support
  - `id` (String, UUID): Primary key
  - `user_id` (Integer): Foreign key to users table
  - `type` (String): Notification type (emoji_reaction, post_shared, mention, new_follower)
  - `title` (String): Notification title
  - `message` (Text): Notification message content
  - `data` (JSON): Additional metadata (post_id, emoji_code, usernames, etc.)
  - `read` (Boolean): Read status
  - `created_at` (DateTime): Creation timestamp
  - `read_at` (DateTime): When notification was read
  - **Batching fields**:
    - `parent_id` (String): Foreign key to parent notification for batching
    - `is_batch` (Boolean): Whether this is a batch notification
    - `batch_count` (Integer): Number of notifications in batch
    - `batch_key` (String): Key for grouping similar notifications
    - `last_updated_at` (DateTime): Last update timestamp for batch ordering

**2. Service Layer**
- **NotificationService**: Main business logic with static methods for notification creation
- **NotificationFactory**: Centralized factory for consistent notification creation
- **NotificationRepository**: Database operations with specialized queries

**3. API Layer**
- **FastAPI endpoints** (`/api/v1/notifications`):
  - `GET /notifications`: List user notifications with pagination
  - `GET /notifications/summary`: Unread count and total count
  - `POST /notifications/{id}/read`: Mark single notification as read
  - `POST /notifications/read-all`: Mark all notifications as read
  - `GET /notifications/{batch_id}/children`: Get batch child notifications
  - `GET /notifications/stats`: Notification statistics and rate limiting info

#### Frontend Architecture

**1. Components**
- **NotificationSystem.tsx**: Main notification dropdown component
  - Bell icon with unread count badge
  - Dropdown with notification list
  - Batch expansion/collapse functionality
  - Real-time updates via polling (30-second intervals)
  - Optimistic UI updates for read status

**2. API Integration**
- **Next.js API routes** (`/api/notifications`): Proxy to FastAPI backend
- **Data transformation**: Converts snake_case to camelCase for frontend
- **User resolution**: Resolves notification usernames to user objects

#### Shared Types
- **TypeScript interfaces** in `shared/types/`:
  - `Notification` interface with batching fields
  - `NotificationType` enum
  - `NotificationSettings` interface

### Current Features

#### Notification Types
1. **Emoji Reactions**: User reacted to post with specific emoji
2. **Post Shares**: Post was shared via URL or message
3. **Mentions**: User was mentioned in a post
4. **New Followers**: User gained a new follower
5. **Share Milestones**: Post reached sharing milestones (future)

#### Batching System
- **Smart batching**: Similar notifications for same post are grouped
- **Parent-child relationships**: Batch notifications contain individual notifications
- **Batch summaries**: "3 people reacted to your post" format
- **Expandable batches**: Users can expand to see individual notifications
- **Batch read marking**: Reading batch marks all children as read

#### Rate Limiting
- **20 notifications per hour per type**: Prevents spam
- **Rate limit checking**: Before creating notifications
- **Statistics endpoint**: Shows rate limit status

#### Real-time Updates
- **Polling-based**: 30-second intervals for new notifications
- **Optimistic updates**: Immediate UI feedback for read status
- **Background sync**: Attempts to sync with backend, graceful degradation

### Current Strengths

1. **Comprehensive batching system**: Prevents notification spam with parent-child relationships
2. **Rate limiting**: Protects against abuse (20 notifications/hour per type)
3. **Proper separation of concerns**: Service/repository pattern with NotificationFactory
4. **Type safety**: Shared TypeScript interfaces and runtime validation
5. **Graceful degradation**: Works offline with optimistic updates
6. **Performance optimized**: Proper database indexing and query optimization
7. **Extensible architecture**: Easy to add new notification types
8. **Generic navigation system**: Reusable `ClickableUsername` component and navigation utilities
9. **Consistent user experience**: Standardized link generation and ID validation
10. **Accessibility compliant**: Proper ARIA labels, keyboard navigation, and screen reader support

### Current Issues with Batching System

#### Batching System Enhancement ✅ COMPLETED
**Previous State**: The notification batching system had implementation issues that needed refactoring
- **Broken Batching Logic**: Emoji reaction batching was not working correctly
- **Non-Generic Design**: Batching logic was tightly coupled to specific notification types
- **Inconsistent Batch Keys**: Batch key generation was not standardized across notification types
- **Complex Static Methods**: Implementation used confusing static/instance method patterns

**Root Cause Analysis**:
1. **Tight Coupling**: Batching logic was embedded in NotificationService static methods rather than using a generic approach
2. **Inconsistent Patterns**: Different notification types used different batching strategies
3. **Complex Dependencies**: Static methods created dependency issues and made testing difficult
4. **Limited Extensibility**: Adding new notification types required duplicating batching logic

**Implemented Generic Design** ✅:
1. **Generic Batch Manager**: Created reusable `NotificationBatcher` system that works for any notification type and scope
2. **Standardized Batch Keys**: Implemented consistent batch key patterns:
   - **Post-based**: `{notification_type}:post:{post_id}` (likes, reactions, mentions, shares)
   - **User-based**: `{notification_type}:user:{user_id}` (follows, future user-directed notifications)
3. **Configurable Batching Rules**: Defined batching behavior through `BatchConfig` configuration system
4. **Unified Batch Summaries**: Generic summary generation that handles any notification type and scope combination
5. **Dual Scope Support**: System supports both post-centric and user-centric notification batching patterns
6. **Specialized Batchers**: Created `PostInteractionBatcher` and `UserInteractionBatcher` for specific use cases
7. **Factory Integration**: Updated `NotificationFactory` to use the new generic batching system

### Current Limitations and Enhancement Opportunities

#### 1. Link Generation and Navigation ✅ IMPLEMENTED
**Current State**: Comprehensive link generation and navigation system
- **Notification Links**: Full implementation in `apps/web/src/utils/notificationLinks.ts`
  - `generateNotificationLink()`: Generates appropriate links based on notification type
  - `handleNotificationClick()`: Handles navigation with proper read state management
  - Post-related notifications (reactions, mentions, shares, likes) link to `/post/{postId}`
  - User-related notifications (follows) link to `/profile/{userId}`
  - Batch notifications expand/collapse without navigation
- **Clickable Usernames**: Implemented via `ClickableUsername` component
  - Generic component in `apps/web/src/components/ClickableUsername.tsx`
  - Supports both user ID and username-based navigation
  - Automatic username-to-ID resolution via `/api/users/by-username/{username}`
  - Consistent styling and accessibility features
- **Message Parsing**: Enhanced notification message rendering
  - `formatNotificationWithEnhancedData()`: Makes usernames clickable in notification text
  - `parseNotificationMessage()`: Handles username detection and linkification
  - Consistent behavior across all notification types

**Recent Enhancements**:
- Shared navigation utilities for consistent user profile linking
- ID validation with `validProfileId()` function in `apps/web/src/utils/idGuards.ts`
- Fallback mechanisms for username resolution when direct ID navigation fails
- Proper error handling and accessibility support

#### 2. Profile Pictures in Notifications
**Current State**: Uses letter avatars or basic user info
- `from_user` object has limited user data
- No profile picture integration
- Inconsistent user data resolution

**Enhancement Needed**:
- Display actual profile pictures in notification cards
- Fallback to letter avatars when no profile picture exists
- Consistent user data resolution across all notification types

#### 3. Purple Heart Styling Integration
**Current State**: Generic notification styling
- No integration with purple heart theme
- Inconsistent with app's purple branding
- Missing like/heart notifications

**Enhancement Needed**:
- Integrate purple heart styling (💜) throughout notification system
- Add like/heart notifications (currently missing)
- Consistent purple theming for notification UI elements

#### 4. Advanced Batching Capabilities
**Current State**: Comprehensive batching system already implemented
- **Existing Implementation**: Smart batching for same notification type per post with parent-child relationships
- **Batch Features**: Expandable batches, batch read marking, time-based batch windows (24 hours)
- **Batch Summaries**: Dynamic summary generation ("3 people reacted to your post")
- **Rate Integration**: Batching works with rate limiting (20 notifications/hour per type)

**Enhancement Opportunities**:
- Multiple notification types per post in single batch (e.g., "5 people engaged with your post" for mixed likes/reactions)
- Cross-post batching for user-based notifications (follows)
- Enhanced batch metadata for better summary generation
- More sophisticated batch consolidation strategies

#### 5. Performance Optimization for Large Scale
**Current State**: Good basic performance
- Polling-based updates (30-second intervals)
- Basic database indexing
- Limited caching

**Enhancement Needed**:
- WebSocket support for real-time updates
- Advanced caching strategies (Redis integration)
- Database query optimization for large datasets
- Notification archival and cleanup strategies

## Generic Batching System Design

### Batching Architecture Principles

#### 1. Generic Batch Manager
```python
class NotificationBatcher:
    """Generic notification batching system."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_repo = NotificationRepository(db)
    
    async def create_or_update_batch(
        self,
        notification: Notification,
        batch_config: BatchConfig
    ) -> Notification:
        """Create new notification or add to existing batch."""
        
    def generate_batch_key(
        self,
        notification_type: str,
        target_id: str,  # post_id or user_id
        batch_scope: str = "post"  # "post" or "user"
    ) -> str:
        """Generate standardized batch key."""
        return f"{notification_type}:{batch_scope}:{target_id}"
```

#### 2. Batch Configuration System
```python
@dataclass
class BatchConfig:
    """Configuration for notification batching behavior."""
    notification_type: str
    batch_scope: str  # "post" or "user"
    max_age_hours: int = 24
    batch_window_minutes: int = 60
    summary_template: str
    icon_type: str
    max_batch_size: int = 10  # Maximum notifications per batch
    
# Predefined batch configurations
BATCH_CONFIGS = {
    "emoji_reaction": BatchConfig(
        notification_type="emoji_reaction",
        batch_scope="post",
        summary_template="{count} people reacted to your post",
        icon_type="reaction"
    ),
    "like": BatchConfig(
        notification_type="like", 
        batch_scope="post",
        summary_template="{count} people liked your post",
        icon_type="heart"
    ),
    "post_interaction": BatchConfig(  # Combined likes + reactions
        notification_type="post_interaction",
        batch_scope="post", 
        summary_template="{count} people engaged with your post",
        icon_type="engagement"
    ),
    "follow": BatchConfig(  # User-based batching (Post-MVP)
        notification_type="follow",
        batch_scope="user",
        summary_template="{count} people started following you",
        icon_type="follow",
        batch_window_minutes=60,  # Batch follows within 1 hour
        max_batch_size=10
    )
}
```

#### 3. Post Interaction Batching Strategy
For Task 11.4, likes and reactions will be batched together as "post interactions":

```python
class PostInteractionBatcher(NotificationBatcher):
    """Specialized batcher for post interactions (likes + reactions)."""
    
    async def create_interaction_notification(
        self,
        notification_type: str,  # "like" or "emoji_reaction"
        post_id: str,
        user_id: int,
        actor_data: dict
    ) -> Optional[Notification]:
        """Create like or reaction notification with unified batching."""
        
        # Use unified batch key for both likes and reactions
        batch_key = self.generate_batch_key("post_interaction", post_id, "post")
        
        # Find existing batch for any post interaction
        existing_batch = await self._find_existing_batch(user_id, batch_key)
        
        if existing_batch:
            return await self._add_to_interaction_batch(existing_batch, notification)
        else:
            return await self._create_new_interaction_batch(notification, batch_key)
    
    def _generate_interaction_summary(self, batch_count: int, types: List[str]) -> tuple[str, str]:
        """Generate summary for mixed interaction types."""
        if "like" in types and "emoji_reaction" in types:
            return "New Engagement", f"{batch_count} people engaged with your post"
        elif "like" in types:
            return "New Likes", f"{batch_count} people liked your post" 
        elif "emoji_reaction" in types:
            return "New Reactions", f"{batch_count} people reacted to your post"
        else:
            return "New Interactions", f"{batch_count} interactions on your post"
```

#### 4. User-Based Batching Strategy (Post-MVP)
For follow notifications and other user-directed notifications:

```python
class UserInteractionBatcher(NotificationBatcher):
    """Specialized batcher for user-directed interactions (follows, etc.)."""
    
    async def create_user_notification(
        self,
        notification_type: str,  # "follow"
        target_user_id: int,
        actor_data: dict
    ) -> Optional[Notification]:
        """Create user-directed notification with batching."""
        
        # Use user-based batch key
        batch_key = self.generate_batch_key(notification_type, str(target_user_id), "user")
        
        # Find existing batch for this user and notification type
        existing_batch = await self._find_existing_batch(target_user_id, batch_key)
        
        if existing_batch:
            # Check batch size limit
            if existing_batch.batch_count >= BATCH_CONFIGS[notification_type].max_batch_size:
                # Create new batch if current one is full
                return await self._create_new_user_batch(notification, batch_key)
            else:
                return await self._add_to_user_batch(existing_batch, notification)
        else:
            return await self._create_new_user_batch(notification, batch_key)
    
    def _generate_user_summary(self, batch_count: int, notification_type: str) -> tuple[str, str]:
        """Generate summary for user-directed notifications."""
        if notification_type == "follow":
            if batch_count == 1:
                return "New Follower", "Someone started following you"
            else:
                return "New Followers", f"{batch_count} people started following you"
        # Add other user-directed notification types here
        return "New Activity", f"{batch_count} new interactions"
```

## Planned Enhancements

### Phase 1: Link Generation and Navigation System

#### 1.1 URL Generation Service ✅ IMPLEMENTED
```typescript
// Implemented in apps/web/src/utils/notificationLinks.ts
export function generateNotificationLink(notification: {
  type: string
  postId?: string
  fromUser?: { id: string; name: string }
  isBatch?: boolean
  data?: any
}): NotificationLinkData | null

export function getUserProfileLink(userIdOrUsername: string | number): string
export function getPostLink(postId: string): string

// Generic navigation function for consistent user profile linking
export async function navigateToUserProfile(
  userInfo: { id?: string | number; username?: string },
  navigate: (url: string) => void,
  options: { resolveUsername?: boolean } = { resolveUsername: true }
)
```

#### 1.2 Enhanced Notification Data Structure ✅ IMPLEMENTED
```typescript
// Current notification data structure with actor fields
interface NotificationData {
  post_id?: string
  actor_user_id?: string    // Standardized user ID field
  actor_username?: string   // Standardized username field
  emoji_code?: string
  share_method?: string
  // ... other notification-specific fields
}

// ID validation utilities
export function validProfileId(id: string | number | undefined | null): boolean
export function looksLikeUsername(value: string | number | undefined | null): boolean
export function normalizeProfileId(id: string | number | undefined | null): string | null
```

#### 1.3 Frontend Link Rendering ✅ IMPLEMENTED
```typescript
// Implemented in apps/web/src/components/ClickableUsername.tsx
interface ClickableUsernameProps {
  userId?: string | number
  username?: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

// Notification message parsing with clickable usernames
export function formatNotificationWithEnhancedData(
  notification: {
    message: string
    fromUser?: NotificationUser
    data?: NotificationData
    isBatch?: boolean
  }
): React.ReactNode

// Navigation handling
export function handleNotificationClick(
  notification: NotificationWithNavigation,
  callbacks: NavigationCallbacks
)
```

### Phase 2: Profile Picture Integration

#### 2.1 User Data Resolution Enhancement
```python
class NotificationUserResolver:
    """Enhanced user data resolution for notifications."""
    
    async def resolve_notification_users(
        self, 
        notification: Notification
    ) -> dict:
        """Resolve all users mentioned in notification with profile data."""
        # Implementation with profile picture fetching
```

#### 2.2 Frontend Profile Picture Display
```typescript
interface NotificationUser {
  id: number
  username: string
  displayName?: string
  profileImageUrl?: string
  profilePhotoFilename?: string
}

// Enhanced notification rendering with profile pictures
const renderUserAvatar = (user: NotificationUser) => {
  if (user.profileImageUrl || user.profilePhotoFilename) {
    return <img src={getProfileImageUrl(user)} alt={user.displayName || user.username} />
  }
  return <LetterAvatar name={user.displayName || user.username} />
}
```

### Phase 3: Purple Heart Styling and Like Notifications

#### 3.1 Like Notification Integration
```python
# Add like notifications to existing batching system
async def create_like_notification(
    db: AsyncSession,
    post_author_id: int,
    liker_username: str,
    post_id: str
) -> Optional[Notification]:
    """Create like notification with batching support."""
    # Implementation similar to emoji reactions
```

#### 3.2 Purple Heart Styling System
```typescript
// Purple heart theme integration
const NOTIFICATION_THEME = {
  primary: '#8B5CF6',      // Purple-500
  secondary: '#A855F7',    // Purple-400
  accent: '#7C3AED',       // Purple-600
  heartEmoji: '💜',        // Purple heart
  bellIcon: 'purple',      // Purple bell styling
}

// Styled notification components
const PurpleNotificationBell = styled.button`
  color: ${NOTIFICATION_THEME.primary};
  &:hover {
    color: ${NOTIFICATION_THEME.accent};
  }
`
```

### Phase 4: Advanced Batching System

#### 4.1 Multi-Type Batching Schema
```sql
-- Enhanced batching with support for multiple notification types per post
ALTER TABLE notifications ADD COLUMN batch_types TEXT[]; -- Array of notification types in batch
ALTER TABLE notifications ADD COLUMN batch_metadata JSONB; -- Enhanced batch metadata

-- New indexes for advanced batching
CREATE INDEX idx_notifications_batch_types ON notifications USING GIN(batch_types);
CREATE INDEX idx_notifications_batch_metadata ON notifications USING GIN(batch_metadata);
```

#### 4.2 Advanced Batch Logic
```python
class AdvancedNotificationBatcher:
    """Advanced batching logic for multiple notification types."""
    
    async def create_or_update_batch(
        self,
        user_id: int,
        post_id: str,
        notification_types: List[str],
        new_notification: Notification
    ) -> Notification:
        """Create or update batch with multiple notification types."""
        # Implementation for cross-type batching
```

#### 4.3 Enhanced Batch Summaries
```python
def generate_advanced_batch_summary(
    notification_types: List[str],
    count: int,
    post_id: str
) -> tuple[str, str]:
    """Generate advanced batch summaries for multiple types."""
    if 'emoji_reaction' in notification_types and 'like' in notification_types:
        return "New Engagement", f"{count} people engaged with your post"
    elif len(notification_types) > 1:
        return "Multiple Interactions", f"{count} interactions on your post"
    # ... other combinations
```

### Phase 5: Performance Optimization

#### 5.1 Caching Strategy
```python
# Redis caching for notification data
@cache(expire=300)  # 5 minutes
async def get_user_notifications_cached(user_id: int) -> List[Notification]:
    """Cached notification retrieval."""
    
@cache(expire=60)   # 1 minute
async def get_unread_count_cached(user_id: int) -> int:
    """Cached unread count."""
```

#### 5.2 WebSocket Integration (Future)
```typescript
// Real-time notification updates via WebSocket
class NotificationWebSocket {
  private ws: WebSocket
  
  connect(userId: number) {
    this.ws = new WebSocket(`ws://localhost:8000/ws/notifications/${userId}`)
    this.ws.onmessage = this.handleNotificationUpdate
  }
  
  private handleNotificationUpdate = (event: MessageEvent) => {
    const notification = JSON.parse(event.data)
    // Update notification state in real-time
  }
}
```

#### 5.3 Database Optimization
```sql
-- Performance indexes for large-scale operations
CREATE INDEX CONCURRENTLY idx_notifications_user_unread 
ON notifications(user_id, read, last_updated_at DESC) 
WHERE parent_id IS NULL;

CREATE INDEX CONCURRENTLY idx_notifications_batch_performance 
ON notifications(user_id, batch_key, created_at DESC) 
WHERE is_batch = true;

-- Partitioning strategy for large datasets (future)
CREATE TABLE notifications_2025_01 PARTITION OF notifications 
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

## Implementation Plan

### Task 11.1: Pressable Notification Links ✅ COMPLETED
- ✅ Add click handlers to notifications for navigation
- ✅ Implement post and user profile link generation via `notificationLinks.ts`
- ✅ Update notification data structure with link metadata
- ✅ Test navigation functionality across all notification types
- **Implementation**: Complete notification navigation system with `handleNotificationClick()` and `generateNotificationLink()`

### Task 11.2: Username Links in Notifications ✅ COMPLETED
- ✅ Make usernames clickable within notification text via `ClickableUsername` component
- ✅ Add proper styling for username links with purple theme consistency
- ✅ Ensure consistent behavior across all notification types
- ✅ Implement username detection and linkification in `notificationMessageParser.tsx`
- **Implementation**: Generic `ClickableUsername` component with ID validation and username resolution

### Task 11.2.1: Profile Pictures in Notification Cards ✅ COMPLETED
- ✅ Replace letter avatars with actual profile pictures in notification cards
- ✅ Make profile pictures clickable for navigation using `ClickableProfilePicture` component
- ✅ Add fallback handling for missing profile pictures with graceful error handling
- ✅ Ensure consistent sizing and styling (medium: 10x10, small: 8x8 for batch children)
- **Implementation**: Created `ClickableProfilePicture` component that reuses the generic navigation system from Tasks 11.1 and 11.2
- **Backend Enhancement**: Enhanced notification API to resolve actual profile pictures via `resolve_user_profile_data()` function
- **Testing**: Comprehensive test coverage for both component behavior and API integration

### Task 11.3: Notification Batching System Refactoring ✅ COMPLETED
- **Problem:** Current batching system for emoji reactions was broken and needed refactoring
- **Solution:** Implemented a generic notification batching system that supports various notification types and scopes
- ✅ Refactored existing NotificationService batching logic to use generic batching patterns
- ✅ Designed generic batch key generation that works for both post-based and user-based notifications
- ✅ Fixed existing emoji reaction batching issues with proper parent-child relationships
- ✅ Created reusable batching utilities that can be extended for new notification types (including future follow batching)
- ✅ Designed batch configuration system that supports both post and user scopes
- ✅ Tested generic batching system with emoji reactions to ensure it works correctly
- **Implementation Details:**
  - Created `NotificationBatcher` base class with generic batching logic
  - Implemented `PostInteractionBatcher` for likes and reactions
  - Implemented `UserInteractionBatcher` for follows and user-directed notifications
  - Updated `NotificationFactory` to use new batching system
  - Added comprehensive test coverage (32 tests passing)
  - Maintained backward compatibility with existing notification data
  - **Fixed batch behavior**: First notification preserved as child, not converted to batch container
  - **Improved UX**: All individual notifications remain accessible when batch is expanded

### Task 11.4: Like and Reaction Notification Batching Implementation
- **Context:** Both like and reaction notifications are about interactions with the user's own posts
- **Note:** These should be batched together as "post interaction" notifications
- Add like notification creation to NotificationFactory with proper data structure
- Integrate like notifications into the refactored generic batching system from Task 11.3
- Implement combined batching for likes and reactions on the same post (post-based batching)
- Create intelligent batch summaries for mixed likes and reactions
- Implement purple heart styling (💜) for like notifications
- Test like and reaction batching scenarios with mixed notification types
- Validate that the generic system can handle both post-based and future user-based batching

### Task 13: Follow Notification Batching System (Post-MVP)
- **Context:** Follow notifications are user-based rather than post-based, requiring different batching strategy
- **Challenge:** Unlike post interactions, follows are directed at users, not posts
- Extend generic batching system to support user-based batching (not just post-based)
- Implement follow notification batching using user-based batch keys: `follow:user:{user_id}`
- Create batch summaries: "X people started following you" with expandable individual notifications
- Implement time-based batching windows and batch size limits for follow notifications
- Test follow notification batching with multiple followers and time windows

## Shared Types Updates

### Enhanced Notification Interfaces
```typescript
// Enhanced notification interface with new capabilities
interface EnhancedNotification extends BaseEntity {
  user_id: number
  type: NotificationType
  title: string
  message: string
  data: NotificationData
  read: boolean
  read_at?: string
  
  // Enhanced batching
  is_batch: boolean
  batch_count: number
  batch_types?: NotificationType[]  // Multiple types in batch
  parent_id?: string
  last_updated_at?: string
  
  // Link generation
  links?: NotificationLink[]
  clickable_elements?: ClickableElements
  
  // User data
  from_users?: NotificationUser[]  // Multiple users for batches
  primary_user?: NotificationUser  // Primary user for display
  
  // Styling
  theme_data?: NotificationThemeData
}

interface NotificationLink {
  type: 'post' | 'user' | 'external'
  url: string
  text: string
  metadata?: Record<string, any>
}

interface ClickableElements {
  usernames: string[]
  post_content: boolean
  custom_links?: NotificationLink[]
}

interface NotificationUser {
  id: number
  username: string
  display_name?: string
  profile_image_url?: string
  profile_photo_filename?: string
}

interface NotificationThemeData {
  primary_color?: string
  accent_color?: string
  icon_type?: 'heart' | 'reaction' | 'share' | 'mention' | 'follow'
  custom_styling?: Record<string, any>
}

// Enhanced notification data structure
interface NotificationData {
  post_id?: string
  user_id?: number
  username?: string
  emoji_code?: EmojiCode
  share_method?: ShareMethod
  
  // Enhanced data
  links?: NotificationLink[]
  user_data?: NotificationUser
  batch_metadata?: BatchMetadata
  performance_data?: PerformanceData
}

interface BatchMetadata {
  types: NotificationType[]
  post_ids: string[]
  user_ids: number[]
  time_range: {
    start: string
    end: string
  }
  summary_data: Record<string, any>
}
```

## Testing Strategy

### Backend Testing
```python
# Enhanced notification testing
class TestEnhancedNotificationSystem:
    async def test_link_generation(self):
        """Test notification link generation."""
        
    async def test_advanced_batching(self):
        """Test multi-type notification batching."""
        
    async def test_user_data_resolution(self):
        """Test enhanced user data resolution."""
        
    async def test_performance_optimization(self):
        """Test notification performance under load."""
```

### Frontend Testing
```typescript
// Enhanced notification component testing
describe('Enhanced NotificationSystem', () => {
  it('should render clickable usernames', () => {
    // Test username link functionality
  })
  
  it('should display profile pictures correctly', () => {
    // Test profile picture rendering
  })
  
  it('should handle advanced batch expansion', () => {
    // Test multi-type batch expansion
  })
  
  it('should navigate correctly from notifications', () => {
    // Test navigation functionality
  })
})
```

## Performance Considerations

### Database Performance
- **Indexing strategy**: Optimized indexes for notification queries
- **Query optimization**: Efficient joins and filtering
- **Caching layer**: Redis for frequently accessed data
- **Archival strategy**: Automatic cleanup of old notifications

### Frontend Performance
- **Virtual scrolling**: For large notification lists
- **Lazy loading**: Load batch children on demand
- **Optimistic updates**: Immediate UI feedback
- **Debounced operations**: Prevent excessive API calls

### Scalability Considerations
- **Horizontal scaling**: Database sharding strategies
- **Real-time updates**: WebSocket infrastructure
- **Rate limiting**: Advanced rate limiting algorithms
- **Monitoring**: Performance metrics and alerting

## Security Considerations

### Data Protection
- **User privacy**: Respect notification preferences
- **Access control**: Proper authorization for notification access
- **Data sanitization**: Prevent XSS in notification content
- **Rate limiting**: Prevent notification spam and abuse

### Link Security
- **URL validation**: Ensure generated links are safe
- **CSRF protection**: Secure notification actions
- **Content filtering**: Prevent malicious content in notifications
- **Audit logging**: Track notification-related actions

## Migration Strategy

### Database Migrations
1. **Phase 1**: Add link metadata columns
2. **Phase 2**: Add enhanced user data columns
3. **Phase 3**: Add advanced batching columns
4. **Phase 4**: Performance optimization indexes

### Code Migration
1. **Backward compatibility**: Maintain existing API contracts
2. **Gradual rollout**: Feature flags for new functionality
3. **Data migration**: Migrate existing notifications to new format
4. **Testing**: Comprehensive testing at each phase

### Deployment Strategy
1. **Blue-green deployment**: Zero-downtime updates
2. **Feature toggles**: Gradual feature activation
3. **Monitoring**: Real-time performance monitoring
4. **Rollback plan**: Quick rollback if issues arise

## Success Metrics

### User Engagement
- **Click-through rate**: Notifications leading to content engagement
- **Read rate**: Percentage of notifications read
- **Action rate**: Notifications leading to user actions
- **User satisfaction**: Feedback on notification experience

### Performance Metrics
- **Response time**: Notification API response times
- **Throughput**: Notifications processed per second
- **Error rate**: Notification delivery failure rate
- **Resource usage**: Database and server resource consumption

### Business Metrics
- **User retention**: Impact on user retention rates
- **Engagement growth**: Increase in user interactions
- **Feature adoption**: Usage of new notification features
- **Support tickets**: Reduction in notification-related issues

## Recent Enhancements and Improvements

Based on the recent implementation work (Tasks 11.1 and 11.2), here are the key improvements made to the notification system:

### 1. Generic User Profile Link System ✅ IMPLEMENTED

**Components Created:**
- **`ClickableUsername` Component** (`apps/web/src/components/ClickableUsername.tsx`):
  - Reusable component for consistent user profile navigation
  - Supports both user ID and username-based navigation
  - Automatic username-to-ID resolution via API
  - Accessibility features (ARIA labels, keyboard navigation)
  - Consistent purple theme styling

- **Navigation Utilities** (`apps/web/src/utils/notificationLinks.ts`):
  - `generateNotificationLink()`: Smart link generation based on notification type
  - `handleNotificationClick()`: Centralized click handling with read state management
  - `navigateToUserProfile()`: Generic user profile navigation with fallback mechanisms
  - `getUserProfileLink()` and `getPostLink()`: URL generation utilities

- **ID Validation System** (`apps/web/src/utils/idGuards.ts`):
  - `validProfileId()`: Validates numeric IDs and UUIDs for profile navigation
  - `looksLikeUsername()`: Identifies username-like strings
  - `normalizeProfileId()`: Consistent ID formatting for URLs
  - Type guards for runtime validation

### 2. Enhanced Notification Message Parsing ✅ IMPLEMENTED

**Message Parser** (`apps/web/src/utils/notificationMessageParser.tsx`):
- `formatNotificationWithEnhancedData()`: Makes usernames clickable in notification text
- `parseNotificationMessage()`: Handles username detection and linkification
- Consistent behavior across all notification types (reactions, mentions, shares, follows)
- React component integration for interactive elements

### 3. Standardized Notification Data Structure ✅ IMPLEMENTED

**Backend Improvements** (`apps/api/app/core/notification_factory.py`):
- Consistent `actor_user_id` and `actor_username` fields across all notification types
- NotificationFactory with convenience methods for each notification type
- Centralized notification creation to prevent common issues
- Proper error handling and logging

**API Response Format** (`apps/api/app/api/v1/notifications.py`):
- Standardized `from_user` object with `id`, `name`, and `username` fields
- Backward compatibility with existing notification data
- Enhanced batch notification support

### 4. Opportunities for Further Enhancement

While the generic user profile link system is now comprehensive, there are still opportunities for improvement:

#### A. Profile Picture Integration (Task 11.2.1) ✅ COMPLETED
**Implementation Summary**:
- **`ClickableProfilePicture` Component**: New reusable component for profile pictures with navigation
  - Supports multiple sizes (small: 8x8, medium: 10x10, large: 12x12)
  - Automatic fallback to letter avatars when images fail to load
  - Reuses existing navigation logic from `ClickableUsername` for consistency
  - Full accessibility support (ARIA labels, keyboard navigation)
- **Backend Enhancement**: Enhanced notification API with `resolve_user_profile_data()` function
  - Fetches actual profile pictures from user profiles
  - Graceful fallback when users don't exist or have no profile pictures
  - Maintains backward compatibility with existing notification data
- **Integration**: Updated `NotificationSystem` component to use profile pictures
  - Main notifications use medium size (10x10)
  - Batch children use small size (8x8)
  - Consistent clickable behavior across all notification contexts

#### B. Enhanced User Data Resolution
**Current State**: Basic user data in `from_user` object
**Enhancement Opportunity**:
- Fetch complete user profile data including profile pictures
- Cache user data to reduce API calls
- Support for display names vs usernames
- Enhanced user presence indicators

#### C. Advanced Link Metadata
**Current State**: Basic post and user links
**Enhancement Opportunity**:
- Rich link previews for shared content
- Deep linking to specific sections (e.g., comments, reactions)
- External link handling and validation
- Link analytics and tracking

#### D. Performance Optimizations
**Current State**: Real-time username resolution via API
**Enhancement Opportunity**:
- Client-side caching of username-to-ID mappings
- Batch user data resolution
- Optimistic navigation with background validation
- Service worker integration for offline support

---

This comprehensive refactoring plan provides a roadmap for enhancing the notification system while maintaining its current strengths and addressing identified limitations. The phased approach ensures manageable implementation while delivering incremental value to users.
## 
Generic Batching System Implementation Summary

### Architecture Overview

The generic notification batching system consists of several key components:

#### 1. Core Components

**NotificationBatcher** (`apps/api/app/core/notification_batcher.py`)
- Base class providing generic batching functionality
- Handles batch key generation, batch creation, and batch updates
- Supports both post-based and user-based batching scopes
- Configurable through `BatchConfig` objects

**BatchConfig** (Dataclass)
- Defines batching behavior for each notification type
- Configures batch scope (post/user), time windows, and summary templates
- Predefined configurations for all notification types

**Specialized Batchers**
- `PostInteractionBatcher`: Handles likes and reactions (post-based)
- `UserInteractionBatcher`: Handles follows (user-based)
- Extensible pattern for future notification types

#### 2. Batch Key Format

**New Standardized Format:**
- Post-based: `{notification_type}:post:{post_id}`
- User-based: `{notification_type}:user:{user_id}`

**Examples:**
- `emoji_reaction:post:abc123` - Reactions on post abc123
- `like:post:abc123` - Likes on post abc123  
- `follow:user:456` - Follows for user 456

#### 3. Integration Points

**NotificationFactory Integration**
- Updated all notification creation methods to use generic batching
- Maintains self-notification prevention
- Provides consistent error handling and logging

**Database Schema Compatibility**
- Works with existing notification table structure
- Uses existing `batch_key`, `is_batch`, `batch_count` fields
- Maintains parent-child relationships via `parent_id`

#### 4. Batching Logic Flow

1. **Check for Existing Batch**: Look for active batch with same batch key
2. **Add to Batch**: If batch exists, increment count and add as child
3. **Check for Single Notification**: Look for recent single notification to convert
4. **Convert to Batch**: Create dedicated batch notification and make both notifications children
5. **Create Single**: If no existing notifications, create new single notification

**Key Improvement**: The first notification is preserved as an individual child notification rather than being converted into the batch container. This ensures all individual notification details remain accessible when users expand the batch.

#### 5. Configuration System

```python
BATCH_CONFIGS = {
    "emoji_reaction": BatchConfig(
        notification_type="emoji_reaction",
        batch_scope="post",
        max_age_hours=24,
        summary_template="{count} people reacted to your post",
        icon_type="reaction"
    ),
    "like": BatchConfig(
        notification_type="like",
        batch_scope="post", 
        summary_template="{count} people liked your post",
        icon_type="heart"
    ),
    "follow": BatchConfig(
        notification_type="follow",
        batch_scope="user",
        summary_template="{count} people started following you",
        icon_type="follow",
        max_batch_size=10
    )
}
```

#### 6. Testing Coverage

**Unit Tests** (26 tests)
- `test_notification_batching.py`: Legacy batching tests (updated for new format)
- `test_generic_notification_batching.py`: New generic system tests

**Integration Tests** (6 tests)  
- `test_notification_batching_api.py`: End-to-end API testing

**Test Categories:**
- Batch key generation and format validation
- Single notification creation
- Batch conversion logic (single → batch)
- Batch addition logic (add to existing batch)
- Self-notification prevention
- API endpoint integration
- Database operations and transactions

#### 7. Future Extensibility

**Adding New Notification Types:**
1. Add `BatchConfig` entry to `BATCH_CONFIGS`
2. Update `NotificationFactory` with new creation method
3. Optionally create specialized batcher if needed
4. Add tests for new notification type

**Example - Adding "comment" notifications:**
```python
# 1. Add config
BATCH_CONFIGS["comment"] = BatchConfig(
    notification_type="comment",
    batch_scope="post",
    summary_template="{count} people commented on your post",
    icon_type="comment"
)

# 2. Add factory method
async def create_comment_notification(self, ...):
    notification = Notification(...)
    return await self.batcher.create_or_update_batch(notification)
```

#### 8. Performance Considerations

**Database Queries:**
- Efficient batch lookup using indexed `batch_key` field
- Single transaction for batch updates
- Minimal database round trips

**Memory Usage:**
- Lightweight configuration objects
- Reusable batcher instances
- No caching overhead (relies on database)

**Scalability:**
- Configurable batch size limits
- Time-based batch windows prevent unbounded growth
- Supports high-frequency notification scenarios

#### 9. Backward Compatibility

**Migration Strategy:**
- New batch key format coexists with old format
- Existing notifications continue to work
- Gradual migration as new notifications are created

**API Compatibility:**
- All existing API endpoints unchanged
- Notification data structure unchanged
- Frontend components work without modification

This generic batching system provides a solid foundation for current and future notification types while maintaining performance, testability, and extensibility.