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

### Visibility Architecture

Post visibility is enforced at two levels, each serving a different consumer:

| Component | Consumer | Mechanism |
|-----------|----------|-----------|
| `feed_visibility_sql.build_visibility_sql()` | Feed query (raw SQL with CTEs) | Generates an inline SQL `WHERE` clause with all predicates visible to the planner |
| `PostPrivacyService.visible_to_user_clause()` | ORM queries, single-post checks, admin queries | SQLAlchemy ORM expression |

Both implementations are **intentionally independent** — they operate at different abstraction levels — and are kept behaviorally identical through a shared golden equivalence test suite (see [below](#golden-equivalence-tests)).

### Visibility Rules

Every visibility implementation encodes the same decision tree:

```
author_id = viewer_id
  OR privacy_level = 'public'
  OR (
      privacy_level = 'custom'
      AND (
          (followers_rule AND viewer_follows_author)
          OR (following_rule AND author_follows_viewer)
          OR viewer_is_specific_user
      )
  )
```

- **Public** (`privacy_level = 'public'`): Visible to everyone, including unauthenticated viewers.
- **Private** (`privacy_level = 'private'`): Visible only to the post author. All other viewers are blocked regardless of follow relationships.
- **Custom** (`privacy_level = 'custom'`): Visible to the author, plus any user matching at least one audience rule:
  - *followers*: The viewer follows the post author.
  - *following*: The post author follows the viewer (return-follow).
  - *specific_users*: The viewer is listed in the post's `post_privacy_users` table.

The feed query additionally filters `deleted_at IS NULL` as part of the visibility clause (handled by the builder). The ORM expression omits this — the caller adds it where needed.

### Why the SQL Builder Exists (Instead of a Database Function)

The feed query previously used `can_view_post(viewer_id, post_id)` — a PostgreSQL SQL function. While concise, this function was opaque to the planner:

- **Blocked predicate pushdown**: The planner could not see column references inside the function body, preventing index selection on `author_id` and `privacy_level`.
- **Killed selectivity estimation**: The function was estimated at a fixed cost (100 units) regardless of data distribution, causing selectivity misestimation of 2.6× to 520×.
- **Prevented short-circuit evaluation**: Every post required a full function call instead of evaluating cheap column filters first.

The inline SQL fragment exposes all predicates to the planner, enabling:

- **Index selection**: The planner uses `idx_posts_author_deleted` with `Index Cond: (deleted_at IS NULL)` and `Filter: (author_id = :uid OR ...)`.
- **Short-circuit OR evaluation**: `author_id = :uid` and `privacy_level = 'public'` are evaluated as column references before expensive `EXISTS` subqueries.
- **Accurate row estimates**: The inline version estimates within ~1% error for common scenarios, compared to 2.6–520× error with the function.

Benchmark results at 100K scale (see `docs/FEED_FILTER_PERFORMANCE_REPORT.md`):

| Metric | Function (`can_view_post`) | Inline SQL |
|--------|---------------------------|------------|
| Execution time | Baseline | 1.2×–3.6× faster |
| Buffer access | Baseline | 12×–179× fewer shared hits |
| Temp file spills | Present in combined-filter scenarios | Eliminated |

### Why the ORM Implementation Still Exists

The ORM expression (`visible_to_user_clause()`) is kept as a separate implementation because:

1. **Different abstraction level**: It produces a composable SQLAlchemy `whereclause` for repository-layer queries (e.g., `PostRepository._apply_visibility()`), not a raw SQL string.
2. **Different consumer**: The feed query uses raw SQL for performance (direct CTE control, expression compilation); the ORM path serves single-post checks, admin queries, and timeline fetching.
3. **Unnecessary coupling**: Unifying them would require the ORM layer to generate raw SQL or the feed query to use SQLAlchemy expressions — both worse than keeping two focused implementations.

The two implementations are not merged because they serve different purposes. They are kept behaviorally aligned through testing (see below).

### Golden Equivalence Tests

The file `tests/unit/visibility_scenarios.py` defines a shared scenario matrix covering all privacy levels, rule types, viewer relationships, and edge cases (25 scenarios). Three test suites consume this matrix and assert identical visibility decisions:

| Test file | Implementation under test |
|-----------|--------------------------|
| `test_visibility_pg_builder.py` | `build_visibility_sql("postgresql")` |
| `test_visibility_sqlite_builder.py` | `build_visibility_sql("sqlite")` |
| `test_visibility_orm.py` | `PostPrivacyService.visible_to_user_clause()` |

Each suite seeds the same database state (post with specific privacy configuration, follow relationships, privacy rules) and checks that its implementation produces the expected visibility outcome. This guarantees behavioural equivalence without requiring implementation equivalence.

### Decision Summary

This is the intended long-term architecture. The `can_view_post()` PostgreSQL function was removed because its planner encapsulation cost exceeded its reuse value. The current architecture — a raw-SQL builder for the feed query and an ORM expression for everything else, verified by golden equivalence tests — provides both performance and correctness.

A database visibility function should **not** be reintroduced without compelling new evidence that its benefits outweigh the planner degradation documented in the benchmark.

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

## Feed Filters (Post Type, Date, Author, Keyword)

The feed supports layered filtering that narrows the candidate set before scoring and pagination. Filters are passed as query parameters to `GET /api/v1/posts/feed` and forwarded from the Next.js API proxy at `apps/web/src/app/api/posts/route.ts`.

### Filter Architecture Overview

```
User → Feed Page (Next.js)
  │  URL search params
  ▼
parseFeedFiltersFromSearchParams()
  │  AppliedFeedFilters (in-memory state)
  ▼
TypeFilterModal / DateFilterModal / SearchFilterModal
  │  User modifies filters
  ▼
serializeFeedFiltersToUrl()
  │  URL search params
  ▼
Next.js API Proxy (/api/posts/route.ts)
  │  Iterates FEED_FILTER_MULTI_PARAMS / FEED_FILTER_SINGLE_PARAMS
  ▼
FastAPI Backend (/api/v1/posts/feed)
  │  get_feed() → FeedServiceV2.get_feed()
  ▼
PredicateGroup engine → SQL WHERE clause
  ▼
Ranked + Filtered Feed
```

### Post Type Filters

Three query parameters control which types of posts appear in the feed:

| Parameter | Semantics | SQL Combination | Example |
|---|---|---|---|
| `type_required` | ALL must match | `AND` group | `?type_required=images&type_required=mine` → image posts I authored |
| `type_required_any` | ANY must match | `OR` group | `?type_required_any=mine&type_required_any=followed` → my posts OR posts from users I follow |
| `type_boost` | Prefer but don't require | Modifies score | `?type_boost=images` → image posts ranked higher |

**Validation**: A key cannot appear in both `type_required` and `type_required_any` simultaneously. The backend raises `ValueError` if this overlap is detected.

**Available post type keys:**

| Key | Predicate | Description |
|---|---|---|
| `mine` | `p.author_id = :uid` | Posts authored by the current user |
| `followed` | `f_out.id IS NOT NULL` | Posts from users the viewer follows |
| `followers` | `f_in.id IS NOT NULL` | Posts from users who follow the viewer |
| `public` | `NOT (mine OR followed OR followers)` | Posts from unrelated users |
| `images` | `p.image_url IS NOT NULL OR has post_images rows` | Posts containing at least one image |

### PredicateGroup Engine (Backend)

Defined in `apps/api/app/services/feed_service_v2.py`:

```python
@dataclass
class PredicateGroup:
    operator: str      # 'AND' or 'OR'
    predicates: List[str]

def build_grouped_predicate_clause(groups: List[PredicateGroup]) -> str:
    # Groups combine with AND.
    # Within each group, predicates combine with the group's operator.
    # Empty groups are skipped.
```

`_build_filter_clauses(filter_spec, dialect)` constructs `PredicateGroup` instances:

```
type_required → PredicateGroup(operator='AND', predicates=[...])
type_required_any → PredicateGroup(operator='OR', predicates=[...])
type_boost → separate CTE (DIVERSITY_BONUS_PER_TYPE)
```

The resulting SQL fragment is injected into the main scoring CTE's `WHERE` clause:

```sql
WHERE p.visibility = 'public'
  AND (mine_predicate AND images_predicate)    -- type_required AND group
  AND (mine_predicate OR followed_predicate)   -- type_required_any OR group
```

### Date, Author, and Keyword Filters

These are folded into the same `_build_filter_clauses` predicate system:

| Filter | Query Params | Behavior |
|---|---|---|
| Date range | `date_mode`, `date_start`, `date_end` | `required` → added to `type_required` (AND group); `boost` → added to `type_boost` |
| Author | `author_mode`, `author_ids` | `required` → added to `type_required`; `boost` → added to `type_boost` |
| Keyword | `keyword_mode`, `keyword` | `required` → AND group; `boost` → boost group. PostgreSQL uses `to_tsvector`/`plainto_tsquery`; SQLite falls back to `LIKE` |

### Frontend Filter State

**File**: `apps/web/src/utils/feedFilterState.ts`

The frontend manages filter state via the `AppliedFeedFilters` type:

```typescript
interface AppliedFeedFilters {
  date: DateFeedFilters       // mode, localRange, preset
  type: Record<TypeFilterKey, FeedFilterMode>  // per-key on/off/boost
  search: SearchFeedFilters   // authors + keyword
}
```

**URL ↔ State functions:**

| Function | Purpose |
|---|---|
| `parseFeedFiltersFromSearchParams(params)` | Deserializes URL params into `AppliedFeedFilters` |
| `serializeFeedFiltersToUrl(filters)` | Serializes state back to URL search string |

**AND/OR key routing:**
- Keys in `TYPE_FILTER_AND_KEYS` (`['images']`) serialize to `type_required`
- Keys in `TYPE_FILTER_OR_KEYS` (`['mine', 'followed', 'followers', 'public']`) serialize to `type_required_any`

### API Proxy Parameter Forwarding

**File**: `apps/web/src/app/api/posts/route.ts`

The Next.js API proxy forwards filter params to the backend using two registries:

```typescript
// Defined in apps/web/src/utils/feedFilterState.ts
export const FEED_FILTER_MULTI_PARAMS = [
  'type_required', 'type_required_any', 'type_boost', 'author_ids'
]
export const FEED_FILTER_SINGLE_PARAMS = [
  'date_mode', 'date_start', 'date_end',
  'author_mode', 'keyword_mode', 'keyword'
]
```

The proxy iterates these arrays rather than hardcoding param names. Any new filter parameter needs only to be added to one of these registry arrays—no changes to `route.ts` are required.

### Interaction With Scoring

- **Required filters** (`type_required`, `type_required_any`, date/author/keyword in `required` mode) constrain the candidate set before scoring. Non-matching posts are excluded entirely.
- **Boost filters** (`type_boost`, date/author/keyword in `boost` mode) add `DIVERSITY_BONUS_PER_TYPE` points per matched category, up to `DIVERSITY_BONUS_MAX_TYPES`. Boosted posts remain in the feed even if they match zero boost categories—their score is simply lower.
- Filters compose: a post can simultaneously match a `type_required` AND condition, one of several `type_required_any` OR conditions, and multiple `type_boost` categories.

--- 

## CTE Optimizations (June 2026)

### emoji_reactions Aggregate CTE

The `emoji_reactions` table was queried via **16 correlated subqueries** per post row in the `scored` CTE:
- 12 × `COUNT(DISTINCT user_id)` 
- 4 × `COUNT(DISTINCT emoji_code)`

Each subquery performed an independent scan of `emoji_reactions` filtered by `post_id = p.id AND object_type = 'post'`.

**Optimization**: A single `reaction_agg` CTE replaces all 16 subqueries:

```sql
reaction_agg AS (
  SELECT post_id,
         COUNT(DISTINCT user_id) AS reactions_distinct_users,
         COUNT(DISTINCT emoji_code) AS reactions_distinct_codes
  FROM emoji_reactions
  WHERE object_type = 'post'
  GROUP BY post_id
)
```

The CTE is `LEFT JOIN`ed once per row. All 16 subqueries are replaced with `COALESCE(ra.reactions_distinct_users, 0)` / `COALESCE(ra.reactions_distinct_codes, 0)`.

Applied to both `_build_pg_query` and `_build_sqlite_query` in `feed_service_v2.py`.

---

## System Removals (Legacy)

The following systems were **removed** during the March 2026 refactor and should not be reintroduced:
- `AlgorithmService` / `OptimizedAlgorithmService`: Python-based scoring is deprecated.
- `BatchPreferenceService`: Preference-based re-ranking is handled by SQL.
- `post_type`: The gratitude/photo/meditation type system is removed in favor of a unified post model.
- **Read-Status Tracking**: Engagement is now the primary signal for "read" or "interacted" state.
- **Hearts/Likes System**: Separate hearts system removed in favor of unified reactions.
- **Offset Pagination**: Removed to prevent item skipping during high-frequency posting.
