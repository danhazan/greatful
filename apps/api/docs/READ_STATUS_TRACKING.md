# Read Status Tracking System

## Overview

The Read Status Tracking system is a feature that allows the algorithm to deprioritize posts that users have already read, improving the relevance of the feed by showing fresh content first.

## Architecture

### In-Memory Session-Based Tracking

The read status tracking is implemented as an **in-memory cache** within the `AlgorithmService`. This means:

- Read status is tracked per user session
- Data is lost when the service restarts or between separate API requests
- Designed for real-time feed optimization within a single session
- Lightweight and fast with no database overhead

### Key Components

1. **AlgorithmService**: Core service with read status tracking methods
2. **API Endpoints**: REST endpoints for managing read status
3. **Feed Integration**: Automatic read status consideration in feed ranking

## API Endpoints

### POST /api/v1/posts/read-status
Mark posts as read for the current user.

**Request Body:**
```json
{
  "post_ids": ["post-1", "post-2", "post-3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Marked 3 posts as read",
  "read_count": 3,
  "post_ids": ["post-1", "post-2", "post-3"]
}
```

### GET /api/v1/posts/read-status/summary
Get summary of read status for debugging and analytics.

**Response:**
```json
{
  "success": true,
  "user_id": 123,
  "read_count": 5,
  "recent_reads": [
    {
      "post_id": "post-1",
      "read_at": "2025-01-08T15:30:00Z"
    }
  ]
}
```

### DELETE /api/v1/posts/read-status
Clear all read status for the current user.

**Response:**
```json
{
  "success": true,
  "message": "Read status cleared successfully"
}
```

## Feed Integration

### Algorithm Scoring

When `consider_read_status=true` (default), the algorithm applies a penalty to already-read posts:

```python
# Read posts get penalized by the inverse of the unread boost
read_status_multiplier = 1.0 / config.scoring_weights.unread_boost  # Default: 1/3 = 0.33
final_score = base_score * relationship_multiplier * read_status_multiplier
```

### Feed Endpoint Parameters

The feed endpoint supports read status tracking:

```
GET /api/v1/posts/feed?consider_read_status=true
```

- `consider_read_status=true` (default): Apply read status penalties
- `consider_read_status=false`: Ignore read status in scoring

### Response Format

Posts in the feed include an `is_read` field:

```json
{
  "id": "post-123",
  "content": "Grateful for...",
  "is_read": false,
  "algorithm_score": 15.2
}
```

## Configuration

Read status behavior is configured in `algorithm_config.py`:

```python
@dataclass
class ScoringWeights:
    unread_boost: float = 3.0  # Multiplier for unread posts
```

- Higher `unread_boost` values create stronger penalties for read posts
- Read posts get scored as `original_score / unread_boost`

## Usage Patterns

### Frontend Integration

1. **Viewport Detection**: Track when posts enter the user's viewport
2. **Batch Marking**: Collect post IDs and mark them as read in batches
3. **Feed Refresh**: Request new feed content with read status applied

### Example Frontend Flow

```javascript
// Track posts in viewport
const visiblePosts = ['post-1', 'post-2', 'post-3'];

// Mark as read
await fetch('/api/v1/posts/read-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ post_ids: visiblePosts })
});

// Refresh feed with read status applied
const feed = await fetch('/api/v1/posts/feed?consider_read_status=true');
```

## Persistence Options (Future Enhancement)

The current implementation is session-based. For persistence across sessions, consider:

### Option 1: localStorage (Frontend)
- Store read post IDs in browser localStorage
- Send to backend on session start
- Pros: No database overhead, user-controlled
- Cons: Limited to single device/browser

### Option 2: User Preferences (Backend)
- Store read status in user preferences table
- Persist across devices and sessions
- Pros: Cross-device sync, permanent storage
- Cons: Database overhead, privacy considerations

### Option 3: Time-Based Expiry
- Automatically expire read status after N days
- Balance between freshness and performance
- Configurable expiry periods per user preference

## Performance Considerations

### Memory Usage
- In-memory cache grows with user activity
- Automatic cleanup on service restart
- Consider implementing LRU eviction for long-running sessions

### Database Impact
- Current implementation has zero database overhead
- Read status queries are O(1) hash lookups
- No additional database tables or indexes required

### Scalability
- Each service instance maintains separate cache
- Load balancer sticky sessions recommended for consistency
- Consider Redis for shared cache in multi-instance deployments

## Testing

### Unit Tests
- `test_read_status_tracking.py`: Core functionality tests
- Covers marking, checking, clearing, and scoring integration

### Integration Tests
- `test_read_status_api.py`: API endpoint tests
- Tests session isolation and error handling
- Note: Tests account for session-based caching behavior

### Test Considerations
- Session-based caching means read status doesn't persist between API calls in tests
- Tests verify API structure and immediate functionality
- Integration tests document expected session-based behavior

## Security Considerations

### Input Validation
- Post ID validation against public posts only
- Rate limiting on read status endpoints (50 posts max per request)
- Authentication required for all read status operations

### Privacy
- Read status is user-specific and isolated
- No cross-user read status visibility
- Automatic cleanup on session end

### Performance Protection
- Batch size limits prevent abuse
- In-memory storage prevents database flooding
- Graceful degradation if read status unavailable

## Monitoring and Analytics

### Metrics to Track
- Read status API usage patterns
- Feed algorithm performance with/without read status
- User engagement improvements from read status tracking

### Debug Endpoints
- `/read-status/summary` provides debugging information
- Algorithm service includes read status in scoring logs
- Performance monitoring for feed generation times

## Future Enhancements

### Advanced Features
1. **Smart Expiry**: Automatically expire old read status
2. **Cross-Device Sync**: Sync read status across user devices
3. **Preference Controls**: User settings for read status behavior
4. **Analytics Integration**: Track read status impact on engagement

### Performance Optimizations
1. **Redis Cache**: Shared cache for multi-instance deployments
2. **Batch Processing**: Optimize bulk read status operations
3. **Background Cleanup**: Periodic cleanup of old read status data

## Conclusion

The Read Status Tracking system provides a lightweight, session-based approach to improving feed relevance by deprioritizing already-read content. The in-memory implementation ensures fast performance while the modular design allows for future enhancements like persistent storage or cross-device synchronization.