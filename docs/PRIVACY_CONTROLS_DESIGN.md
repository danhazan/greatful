# Privacy Controls System Design

## Overview

This document outlines the privacy controls system for the Grateful platform, designed as a post-MVP feature to provide users with simple yet flexible privacy options while maintaining the platform's positive community focus.

## Privacy Philosophy

The privacy system follows these core principles:
1. **Simple by Default**: Three clear privacy levels that are easy to understand
2. **Flexible Control**: Profile and post-level privacy can be mixed and matched
3. **Positive Focus**: Privacy protects users while maintaining community building
4. **Granular Choice**: Users control their visibility without complex configurations

## Privacy Levels

### Profile Privacy Levels

#### 1. Public Profile
- **Visibility**: Profile and posts visible to everyone
- **Discoverability**: Posts appear in public feeds and suggestions
- **Following**: Anyone can follow without approval
- **Search**: Profile appears in user search results

#### 2. Friendly Profile  
- **Visibility**: Profile and posts visible to everyone
- **Discoverability**: Posts do NOT appear in public feeds or suggestions
- **Following**: Anyone can follow without approval
- **Search**: Profile appears in user search results
- **Purpose**: For users who want to share but prefer organic discovery

#### 3. Private Profile
- **Visibility**: Only mutual followers can see posts
- **Discoverability**: Posts never appear in public feeds
- **Following**: Only people you follow can follow you back
- **Search**: Profile appears in search but shows limited info
- **Purpose**: For users who want controlled, intimate sharing

### Post Privacy Levels

#### 1. Public Post
- Visible to everyone (respects profile privacy for discoverability)
- Can be shared and mentioned by anyone
- Appears in feeds based on profile privacy settings

#### 2. Private Post
- Only visible to mutual followers
- Cannot be shared outside of mutual follower network
- Never appears in public feeds or suggestions

## Privacy Matrix

| Profile Type | Post Type | Who Can See | Appears in Feed | Can Be Shared |
|--------------|-----------|-------------|-----------------|---------------|
| Public | Public | Everyone | Yes | Yes |
| Public | Private | Mutual Followers | No | Mutual Only |
| Friendly | Public | Everyone | No | Yes |
| Friendly | Private | Mutual Followers | No | Mutual Only |
| Private | Public | Mutual Followers | No | Mutual Only |
| Private | Private | Mutual Followers | No | Mutual Only |

## User Blocking System

### Blocking Functionality
- **Block User**: Prevents all interactions between users
- **Blocked Actions**: Following, mentions, shares, viewing posts/profile
- **Mutual Blocking**: Automatically removes existing follows
- **Invisible Blocking**: Blocked user doesn't know they're blocked

### Blocking Enforcement
- Blocked users cannot see your posts or profile
- Blocked users cannot mention you in posts
- Blocked users cannot share your posts
- Blocked users cannot follow you
- You cannot see blocked users' content

## Database Schema

### User Privacy Settings
```sql
-- Extend users table
ALTER TABLE users ADD COLUMN profile_privacy VARCHAR(20) DEFAULT 'public';
ALTER TABLE users ADD COLUMN default_post_privacy VARCHAR(20) DEFAULT 'public';

-- User blocks table
CREATE TABLE user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id),
    CHECK(blocker_id != blocked_id)
);

CREATE INDEX idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked_id ON user_blocks(blocked_id);
```

### Post Privacy Settings
```sql
-- Extend posts table
ALTER TABLE posts ADD COLUMN privacy_level VARCHAR(20) DEFAULT 'public';
```

## API Endpoints

### Privacy Settings
- `GET /api/v1/users/me/privacy` - Get current privacy settings
- `PUT /api/v1/users/me/privacy` - Update privacy settings
- `POST /api/v1/users/me/privacy/migrate-posts` - Migrate all posts to new privacy level

### Blocking
- `POST /api/v1/users/{user_id}/block` - Block a user
- `DELETE /api/v1/users/{user_id}/block` - Unblock a user
- `GET /api/v1/users/me/blocked` - Get list of blocked users

### Privacy Checks
- `GET /api/v1/posts/{post_id}/visibility` - Check if current user can see post
- `GET /api/v1/users/{user_id}/visibility` - Check if current user can see profile

## Frontend Components

### Settings Page
```typescript
interface PrivacySettingsProps {
  currentSettings: {
    profilePrivacy: 'public' | 'friendly' | 'private'
    defaultPostPrivacy: 'public' | 'private'
  }
  onSettingsChange: (settings: PrivacySettings) => void
}
```

### Post Privacy Selector
```typescript
interface PostPrivacySelectorProps {
  currentPrivacy: 'public' | 'private'
  defaultPrivacy: 'public' | 'private'
  onPrivacyChange: (privacy: 'public' | 'private') => void
}
```

### Block User Component
```typescript
interface BlockUserButtonProps {
  userId: string
  isBlocked: boolean
  onBlockChange: (blocked: boolean) => void
}
```

## Privacy Enforcement Logic

