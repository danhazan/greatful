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

1. **Comprehensive batching system**: Prevents notification spam
2. **Rate limiting**: Protects against abuse
3. **Proper separation of concerns**: Service/repository pattern
4. **Type safety**: Shared TypeScript interfaces
5. **Graceful degradation**: Works offline with optimistic updates
6. **Performance optimized**: Proper database indexing and query optimization
7. **Extensible architecture**: Easy to add new notification types

### Current Limitations and Enhancement Opportunities

#### 1. Link Generation and Navigation
**Current State**: Limited linking capabilities
- Notifications contain `post_id` in data but no direct navigation
- No clickable usernames in notification text
- No deep linking to specific posts or profiles

**Enhancement Needed**:
- Generate proper URLs for posts, users, and other content
- Make usernames clickable within notification messages
- Support deep linking from notifications to relevant content

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

## Planned Enhancements

### Phase 1: Link Generation and Navigation System

#### 1.1 URL Generation Service
```python
class NotificationLinkService:
    """Service for generating notification links and metadata."""
    
    @staticmethod
    def generate_post_link(post_id: str) -> str:
        """Generate link to specific post."""
        return f"/post/{post_id}"
    
    @staticmethod
    def generate_user_profile_link(username: str) -> str:
        """Generate link to user profile."""
        return f"/profile/{username}"
    
    @staticmethod
    def generate_notification_metadata(notification: Notification) -> dict:
        """Generate link metadata for notification."""
        # Implementation details
```

#### 1.2 Enhanced Notification Data Structure
```python
# Enhanced notification data with link metadata
notification_data = {
    'post_id': post_id,
    'reactor_username': username,
    'emoji_code': emoji_code,
    # New link metadata
    'links': {
        'post': f"/post/{post_id}",
        'user_profile': f"/profile/{username}"
    },
    'clickable_elements': {
        'usernames': [username],
        'post_content': True
    }
}
```

#### 1.3 Frontend Link Rendering
```typescript
interface NotificationLink {
  type: 'post' | 'user' | 'external'
  url: string
  text: string
}

interface EnhancedNotification extends Notification {
  links?: NotificationLink[]
  clickableElements?: {
    usernames: string[]
    postContent: boolean
  }
}
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

### Task 11.1: Pressable Notification Links
- Add click handlers to notifications for navigation
- Implement post and user profile link generation
- Update notification data structure with link metadata
- Test navigation functionality across all notification types

### Task 11.2: Username Links in Notifications
- Make usernames clickable within notification text
- Add proper styling for username links
- Ensure consistent behavior across all notification types
- Implement username detection and linkification

### Task 11.2.1: Profile Pictures in Notification Cards
- Replace letter avatars with actual profile pictures
- Make profile pictures clickable for navigation
- Add fallback handling for missing profile pictures
- Ensure consistent sizing and styling

### Task 11.3: Like/Heart Notifications with Existing Batching Integration
- Add like notification creation to existing NotificationService and NotificationFactory
- Integrate like notifications with existing comprehensive batching system
- Update existing batch summary generation to include like notifications
- Implement purple heart styling (💜) for like notifications
- Test integration with existing batching, rate limiting, and UI components

### Task 11.4: Advanced Multi-Type Notification Batching
- Enhance existing batching system to support multiple notification types per post
- Design multi-type batching schema (batch_types array, enhanced batch_metadata)
- Implement advanced batch summary generation for mixed notification types
- Create intelligent batching logic that combines likes, reactions, mentions, and shares
- Update notification display components to handle enhanced batch summaries

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

This comprehensive refactoring plan provides a roadmap for enhancing the notification system while maintaining its current strengths and addressing identified limitations. The phased approach ensures manageable implementation while delivering incremental value to users.