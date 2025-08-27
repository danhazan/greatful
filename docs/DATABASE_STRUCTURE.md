# Database Structure Documentation

## Overview

The Grateful application uses PostgreSQL as the primary database with SQLAlchemy ORM for data modeling and a standardized repository pattern for data access. This document describes the current database schema, relationships, and query patterns implemented through the repository layer.

## Database Schema

### Users Table (`users`)

**Primary table for user accounts and profiles.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | Integer | Primary Key, Index | Unique user identifier |
| `email` | String | Unique, Index, Not Null | User's email address |
| `username` | String | Unique, Index, Not Null | Unique username |
| `hashed_password` | String | Not Null | Encrypted password |
| `created_at` | DateTime | Not Null, Default: now() | Account creation timestamp |

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

**Post Types:**
- `daily` - Daily gratitude posts (3x styling)
- `photo` - Photo gratitude posts (2x styling)
- `spontaneous` - Spontaneous text posts (compact styling)

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

**Tracks user follow relationships.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique follow identifier |
| `follower_id` | Integer | Foreign Key (users.id), Not Null | User doing the following |
| `followed_id` | Integer | Foreign Key (users.id), Not Null | User being followed |
| `created_at` | DateTime | Default: now() | Follow timestamp |

**Constraints:**
- Unique constraint on (follower_id, followed_id) - prevents duplicate follows
- Check constraint: follower_id != followed_id - prevents self-following

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