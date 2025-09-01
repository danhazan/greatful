# Database Structure Documentation

## Overview

The Grateful application uses PostgreSQL as the primary database with SQLAlchemy ORM for data modeling and a standardized repository pattern for data access. This document describes the current database schema, relationships, and query patterns implemented through the repository layer.

## Database Schema

### Users Table (`users`)

**Primary table for user accounts and profiles with enhanced profile fields.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | Integer | Primary Key, Index | Unique user identifier |
| `email` | String | Unique, Index, Not Null | User's email address |
| `username` | String | Unique, Index, Not Null | Unique username |
| `hashed_password` | String | Not Null | Encrypted password |
| `bio` | Text | Nullable | User biography/description |
| `profile_image_url` | String | Nullable | URL to user's profile image |
| `created_at` | DateTime | Not Null, Default: now() | Account creation timestamp |
| `display_name` | String(100) | Nullable, Index | Display name (separate from username) |
| `city` | String(100) | Nullable, Index | User's city location |
| `institutions` | JSON | Nullable | Array of institutions (schools, companies) |
| `websites` | JSON | Nullable | Array of user's websites/social links |
| `location` | JSON | Nullable | Structured location data from Nominatim |
| `profile_photo_filename` | String(255) | Nullable, Index | Filename for profile photo variants |
| `profile_preferences` | JSON | Nullable | User preferences and settings |

**Enhanced Profile Fields Details:**

**Display Name vs Username:**
- `username`: Unique identifier for @mentions and URLs (e.g., "alice_smith")
- `display_name`: Presentation name shown in UI (e.g., "Alice Smith")
- Posts show display name (bold) with @username to the right

**Location Fields:**
- `city`: Simple text field for city name (e.g., "New York")
- `location`: Structured JSON with coordinates and address data from OpenStreetMap

**Institution and Website Arrays:**
- `institutions`: JSON array, max 10 entries (e.g., ["Harvard University", "Google Inc."])
- `websites`: JSON array, max 5 entries with URL validation (e.g., ["https://example.com"])

**Profile Photo System:**
- `profile_image_url`: Points to medium-sized variant for general use
- `profile_photo_filename`: Base filename for generating all size variants
- Multiple size variants generated automatically (thumbnail, small, medium, large)

**Location JSON Structure:**
```json
{
  "display_name": "New York, NY, USA",
  "lat": 40.7128,
  "lon": -74.0060,
  "place_id": "123456",
  "address": {
    "city": "New York",
    "state": "NY",
    "country": "USA"
  },
  "importance": 0.9,
  "type": "city"
}
```

