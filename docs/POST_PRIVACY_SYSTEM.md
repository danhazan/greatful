# Post Privacy System

## Scope
This document describes the implemented post-level privacy architecture for Grateful.

It covers:
- privacy levels and rule types
- database schema
- feed visibility query design
- API contract behavior
- frontend privacy UX
- extension guidelines

## Audit Findings (Previous State)
Before implementation, privacy behavior was partially represented but not enforced consistently:

- `posts.is_public` was the only persisted visibility control.
- feed services (`AlgorithmService`, `OptimizedAlgorithmService`) filtered only with `Post.is_public == True`.
- `GET /api/v1/posts/{post_id}` only allowed non-authors when `is_public = true`, so custom audience logic did not exist.
- no privacy rule tables existed for extensible custom audience rules.
- `docs/PRIVACY_CONTROLS_DESIGN.md` proposed profile-level + post-level privacy, but that design was not wired in models/routes/queries.
- message-share and user-search UI had reusable search primitives, but no reusable multi-user selector for privacy configuration.

## Implemented Privacy Model
Each post now has one privacy level:

- `public`
- `private`
- `custom`

Custom privacy supports multiple rules simultaneously:

- `followers`
- `following`
- `specific_users`

Definitions:

- `followers`: viewer follows author
- `following`: author follows viewer
- `specific_users`: viewer is explicitly listed for that post

## Database Schema

### Posts
`posts` now includes:

- `privacy_level VARCHAR(20) NOT NULL DEFAULT 'public'`

Backward compatibility:

- `is_public` is still maintained (`privacy_level == 'public'`) to preserve existing contracts and legacy code paths.

### New Tables

`post_privacy_rules`
- `id`
- `post_id` (FK posts, cascade delete)
- `rule_type`
- `created_at`
- unique: `(post_id, rule_type)`

`post_privacy_users`
- `id`
- `post_id` (FK posts, cascade delete)
- `user_id` (FK users, cascade delete)
- `created_at`
- unique: `(post_id, user_id)`

### Indexes
Added for feed/visibility performance:

- `idx_posts_privacy_created_at (privacy_level, created_at)`
- `idx_posts_author_created_at (author_id, created_at)`
- `idx_follows_follower_followed_status (follower_id, followed_id, status)`
- `idx_follows_followed_follower_status (followed_id, follower_id, status)`
- `idx_post_privacy_rules_post_rule (post_id, rule_type)`
- `idx_post_privacy_users_post_user (post_id, user_id)`
- `idx_post_privacy_users_user_post (user_id, post_id)`

## Visibility Evaluation
Shared logic lives in `PostPrivacyService.visible_to_user_clause(viewer_id)`.

Visibility condition:

- author can always view own post
- public posts are visible to everyone
- custom posts are visible when at least one custom rule matches:
  - `followers` rule enabled AND viewer follows author
  - `following` rule enabled AND author follows viewer
  - viewer exists in `post_privacy_users`

Private posts are author-only by default.

## Feed Query Design
Feed services now apply visibility directly in SQL clauses (not precomputed viewer tables):

- `AlgorithmService`
- `OptimizedAlgorithmService`

Candidate selection and counts use:

- `WHERE <visible_to_user_clause(viewer_id)>`
- ordered by `posts.created_at DESC`, then in-memory scoring

This avoids:

- precomputed `post_visibility(post_id, viewer_id)` explosion
- large `author_id IN (...)` lists

and keeps joins/index paths predictable using `follows` and privacy tables.

## API Behavior

### Create Post
Post creation now accepts:

```json
{
  "content": "...",
  "privacy_level": "custom",
  "rules": ["followers", "following"],
  "specific_users": [12, 34]
}
```

Also supported for multipart form uploads via:

- `privacy_level`
- `rules` (JSON array string)
- `specific_users` (JSON array string)

Backward compatibility:

- legacy `is_public` still accepted; it maps to privacy level when `privacy_level` is not provided.

### Post Fetch
- visibility checks are enforced through `PostPrivacyService`.
- own post fetch returns privacy configuration (`privacy_level`, `privacy_rules`, `specific_users`).
- non-authors do not receive internal custom rule lists.

### Own Posts Endpoint
`GET /api/v1/users/me/posts` now includes privacy configuration for each post.

### Read Status
`POST /api/v1/posts/read-status` validates post IDs against visibility rules (not just public posts).

## Frontend Implementation

### Create Post Modal
Added a privacy selector in header row (right side):

- Public
- Custom
- Private

Displayed labels:

- `🌍 Public`
- `🔒 Private`
- `👥 <audience summary>`

For custom privacy, the selector shows audience summary (not generic “Custom”), e.g.:

- `Followers`
- `Followers + 2 specific users`
- `Only specific users (3)`

### Custom Privacy Modal
Selecting `Custom` opens a configuration modal with toggles:

- Followers
- Following
- Specific Users

Specific users are selected with async user search + chips.

### Shared User Selector
A reusable `UserMultiSelect` component was introduced and wired to shared user-search primitives:

- `useUserSearch`
- `UserSearchDropdown`
- `UserSearchResultItem`

This same component is now also used in Share-as-Message flow to avoid duplicate search/chip UI logic.

## Extensibility Guide
To add a new rule type (example: `verified_users`):

1. add rule identifier in `PostPrivacyService.SUPPORTED_RULES`
2. add SQL visibility branch in `visible_to_user_clause`
3. add frontend toggle in custom privacy modal (if user-facing)

No schema changes are required for new rule toggles because rules are data-driven in `post_privacy_rules`.