### Feed Algorithm Updates
```python
async def get_personalized_feed(self, user_id: int, include_friendly: bool = True):
    """
    Get personalized feed respecting privacy settings.
    
    Args:
        user_id: Current user ID
        include_friendly: Whether to include friendly profiles (False for public feed)
    """
    # Base query excludes private profiles and private posts
    query = select(Post).where(
        and_(
            Post.privacy_level == 'public',
            User.profile_privacy.in_(['public', 'friendly'] if include_friendly else ['public'])
        )
    )
    
    # Add mutual follower posts for private profiles
    mutual_follows = await self.get_mutual_follows(user_id)
    if mutual_follows:
        private_query = select(Post).where(
            and_(
                Post.user_id.in_(mutual_follows),
                or_(
                    Post.privacy_level == 'public',
                    Post.privacy_level == 'private'
                )
            )
        )
        query = query.union(private_query)
    
    return await self.execute_feed_query(query, user_id)
```

### Privacy Check Service
```python
class PrivacyService:
    async def can_see_post(self, viewer_id: int, post: Post) -> bool:
        """Check if viewer can see a specific post."""
        # Public posts on public/friendly profiles
        if post.privacy_level == 'public' and post.user.profile_privacy in ['public', 'friendly']:
            return not await self.is_blocked(post.user_id, viewer_id)
        
        # Private posts or private profiles require mutual follow
        return await self.are_mutual_followers(viewer_id, post.user_id)
    
    async def can_interact_with_user(self, actor_id: int, target_id: int) -> bool:
        """Check if actor can interact with target (follow, mention, share)."""
        # Check if either user has blocked the other
        if await self.is_blocked(actor_id, target_id) or await self.is_blocked(target_id, actor_id):
            return False
        
        # Private profiles only allow interactions from mutual followers
        target_user = await self.get_user(target_id)
        if target_user.profile_privacy == 'private':
            return await self.are_mutual_followers(actor_id, target_id)
        
        return True
```

## Privacy Migration Tool

### Settings Change Handler
```python
async def update_profile_privacy(self, user_id: int, new_privacy: str) -> dict:
    """
    Update user profile privacy and offer post migration.
    
    Returns migration options for frontend to present to user.
    """
    user = await self.get_user(user_id)
    old_privacy = user.profile_privacy
    
    # Update profile privacy
    await self.update_user(user_id, profile_privacy=new_privacy)
    
    # Calculate migration options
    post_counts = await self.get_user_post_counts_by_privacy(user_id)
    
    return {
        'old_privacy': old_privacy,
        'new_privacy': new_privacy,
        'migration_options': {
            'make_all_public': post_counts['private'],
            'make_all_private': post_counts['public'],
            'keep_current': post_counts['total']
        }
    }

async def migrate_user_posts(self, user_id: int, target_privacy: str) -> int:
    """Migrate all user posts to target privacy level."""
    result = await self.db.execute(
        update(Post)
        .where(Post.user_id == user_id)
        .values(privacy_level=target_privacy)
    )
    return result.rowcount
```

## User Experience Flow

### Privacy Settings Page
1. **Profile Privacy Section**
   - Radio buttons: Public / Friendly / Private
   - Clear descriptions of each level
   - Warning about changing from Public to Private

2. **Default Post Privacy**
   - Toggle: Public / Private
   - Note: "New posts will default to this setting"

3. **Migration Prompt** (when changing profile privacy)
   - "You have X public posts and Y private posts"
   - Options: "Make all posts [new privacy level]" or "Keep current post privacy"

4. **Blocked Users Section**
   - List of blocked users with unblock option
   - Search to block new users

### Post Creation Privacy
1. **Privacy Selector** (in post creation modal)
   - Toggle: Public / Private
   - Shows current default
   - Clear explanation of each option

2. **Privacy Indicator** (on existing posts)
   - Small icon showing post privacy level
   - Only visible to post author

## Testing Strategy

### Privacy Enforcement Tests
- Verify feed filtering based on privacy settings
- Test mutual follower detection
- Validate blocking enforcement across all interactions
- Check privacy migration functionality

### Edge Cases
- User changes privacy while others are viewing their content
- Blocking user who has already shared your posts
- Private profile user trying to share public posts
- Friendly profile posts in public vs personalized feeds

## Security Considerations

### Privacy Leaks Prevention
- All API endpoints check privacy before returning data
- Frontend components respect privacy in real-time
- Search results filtered by privacy settings
- Share URLs respect privacy at access time

### Blocking Enforcement
- Blocked users get generic "not found" errors
- No indication that blocking is the reason for access denial
- Existing shared content from blocked users is hidden
- Notifications from blocked users are suppressed

## Performance Considerations

### Database Optimization
- Indexes on privacy-related columns
- Efficient mutual follower queries
- Cached privacy check results for active users
- Bulk privacy operations for migrations

### Caching Strategy
```python
# Cache privacy settings for active users
@cache(expire=300)  # 5 minutes
async def get_user_privacy_settings(user_id: int) -> dict:
    return await self.db.get_user_privacy(user_id)

# Cache blocking relationships
@cache(expire=600)  # 10 minutes  
async def is_blocked(blocker_id: int, blocked_id: int) -> bool:
    return await self.db.check_block_relationship(blocker_id, blocked_id)
```

## Implementation Timeline

### Phase 1: Core Privacy (2 weeks)
- Database schema updates
- Basic privacy enforcement in feed
- Settings page implementation

### Phase 2: Advanced Features (1 week)
- Blocking system
- Privacy migration tool
- Post-level privacy controls

### Phase 3: Polish & Testing (1 week)
- Comprehensive testing
- Performance optimization
- Documentation updates

This privacy system provides users with meaningful control over their content visibility while maintaining the platform's focus on positive community building and simple user experience.