**Relationships:**
- `posts` - One-to-Many with Posts (user's posts)
- `likes` - One-to-Many with Likes (user's likes)
- `comments` - One-to-Many with Comments (user's comments)
- `followers` - One-to-Many with Follows (users following this user)
- `following` - One-to-Many with Follows (users this user follows)
- `notifications` - One-to-Many with Notifications (user's notifications)

### Posts Table (`posts`)

**Primary table for gratitude posts and content.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique post identifier |
| `author_id` | Integer | Foreign Key (users.id), Not Null | Post author |
| `title` | String | Nullable | Post title |
| `content` | Text | Not Null | Post content |
| `post_type` | Enum | Not Null, Default: 'daily' | Type: daily, photo, spontaneous |
| `image_url` | String | Nullable | Image URL for photo posts |
| `is_public` | Boolean | Default: True | Post visibility |
| `created_at` | DateTime | Default: now() | Post creation timestamp |
| `updated_at` | DateTime | On Update | Last modification timestamp |
| `hearts_count` | Integer | Not Null, Default: 0 | Cached count of hearts/likes |
| `reactions_count` | Integer | Not Null, Default: 0 | Cached count of emoji reactions |
| `shares_count` | Integer | Not Null, Default: 0 | Cached count of shares |

**Post Types:**
- `daily` - Daily gratitude posts (3x styling)
- `photo` - Photo gratitude posts (2x styling)
- `spontaneous` - Spontaneous text posts (compact styling)

**Performance Indexes:**
- `idx_posts_created_at_desc` - For chronological feeds (created_at DESC)
- `idx_posts_author_created_desc` - For user-specific feeds (author_id, created_at DESC)
- `idx_posts_engagement` - For engagement-based sorting (hearts_count, reactions_count, shares_count)

**Relationships:**
- `author` - Many-to-One with Users (post author)
- `likes` - One-to-Many with Likes (post likes)
- `comments` - One-to-Many with Comments (post comments)

### Likes Table (`likes`)

**Tracks user likes on posts.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique like identifier |
| `user_id` | Integer | Foreign Key (users.id), Not Null | User who liked |
| `post_id` | String | Foreign Key (posts.id), Not Null | Post that was liked |
| `created_at` | DateTime | Default: now() | Like timestamp |

**Constraints:**
- Unique constraint on (user_id, post_id) - prevents duplicate likes

**Relationships:**
- `user` - Many-to-One with Users (user who liked)
- `post` - Many-to-One with Posts (post that was liked)

### Comments Table (`comments`)

**Tracks comments on posts with support for nested replies.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique comment identifier |
| `author_id` | Integer | Foreign Key (users.id), Not Null | Comment author |
| `post_id` | String | Foreign Key (posts.id), Not Null | Post being commented on |
| `parent_id` | String | Foreign Key (comments.id), Nullable | Parent comment for replies |
| `content` | Text | Not Null | Comment content |
| `created_at` | DateTime | Default: now() | Comment creation timestamp |
| `updated_at` | DateTime | On Update | Last modification timestamp |

**Relationships:**
- `author` - Many-to-One with Users (comment author)
- `post` - Many-to-One with Posts (commented post)
- `parent` - Many-to-One with Comments (parent comment)
- `replies` - One-to-Many with Comments (child comments)

### Follows Table (`follows`)

**Tracks user follow relationships with status support.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique follow identifier |
| `follower_id` | Integer | Foreign Key (users.id), Not Null | User doing the following |
| `followed_id` | Integer | Foreign Key (users.id), Not Null | User being followed |
| `status` | String | Not Null, Default: 'active' | Follow status: 'active', 'pending', 'blocked' |
| `created_at` | DateTime | Default: now() | Follow timestamp |

**Follow Status Values:**
- `active` - Follow relationship is active and confirmed
- `pending` - Follow request is pending approval (for private accounts)
- `blocked` - Follow relationship is blocked

**Constraints:**
- Unique constraint on (follower_id, followed_id) - prevents duplicate follows
- Check constraint: follower_id != followed_id - prevents self-following

**Performance Indexes:**
- `idx_follows_follower_id` - For queries by follower
- `idx_follows_followed_id` - For queries by followed user
- `idx_follows_follower_followed` - Composite index for relationship checks
- `idx_follows_status` - For filtering by follow status
- `idx_follows_created_at` - For chronological ordering

**Relationships:**
- `follower` - Many-to-One with Users (user doing the following)
- `followed` - Many-to-One with Users (user being followed)

### Notifications Table (`notifications`)

**Tracks user notifications for various events.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique notification identifier |
| `user_id` | Integer | Foreign Key (users.id), Not Null, Index | Notification recipient |
| `type` | String | Not Null | Notification type |
| `priority` | String | Not Null, Default: 'normal' | Priority level |
| `title` | String | Not Null | Notification title |
| `message` | Text | Not Null | Notification message |
| `data` | JSON | Nullable | Additional notification data |
| `channel` | String | Not Null, Default: 'in_app' | Delivery channel |
| `read_at` | DateTime | Nullable | When notification was read |
| `created_at` | DateTime | Default: now() | Notification creation timestamp |

**Notification Types:**
- `like` - Someone liked your post
- `comment` - Someone commented on your post
- `follow` - Someone started following you
- `mention` - Someone mentioned you in a post/comment
- `emoji_reaction` - Someone reacted to your post with an emoji

**Priority Levels:**
- `low` - Non-urgent notifications
- `normal` - Standard notifications
- `high` - Important notifications

**Channels:**
- `in_app` - In-app notifications
- `email` - Email notifications
- `push` - Push notifications

**Relationships:**
- `user` - Many-to-One with Users (notification recipient)

## Database Relationships

### One-to-Many Relationships
- **User → Posts**: A user can have multiple posts
- **User → Likes**: A user can like multiple posts
- **User → Comments**: A user can make multiple comments
- **User → Notifications**: A user can have multiple notifications
- **Post → Likes**: A post can have multiple likes
- **Post → Comments**: A post can have multiple comments
- **Comment → Replies**: A comment can have multiple replies

### Many-to-Many Relationships
- **Users ↔ Users** (via Follows): Users can follow multiple users and be followed by multiple users

## Indexes

### Performance Indexes
- `users.email` - For email lookups
- `users.username` - For username lookups
- `posts.author_id` - For user's posts queries
- `posts.created_at` - For chronological post ordering
- `likes.post_id` - For post likes queries
- `comments.post_id` - For post comments queries
- `follows.follower_id` - For user's following list
- `follows.followed_id` - For user's followers list
- `follows.status` - For filtering active/pending follows
- `notifications.user_id` - For user's notifications

## Data Integrity

### Foreign Key Constraints
- All foreign keys are properly defined with CASCADE delete options
- User deletion cascades to their posts, likes, comments, and notifications
- Post deletion cascades to its likes and comments
- Comment deletion cascades to its replies

### Unique Constraints
- User email addresses must be unique
- User usernames must be unique
- Users cannot like the same post twice
- Users cannot follow the same user twice

### Check Constraints
- Users cannot follow themselves
- Post types must be valid enum values
- Notification priorities must be valid enum values

## Mention System Implementation

### Design Approach

The mention system is implemented **without a dedicated database table**, using a content-parsing approach that provides flexibility and simplicity:

#### How Mentions Work
1. **Content Parsing**: @username mentions are detected in post content using regex patterns
2. **Real-time Validation**: Usernames are validated against the `users` table using batch queries
3. **Notification Creation**: When posts are created, mentions are extracted and notifications are sent to mentioned users
4. **Frontend Highlighting**: Only validated usernames (existing users) are highlighted in the UI

#### Benefits of This Approach
- **No Additional Tables**: Reduces database complexity and maintenance overhead
- **Flexible Content**: Users can mention anyone without pre-existing relationships
- **Performance**: Batch validation minimizes database queries
- **Simplicity**: No complex join queries or relationship management needed

#### Technical Implementation
```python
# Mention detection in post content
mentions = extract_mentions(post.content)  # ["bob7", "alice", "john"]

# Batch validation against users table
valid_users = await user_service.validate_usernames_batch(mentions)
# Returns: {"valid_usernames": ["bob7", "alice"], "invalid_usernames": ["john"]}

# Notification creation for valid mentions
for username in valid_users["valid_usernames"]:
    user = await user_service.get_user_by_username(username)
    await notification_service.create_mention_notification(user.id, post.id, author.id)
```

#### Database Queries Used
- **User Search**: `SELECT * FROM users WHERE username ILIKE '%query%' LIMIT 10`
- **Batch Validation**: `SELECT username FROM users WHERE username IN ('bob7', 'alice', 'john')`
- **Profile Lookup**: `SELECT * FROM users WHERE username = 'bob7'`

#### Performance Considerations
- **Efficient Regex**: Optimized regex patterns for @username detection
- **Batch Operations**: Single query to validate multiple usernames
- **Caching**: Username validation results can be cached for performance
- **Rate Limiting**: Search endpoints are rate-limited to prevent abuse

## Repository Pattern & Query Optimization

### Repository Layer Architecture

The application uses a standardized repository pattern for data access:

#### BaseRepository Features
- **Query Builder Pattern**: Fluent interface for constructing complex queries
- **Standardized Error Handling**: Consistent exception handling across all repositories
- **Performance Monitoring**: Query performance tracking and optimization
- **Relationship Loading**: Efficient eager loading of related entities
- **Pagination Support**: Built-in pagination with total count optimization

#### Repository Classes
- **UserRepository**: User data access with profile and relationship queries
- **PostRepository**: Post data access with engagement metrics and feed generation
- **EmojiReactionRepository**: Reaction data access with aggregation and validation
- **LikeRepository**: Like/heart data access with user relationship tracking
- **NotificationRepository**: Notification data access with batching and filtering
- **FollowRepository**: Follow relationship data access with specialized queries and bulk operations

### Query Patterns

#### Standard CRUD Operations
```python
# Repository usage example
user_repo = UserRepository(db, User)

# Get with relationships
user = await user_repo.get_by_id(user_id, load_relationships=['posts', 'followers'])

# Paginated queries with filters
users, total = await user_repo.paginate(
    page=1, 
    per_page=20, 
    filters={'is_active': True},
    order_by=User.created_at.desc()
)

# Complex queries with builder pattern
posts = await post_repo.query()\
    .filter(Post.is_public == True)\
    .filter(Post.created_at >= datetime.now() - timedelta(days=7))\
    .join(User)\
    .order_by(Post.created_at.desc())\
    .limit(50)\
    .build()
```

#### Performance Optimizations
- **Selective Loading**: Load only required relationships to minimize queries
- **Query Monitoring**: Automatic logging of slow queries and N+1 detection
- **Index Usage**: Strategic indexes on foreign keys, timestamps, and filter columns
- **Bulk Operations**: Efficient bulk create/update operations for large datasets

### Follow System Query Patterns

#### Specialized Follow Queries
```python
# Get followers with user details and pagination
followers, total = await follow_repo.get_followers(
    user_id=user_id,
    status="active",
    limit=50,
    offset=0
)

# Get following list with user details
following, total = await follow_repo.get_following(
    user_id=user_id,
    status="active", 
    limit=50,
    offset=0
)

# Check follow status between two users
is_following = await follow_repo.is_following(
    follower_id=current_user_id,
    followed_id=target_user_id
)

# Get comprehensive follow statistics
stats = await follow_repo.get_follow_stats(user_id)
# Returns: {followers_count, following_count, pending_requests, pending_sent}

# Bulk check follow status for multiple users
status_map = await follow_repo.bulk_check_following_status(
    follower_id=current_user_id,
    user_ids=[1, 2, 3, 4, 5]
)
```

#### Follow Suggestions Algorithm
```python
# Get follow suggestions based on mutual connections
suggestions = await follow_repo.get_follow_suggestions(
    user_id=current_user_id,
    limit=10
)
```

The follow suggestions use a complex SQL query that finds:
1. Users followed by people the current user follows
2. Excludes users already followed by the current user
3. Excludes the current user themselves
4. Orders by username for consistent results

#### Performance Considerations
- **Efficient Joins**: Follow queries use proper JOIN operations to minimize database round trips
- **Index Usage**: All follow queries utilize indexes on `follower_id`, `followed_id`, and `status`
- **Pagination**: Large follow lists are paginated to prevent memory issues
- **Bulk Operations**: Multiple follow status checks are batched into single queries
- **Query Monitoring**: All follow operations are monitored for performance optimization

## Profile Photo Storage System

### Storage Architecture

The profile photo system uses a file-based storage approach with database references, optimized for performance and scalability.

#### File Storage Structure
```
uploads/
└── profile_photos/
    ├── profile_abc123def456_thumbnail.jpg  # 64x64 pixels
    ├── profile_abc123def456_small.jpg      # 128x128 pixels  
    ├── profile_abc123def456_medium.jpg     # 256x256 pixels
    └── profile_abc123def456_large.jpg      # 512x512 pixels
```

#### Database Integration

**Profile Photo Fields in Users Table:**
- `profile_image_url`: Direct URL to medium-sized variant (primary display)
- `profile_photo_filename`: Base filename for generating variant URLs

**Filename Generation:**
```python
# Format: profile_{uuid}_{size}.jpg
base_filename = "profile_abc123def456"
variants = {
    "thumbnail": f"{base_filename}_thumbnail.jpg",
    "small": f"{base_filename}_small.jpg", 
    "medium": f"{base_filename}_medium.jpg",
    "large": f"{base_filename}_large.jpg"
}
```

#### Image Processing Pipeline

**Upload Process:**
1. **Validation**: File type, size, and format validation
2. **Processing**: PIL/Pillow-based image processing with optimization
3. **Variant Generation**: Automatic creation of 4 size variants
4. **Database Update**: Update user record with new URLs
5. **Cleanup**: Remove old profile photo variants

**Size Variants:**
- **Thumbnail (64x64)**: User avatars in lists and small displays
- **Small (128x128)**: Compact profile displays and mentions
- **Medium (256x256)**: Default profile image size (stored in `profile_image_url`)
- **Large (512x512)**: High-resolution displays and profile pages

#### Performance Optimizations

**Image Processing:**
- JPEG compression with 85% quality and optimization
- Square aspect ratio with smart cropping
- Progressive JPEG encoding for faster loading
- Memory-efficient processing with automatic cleanup

**Storage Efficiency:**
- Organized directory structure for efficient file system operations
- Automatic cleanup of old variants when new photos are uploaded
- Unique filename generation prevents conflicts
- File validation prevents storage of invalid images

#### Default Avatar System

**Fallback Strategy:**
When users don't have profile photos, the system generates default avatar URLs:

```python
# Color-based avatar generation
colors = ["#7C3AED", "#A855F7", "#C084FC", "#DDD6FE", "#8B5CF6", "#9333EA", "#A21CAF", "#BE185D"]
color = colors[user_id % len(colors)]
avatar_url = f"/api/avatar/{user_id}?color={color.replace('#', '')}"
```

**Default Avatar Features:**
- Deterministic color assignment based on user ID
- Consistent purple theme matching app branding
- No database storage required (generated on-demand)
- Fallback for missing or deleted profile photos

#### Security and Validation

**File Validation:**
- Magic number validation for actual file type verification
- File size limits (5MB maximum)
- Supported formats: JPEG, PNG, WebP
- Filename sanitization to prevent directory traversal

**Access Control:**
- Profile photos are publicly accessible (no authentication for viewing)
- Upload/delete operations require user authentication
- Users can only modify their own profile photos
- Automatic cleanup prevents unauthorized file access

#### Migration Considerations

**Profile Photo Migration:**
The profile photo system was added in migration `002_add_user_profile_fields.py`:

```sql
-- Add profile photo fields to users table
ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(255);
ALTER TABLE users ADD COLUMN profile_photo_filename VARCHAR(255);
ALTER TABLE users ADD COLUMN display_name VARCHAR(100);
ALTER TABLE users ADD COLUMN city VARCHAR(100);
ALTER TABLE users ADD COLUMN institutions JSON;
ALTER TABLE users ADD COLUMN websites JSON;
ALTER TABLE users ADD COLUMN location JSON;
ALTER TABLE users ADD COLUMN profile_preferences JSON;

-- Add indexes for performance
CREATE INDEX idx_users_display_name ON users(display_name);
CREATE INDEX idx_users_city ON users(city);
CREATE INDEX idx_users_profile_photo_filename ON users(profile_photo_filename);
```

**Backward Compatibility:**
- All new profile fields are nullable for existing users
- Default avatar system provides fallback for users without photos
- Existing profile functionality remains unchanged
- Migration is non-destructive and reversible

## Migration History

The database uses Alembic for migrations with proper versioning:

### Core Migrations
- `000_create_base_tables.py` - Initial users and posts tables
- `001_create_emoji_reactions_table.py` - Emoji reactions system
- `002_add_user_profile_fields.py` - User profile enhancements
- `003_create_likes_table.py` - Hearts/likes system
- `004_add_notification_batching_fields.py` - Notification batching support
- `005_add_last_updated_at_field.py` - Timestamp tracking improvements

### Recent Migrations
- `1acf9fb80bfb_add_location_field_to_posts.py` - Location support for posts
- `d0081466f2ad_add_location_field_to_posts_table.py` - Location field migration
- `ecb4d319f326_add_notifications_table.py` - Enhanced notifications system
- `008_create_follows_table.py` - Follow system implementation with status support
- `dbf27ae66c7d_add_performance_indexes_and_engagement_.py` - Performance optimization indexes and engagement count caching

## Performance Optimizations

### Database Indexes

The database includes comprehensive indexing for optimal query performance:

**Posts Table Indexes:**
- `idx_posts_created_at_desc` - Optimizes chronological feed queries (`ORDER BY created_at DESC`)
- `idx_posts_author_created_desc` - Optimizes user-specific feed queries (`WHERE author_id = ? ORDER BY created_at DESC`)
- `idx_posts_engagement` - Optimizes engagement-based sorting using cached counts (`hearts_count`, `reactions_count`, `shares_count`)

**Follows Table Indexes:**
- `idx_follows_follower_id` - Optimizes "who am I following" queries
- `idx_follows_followed_id` - Optimizes "who follows me" queries  
- `idx_follows_follower_followed` - Optimizes relationship existence checks
- `idx_follows_status` - Optimizes filtering by follow status
- `idx_follows_created_at` - Optimizes chronological follow ordering

**Engagement Count Caching:**
Posts table includes denormalized engagement counts (`hearts_count`, `reactions_count`, `shares_count`) to avoid expensive JOIN operations in feed algorithms. These counts are automatically updated when engagement actions occur.

**Algorithm Service Optimization:**
The database schema has been optimized specifically for the AlgorithmService with the following enhancements:

**Engagement Count Caching:**
Posts table includes denormalized engagement counts that are automatically updated:
- `hearts_count` - Cached count of hearts/likes for fast algorithm scoring
- `reactions_count` - Cached count of emoji reactions for engagement calculation  
- `shares_count` - Cached count of shares for viral content detection

**Algorithm-Specific Indexes:**
- `idx_posts_engagement` - Composite index on (hearts_count, reactions_count, shares_count) for fast engagement-based sorting
- `idx_posts_created_at_desc` - Optimized for chronological fallback and 20% recent content in algorithm feed
- `idx_posts_author_created_desc` - Optimized for user-specific content and relationship-based scoring

**Query Performance with Algorithm:**
- Algorithm-scored feeds: < 5ms execution time (including score calculation)
- Chronological feeds: < 1ms execution time
- User-specific feeds: < 1ms execution time  
- Engagement-based queries: < 2ms execution time
- Follow relationship queries: < 1ms execution time
- Trending posts calculation: < 10ms execution time

## AlgorithmService Database Integration

### Feed Algorithm Database Requirements

The AlgorithmService requires specific database optimizations for efficient feed generation:

#### Engagement Count Denormalization
The posts table includes cached engagement counts to avoid expensive JOIN operations during algorithm scoring:

```sql
-- Engagement count columns added to posts table
ALTER TABLE posts ADD COLUMN hearts_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN reactions_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN shares_count INTEGER NOT NULL DEFAULT 0;
```

These counts are automatically updated when engagement actions occur, eliminating the need for complex aggregation queries during feed generation.

#### Algorithm-Optimized Indexes
Strategic indexes support the AlgorithmService scoring and ranking operations:

```sql
-- Engagement-based sorting index
CREATE INDEX idx_posts_engagement ON posts (hearts_count, reactions_count, shares_count);

-- Chronological ordering index (for 20% recent content and fallback)
CREATE INDEX idx_posts_created_at_desc ON posts (created_at DESC);

-- User-specific content index (for relationship multipliers)
CREATE INDEX idx_posts_author_created_desc ON posts (author_id, created_at DESC);
```

#### Follow Relationship Optimization
The follows table includes comprehensive indexes to support relationship-based scoring:

```sql
-- Follow relationship indexes for algorithm
CREATE INDEX idx_follows_follower_followed ON follows (follower_id, followed_id);
CREATE INDEX idx_follows_status ON follows (status);
```

#### Algorithm Query Patterns
The AlgorithmService uses optimized query patterns:

1. **Engagement Count Retrieval**: Uses cached counts from posts table instead of JOINs
2. **Relationship Checking**: Efficient follow status lookup using composite indexes
3. **Score Calculation**: Batch processing of posts with minimal database queries
4. **Feed Composition**: Separate queries for algorithm-scored and recent content

#### Performance Monitoring
The AlgorithmService includes built-in performance monitoring:
- Query execution time tracking
- Slow query detection and logging
- Algorithm scoring performance metrics
- Feed generation time monitoring

## Development Notes

### Database Configuration
- **Test Database**: Uses PostgreSQL test database for production-like testing
- **Production Database**: Uses PostgreSQL with proper indexing and connection pooling
- **Async Operations**: All database operations are async using SQLAlchemy 2.0
- **Connection Management**: Proper session management with automatic cleanup

### Data Types & Performance
- **UUID Usage**: Posts, likes, comments, follows, and notifications use UUID primary keys for scalability
- **Integer IDs**: Users use integer primary keys for performance and foreign key efficiency
- **Timestamp Indexing**: Strategic indexes on created_at and updated_at fields
- **Relationship Optimization**: Efficient loading strategies for complex relationships

### Repository Pattern Benefits
- **Consistent Error Handling**: Standardized exception handling across all data operations
- **Query Reusability**: Common query patterns abstracted into reusable methods
- **Performance Monitoring**: Built-in query performance tracking and optimization
- **Type Safety**: Integration with shared type definitions for compile-time safety

---

*Last updated: August 27, 2025* 