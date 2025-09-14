# Read Status Mechanism - Curl Demo

This is a simple curl-based demonstration of the read status mechanism that you can run manually to see how it works.

## Prerequisites

1. Backend server running on `http://localhost:8000`
2. At least one user account with authentication token
3. A few posts in the system

## Step-by-Step Demo

### 1. Get Initial Feed

First, get the user's feed to see the initial state:

```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=5&consider_read_status=true" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq
```

**What to look for:**
- `algorithm_score` values for each post
- `is_read: false` for all posts initially
- `is_unread: true/false` based on post timestamps vs last feed view

### 2. Mark Some Posts as Read

Take the first 2 post IDs from the feed response and mark them as read:

```bash
curl -X POST "http://localhost:8000/api/v1/posts/read-status" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "post_ids": ["POST_ID_1", "POST_ID_2"]
  }' | jq
```

**Expected response:**
```json
{
  "success": true,
  "message": "Marked 2 posts as read",
  "read_count": 2,
  "post_ids": ["POST_ID_1", "POST_ID_2"]
}
```

### 3. Get Feed Again (See the Impact)

Request the feed again to see how read status affects ranking:

```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=5&consider_read_status=true" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq
```

**What to observe:**
- Previously read posts now have `is_read: true`
- Read posts have significantly lower `algorithm_score` values
- Unread posts should rank higher than read posts
- Feed order may have changed to prioritize unread content

### 4. Compare with Read Status Disabled

Get the feed with read status disabled to see the difference:

```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=5&consider_read_status=false" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq
```

**What to observe:**
- All posts show `is_read: false`
- Scores are based only on engagement and time factors
- Feed order may differ from read-status-enabled version

### 5. Test Refresh Mode

Try refresh mode which strongly prioritizes unread content:

```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=5&consider_read_status=true&refresh=true" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq
```

**What to observe:**
- Unread posts should dominate the top positions
- Even stronger prioritization of fresh content

### 6. Check Read Status Summary

Get a summary of read status for the user:

```bash
curl -X GET "http://localhost:8000/api/v1/posts/read-status/summary" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "read_count": 2,
    "recent_reads": [
      {
        "post_id": "POST_ID_1",
        "read_at": "2025-09-14T19:15:30.123Z"
      },
      {
        "post_id": "POST_ID_2",
        "read_at": "2025-09-14T19:15:30.456Z"
      }
    ]
  }
}
```

### 7. Clear Read Status

Clear all read status to reset the mechanism:

```bash
curl -X DELETE "http://localhost:8000/api/v1/posts/read-status" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq
```

**Expected response:**
```json
{
  "success": true,
  "message": "Read status cleared successfully"
}
```

### 8. Verify Clearing Worked

Get the feed again to verify all posts are now unread:

```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=5&consider_read_status=true" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" | jq
```

**What to observe:**
- All posts should show `is_read: false`
- Scores should be back to unread levels
- Feed ranking should reflect unread state

## Key Observations

### Score Impact
- **Unread boost**: 3.0x multiplier (configurable)
- **Read penalty**: ~0.33x multiplier (1/unread_boost)
- **Net difference**: ~9x scoring advantage for unread posts

### Feed Behavior
- Read posts drop significantly in ranking
- Unread posts rise to the top
- High-engagement read posts can still appear but lower
- Refresh mode provides even stronger unread prioritization

### API Features
- Bulk read status marking
- Read status summary with timestamps
- Ability to clear all read status
- Read status can be disabled per request

## Real-World Impact

This mechanism provides:

1. **Content Discovery**: Users see fresh content first
2. **Reduced Repetition**: Already-seen posts are deprioritized  
3. **Engagement Balance**: Quality read posts can still appear
4. **User Control**: Can be disabled or cleared as needed
5. **Session Persistence**: Read status maintained during browsing

## Troubleshooting

If the mechanism isn't working as expected:

1. **Check authentication**: Ensure valid token is provided
2. **Verify post IDs**: Use actual post IDs from your system
3. **Check timestamps**: Ensure posts have realistic created_at times
4. **Review configuration**: Verify unread_boost setting in algorithm config
5. **Test isolation**: Try with a fresh user account

The read status mechanism significantly improves user experience by promoting content discovery while maintaining engagement with quality posts.