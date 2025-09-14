# Read Status Testing Scenario

This document provides a step-by-step manual testing scenario to demonstrate how the read status mechanism works in the Grateful app.

## 🎯 Scenario Overview

**User Story**: Alice wants to see fresh content in her feed and avoid seeing the same posts repeatedly.

**Test Goal**: Demonstrate how read status affects feed ranking and content discovery.

## 📋 Prerequisites

1. Backend server running on `http://localhost:8000`
2. Frontend server running on `http://localhost:3000`
3. At least 2 test users with some posts created
4. API testing tool (Postman, curl, or browser dev tools)

## 🚀 Step-by-Step Test Scenario

### Step 1: Setup Test Data

Create test users and posts using the API or frontend:

**Users:**
- Alice (primary test user)
- Bob (content creator)
- Charlie (content creator)

**Posts:** Create 5-6 posts with different timestamps:
- 2-3 older posts (created 2+ hours ago)
- 2-3 newer posts (created within last hour)

### Step 2: Initial Feed Load

**Action:** Get Alice's initial feed
```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=10&consider_read_status=true" \
  -H "Authorization: Bearer <alice_token>"
```

**Expected Results:**
- Newer posts should appear higher in the feed
- All posts should have `"is_read": false` and `"is_unread": true/false` based on timestamps
- Posts created after Alice's `last_feed_view` should have `"is_unread": true`

**What to Look For:**
```json
{
  "posts": [
    {
      "id": "new-post-1",
      "content": "Recent post",
      "algorithm_score": 85.2,
      "is_read": false,
      "is_unread": true,
      "created_at": "2025-09-14T18:30:00Z"
    },
    {
      "id": "old-post-1", 
      "content": "Older post",
      "algorithm_score": 12.4,
      "is_read": false,
      "is_unread": false,
      "created_at": "2025-09-14T15:30:00Z"
    }
  ]
}
```

### Step 3: Mark Posts as Read

**Action:** Simulate Alice reading the first 2 posts
```bash
curl -X POST "http://localhost:8000/api/v1/posts/read-status" \
  -H "Authorization: Bearer <alice_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "post_ids": ["new-post-1", "old-post-1"]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Marked 2 posts as read",
  "read_count": 2,
  "post_ids": ["new-post-1", "old-post-1"]
}
```

### Step 4: Refresh Feed

**Action:** Get Alice's feed again
```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=10&consider_read_status=true" \
  -H "Authorization: Bearer <alice_token>"
```

**Expected Results:**
- Previously read posts should have lower `algorithm_score` values
- Read posts should have `"is_read": true`
- Unread posts should rank higher than read posts
- Feed order should change to prioritize unread content

**Score Comparison:**
- Unread posts: Higher scores (boosted by 3x)
- Read posts: Lower scores (penalized by ~0.33x)

### Step 5: Test Read Status Disabled

**Action:** Get feed with read status disabled
```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=10&consider_read_status=false" \
  -H "Authorization: Bearer <alice_token>"
```

**Expected Results:**
- All posts should have `"is_read": false`
- Scores should be based only on engagement and time factors
- Feed order may differ from read-status-enabled version

### Step 6: Test Refresh Mode

**Action:** Get feed in refresh mode
```bash
curl -X GET "http://localhost:8000/api/v1/posts/feed?limit=10&consider_read_status=true&refresh=true" \
  -H "Authorization: Bearer <alice_token>"
```

**Expected Results:**
- Unread posts should dominate the top positions
- Read posts should be further deprioritized
- Fresh content should be strongly prioritized

### Step 7: Check Read Status Summary

**Action:** Get read status summary
```bash
curl -X GET "http://localhost:8000/api/v1/posts/read-status/summary" \
  -H "Authorization: Bearer <alice_token>"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "read_count": 2,
    "recent_reads": [
      {
        "post_id": "new-post-1",
        "read_at": "2025-09-14T19:15:30.123Z"
      },
      {
        "post_id": "old-post-1", 
        "read_at": "2025-09-14T19:15:30.456Z"
      }
    ]
  }
}
```

### Step 8: Clear Read Status

**Action:** Clear all read status
```bash
curl -X DELETE "http://localhost:8000/api/v1/posts/read-status" \
  -H "Authorization: Bearer <alice_token>"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Read status cleared successfully"
}
```

**Verification:** Get feed again - all posts should show as unread

## 🔍 Key Observations to Make

### 1. Score Impact
- **Unread posts**: Get 3x boost (unread_boost = 3.0)
- **Read posts**: Get ~0.33x penalty (1/unread_boost)
- **Score difference**: Should be ~9x between unread and read posts

### 2. Feed Ranking Changes
- **Before reading**: Posts ranked by engagement + time + content type
- **After reading**: Read posts drop significantly in ranking
- **Refresh mode**: Even stronger prioritization of unread content

### 3. Metadata Accuracy
- `is_read`: Reflects session-based read tracking
- `is_unread`: Reflects timestamp-based unread detection
- `algorithm_score`: Shows the impact of read status multipliers

### 4. API Consistency
- Read status persists within the session
- Bulk operations work correctly
- Summary provides accurate statistics

## 🧪 Advanced Testing Scenarios

### Scenario A: Mixed Content Types
Test with different post types (daily, photo, spontaneous) to see how read status interacts with content bonuses.

### Scenario B: High Engagement Posts
Test with posts that have many hearts/reactions to see if read status can overcome high engagement scores.

### Scenario C: Time-based Transitions
Test posts that transition from "unread by timestamp" to "read by timestamp" as time passes.

### Scenario D: Multiple Users
Test read status isolation between different users to ensure no cross-contamination.

## 📊 Expected Performance Metrics

- **Feed generation time**: Should remain <300ms even with read status processing
- **Read status API calls**: Should complete in <50ms
- **Memory usage**: Read status cache should be reasonable for typical session sizes

## 🚨 Common Issues to Watch For

1. **Score calculation errors**: Verify multipliers are applied correctly
2. **Timestamp handling**: Ensure timezone-aware comparisons work
3. **Cache consistency**: Read status should persist throughout session
4. **API validation**: Invalid post IDs should be handled gracefully
5. **Performance impact**: Read status shouldn't significantly slow down feeds

## ✅ Success Criteria

The read status mechanism is working correctly if:

1. ✅ Unread posts consistently rank higher than read posts
2. ✅ Read posts show significant score reduction (~3x penalty)
3. ✅ API endpoints respond correctly and update state
4. ✅ Read status can be disabled without breaking feeds
5. ✅ Refresh mode provides stronger unread prioritization
6. ✅ Performance remains within acceptable limits
7. ✅ User isolation prevents cross-user read status leakage

## 🎯 Real-World Usage Patterns

This mechanism supports these user behaviors:

- **Content Discovery**: Users see fresh content first
- **Reduced Repetition**: Already-seen posts are deprioritized
- **Engagement Maintenance**: High-quality read posts can still appear
- **Session Continuity**: Read status persists during browsing session
- **Flexible Control**: Can be disabled for chronological browsing

The read status system enhances user experience by promoting content discovery while maintaining engagement with quality posts.