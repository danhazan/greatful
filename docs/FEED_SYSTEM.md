# Feed System & Ranking Algorithm

This document describes the architecture and scoring logic of the Grateful feed system as of March 2026.

## Overview

The feed system provides a ranked list of posts for the user, optimized for engagement, social relevance, and recency. It uses a single consolidated service, `FeedServiceV2`, which performs high-performance scoring directly in SQL (PostgreSQL).

### Key Architectural Decisions
- **SQL-Based Scoring**: All ranking signals are computed in the database using CTEs and window functions. This eliminates the need to fetch large candidate lists into Python for processing.
- **Cursor-Based Pagination**: Uses stable `(score, timestamp, id)` cursors to ensure no posts are skipped or duplicated as the user scrolls.
- **Author Spacing**: Implemented post-query to ensure diversity in the user's feed, preventing any single author from dominating the view.
- **Unified Logic**: Replaces the previous multi-service architecture (`AlgorithmService`, `OptimizedAlgorithmService`) with a single source of truth.

---

## Ranking Algorithm

The final `feed_score` for a post is the sum of several weighted signals. All constants are defined in `apps/api/app/config/feed_config.py`.

### 1. Recency Score
- **Weight**: Max 10.0
- **Logic**: Linear decay over 7 days (`604,800` seconds).
- **Purpose**: Ensures the feed stays fresh by penalizing older content.

### 2. Engagement Score
- **Weight**: Max 5.0 (log-scaled)
- **Logic**: `LN(1 + (comments * 3) + (shares * 4) + (reactions * 2))`
- **Purpose**: Boosts posts that have generated interaction, with diminishing returns via logarithmic scaling.

### 3. Relationship Score
- **Weight**: Variable (Mutual: 4.5, Following: 3.0, Followed-by: 1.5)
- **Logic**: Scaled by recency so it fades as the post ages.
- **Purpose**: Prioritizes content from people the user knows or follows.

### 4. Own Post Boost
- **Weight**: Two-phase decay (Phase 1: 6.0 over 1h, Phase 2: 2.0 over next 5h)
- **Logic**: Only applies to the post author.
- **Purpose**: Ensures a user's own new posts appear at the top of their timeline/feed immediately after creation.

### 5. Recent Engagement Boost
- **Weight**: Max 1.5
- **Logic**: Boosts posts less than 2 days old that are currently gaining traction (comments and reactions).
- **Purpose**: Surphases "viral" or trending content quickly.

### 6. User Reaction Boost
- **Weight**: +1.0
- **Logic**: Static boost if the current user has reacted to the post.
- **Purpose**: Implicitly keeps content the user likes higher in their view.

### 7. Discovery Boost
- **Weight**: +2.0
- **Logic**: Boosts high-engagement image posts from users the current viewer does *not* follow.
- **Note**: Only applies if engagement exceeds a threshold (10 points) and the post contains an image.

### 8. Deterministic Jitter
- **Weight**: +/- 0.1
- **Logic**: Derived from the MD5 hash of `post_id` and `query_time`.
- **Purpose**: Provides subtle variation in the feed so it doesn't feel static if the user refreshes without new content arriving.

---

## Author Spacing

To prevent "author clustering," the system applies a spacing constraint after the initial SQL query:

1. **Candidate Pool**: Fetches `page_size * 3` candidates from SQL.
2. **LRU-Based Spacing**: Iterates through candidates and selects the one that violates the spacing constraint the least.
3. **Constraint**: Maximum `2` posts per author in any window of `6` posts.
4. **Degradation**: If no valid candidate exists in the pool, it fallback to the next highest-scoring post regardless of author.

---

## Pagination & Stability

The system uses **Cursor-Based Pagination** encoded as Base64 JSON.

**Cursor Fields:**
- `qt`: Query Time (frozen for all pages in a session)
- `s`: Feed Score
- `t`: Created At (ISO timestamp)
- `id`: Post UUID

**Stability Guarantees:**
- Offsets are never used.
- If new posts are created during a session, they do not shift the positions of posts the user has already seen.
- Handled by sorting by `(feed_score DESC, created_at DESC, id DESC)`.

---

## Privacy & Security

Visibility is enforced **at the database level** within the scoring query using the `can_view_post(user_id, post_id)` PostgreSQL function.

- **Public**: Visible to everyone.
- **Private**: Visible only to the author.
- **Custom**: Visible to specific users or relationship groups (followers/following).

> [!NOTE]
> **SQLite Limitation**: In integration tests (SQLite), only `public` and `private` rules are fully enforced in the feed. Custom rules require PostgreSQL CTE support and are mocked/simplified in test environments.

---

## API Contract

### Endpoint
`GET /api/v1/posts/feed`

### Parameters
- `cursor` (optional): Base64 pagination token.
- `page_size` (optional): Default 10, Max 50.

### Response (camelCase)
```json
{
  "posts": [
    {
      "id": "...",
      "authorId": 123,
      "imageUrl": "...",
      "createdAt": "2026-03-31T...",
      "reactionsCount": 8,
      ...
    }
  ],
  "nextCursor": "ey..."
}
```

---

## System Removals (Legacy)

The following systems were **removed** during the March 2026 refactor and should not be reintroduced:
- `AlgorithmService` / `OptimizedAlgorithmService`: Python-based scoring is deprecated.
- `BatchPreferenceService`: Preference-based re-ranking is handled by SQL.
- `post_type`: The gratitude/photo/meditation type system is removed in favor of a unified post model.
- **Read-Status Tracking**: Engagement is now the primary signal for "read" or "interacted" state.
- **Hearts/Likes System**: Separate hearts system removed in favor of unified reactions.
- **Offset Pagination**: Removed to prevent item skipping during high-frequency posting.
