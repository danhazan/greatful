# System Contract Map

## Overview

This document defines the system-wide guarantees for the Grateful application. It maps the critical end-to-end flows across frontend and backend, establishing ownership, invariants, and contract expectations.

This is a **system architecture document** — not a test coverage map. Tests serve as supporting evidence for guarantees that must hold regardless of test execution.

---

## Layer Mapping Reference

| Frontend Layer | Backend Layer | Description |
|----------------|---------------|-------------|
| @flow | @contract | Full end-to-end user journeys |
| @interaction | Integration Tests | API endpoint behavior |
| @behavior | Response Validation | Output correctness |
| @unit | Service/Repository Logic | Isolated business logic |

---

## Cross-System Rules

### 1. Data Format Contract
- **Backend → Frontend**: All API responses use `snake_case` for field names
- **Frontend → Backend**: All API requests use `snake_case` for field names
- **Transformation**: Frontend MUST transform snake_case → camelCase for internal use
- **Exception**: Notification data fields may arrive in either format (defensive handling in `notificationMapping.ts`)

### 2. Username Contract
- Backend sends `*_username` fields in snake_case (e.g., `reactor_username`)
- Frontend transformers convert to camelCase (e.g., `reactorUsername`)
- Notification resolver accepts both formats via `notificationMapping.ts` backward compatibility
- Only canonical fields: `username`, `displayName`, type-specific `*Username` (e.g., `followerUsername`)

### 3. Authentication Contract
- JWT tokens stored in HTTP-only cookies
- Token validation happens at API gateway level
- Frontend receives authenticated state via UserContext
- Backend validates token on every protected request

### 3. Real-time Contract
- Reactions update via explicit API calls (no WebSocket)
- Feed updates on page refresh or navigation
- Notifications polling interval: intelligent (adapts to user activity)

### 4. Privacy Contract
- Post visibility: `public`, `followers`, `private`
- Private posts only visible to author
- Follower posts only visible to followers
- Private users' posts not visible in public feed

---

## Critical System Flows

---

### Flow 1: Follow User

#### User Guarantee
When a user clicks "Follow" on another user's profile, the system MUST:
1. Create a follow relationship in the database
2. Generate a notification for the followed user
3. Update the follower's following count
4. Update the followed user's follower count
5. Reflect the new state immediately in the UI

#### Backend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Relationship persistence | `Follow` table with `follower_id`, `followed_id`, `is_active`, timestamps |
| Notification generation | `FollowService` creates `Notification` record with type `follow` |
| Count updates | Atomic increments on both users' `following_count`/`follower_count` |
| Idempotency | Duplicate follows return 409 Conflict, not duplicate records |
| Self-follow prevention | Validation rejects follow where `follower_id == followed_id` |

**API Endpoints:**
- `POST /api/v1/follows/{user_id}` — Create follow relationship
- `DELETE /api/v1/follows/{user_id}` — Remove follow relationship

#### Frontend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Button state reflects backend state | `FollowButton` shows "Follow" or "Following" based on state |
| Click triggers API call | `toggleFollow()` invokes API |
| Error handling | User sees error toast on failure, can retry |
| Accessibility | Button has proper ARIA labels and keyboard support |

**Component:** `FollowButton`
**State Management:** `useUserState` hook with caching

#### System Invariants
1. **Follow count consistency**: `user.following_count` = count of active Follow records where `follower_id = user.id`
2. **Notification causality**: Every follow action MUST generate exactly one notification for the followed user
3. **No orphaned follows**: Deleting a user MUST cascade-delete their Follow records

---

### Flow 2: Post Creation

#### User Guarantee
When a user creates a gratitude post, the system MUST:
1. Persist the post to the database
2. Return the created post with server-generated ID and timestamp
3. Display the post in the user's feed immediately
4. Apply visibility rules correctly

#### Backend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Post persistence | `Post` table with `author_id`, `content`, `visibility`, timestamps |
| ID generation | UUID or auto-increment ID assigned on insert |
| Content validation | Max length enforced (5000 chars), sanitization applied |
| Visibility enforcement | Query filters applied based on `visibility` field |

**API Endpoints:**
- `POST /api/v1/posts` — Create post
- `GET /api/v1/posts/{id}` — Fetch single post
- `PUT /api/v1/posts/{id}` — Update post
- `DELETE /api/v1/posts/{id}` — Delete post (author only)

#### Frontend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Form validation | Content length validation, required field checks |
| Optimistic updates | Post appears immediately, rolls back on error |
| Error display | User sees error message if creation fails |
| Accessibility | Form inputs have proper labels, keyboard navigable |

**Component:** `CreatePostModal`
**State Management:** React Query for mutation + cache invalidation

#### System Invariants
1. **Author binding**: Every post MUST have exactly one author (non-null `author_id`)
2. **Visibility persistence**: Post visibility set at creation cannot be changed by non-authors
3. **Content integrity**: Post content stored exactly as entered (no lossy transformation)

---

### Flow 3: Reaction System

#### User Guarantee
When a user reacts to a post (heart, fire, etc.), the system MUST:
1. Add or update the reaction in the database
2. Update the post's reaction count
3. Generate a notification for the post author (if not self)
4. Reflect the reaction immediately in the UI
5. Allow changing reactions (add different, remove existing)

#### Backend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Reaction persistence | `EmojiReaction` table with `user_id`, `post_id`, `emoji_code` |
| Unique constraint | One reaction per user per post (upsert behavior) |
| Count aggregation | Derived from reaction records, not stored field |
| Self-reaction | Allowed, but no notification generated |

**API Endpoints:**
- `POST /api/v1/posts/{post_id}/reactions` — Add/update reaction
- `DELETE /api/v1/posts/{post_id}/reactions` — Remove reaction

#### Frontend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Emoji picker display | All 56 emojis available in picker |
| Visual feedback | Selected reaction highlighted on post |
| Count display | Shows total reaction count |
| Multiple reactions | Shows list of reaction types (heart, fire, etc.) |

**Component:** `EmojiPicker`, `ReactionViewer`
**Data:** PostCard receives `currentUserReaction`, `reactionEmojiCodes` from API

#### System Invariants
1. **Reaction uniqueness**: At most one `EmojiReaction` per `(user_id, post_id, object_type, object_id)` tuple
2. **Notification threshold**: Notification generated only when `reactor_id != author_id`
3. **Count accuracy**: Post's reaction count = count of EmojiReaction records for that post
4. **Polymorphic scope**: Image reactions (`object_type=image`) do NOT inflate post-level reaction counts

---

### Flow 4: Notification System

#### User Guarantee
When relevant actions occur (follow, reaction, comment, mention), the user MUST:
1. Receive a notification in their notification list
2. See notification type, message, and timestamp
3. Navigate to the relevant content by clicking
4. Have notifications persist across sessions

#### Backend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Notification creation | `Notification` table with `user_id`, `type`, `message`, `post_id`, `from_user_id` |
| Batching | Similar notifications batched within time window |
| Read status | `read` boolean field, default false |
| TTL | Old notifications cleaned up after 30 days |

**API Endpoints:**
- `GET /api/v1/notifications` — List notifications
- `PUT /api/v1/notifications/{id}/read` — Mark as read
- `PUT /api/v1/notifications/read-all` — Mark all as read

#### Frontend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Real-time-ish updates | Polling for new notifications |
| Read count badge | Shows unread count in navbar |
| Grouping | Batched notifications shown as summary |
| Navigation | Click navigates to relevant post/profile |

**Component:** `NotificationSystem`
**State Management:** Polling with smart intervals

#### System Invariants
1. **Notification causality**: Every reaction/follow/comment MUST generate notification for affected user (unless self-action)
2. **Read consistency**: Read status synchronized between API and UI
3. **No lost notifications**: Notification created in same transaction as triggering action

---

### Flow 5: Authentication

#### User Guarantee
When a user logs in, the system MUST:
1. Validate credentials (password or OAuth)
2. Create a session with JWT token
3. Redirect to feed with authenticated state
4. Persist session across browser sessions

#### Backend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Credential validation | Password hashing via bcrypt, OAuth validation |
| Token generation | JWT with user ID claim, expiration |
| Token refresh | Refresh token endpoint |
| Logout | Token invalidation (client-side cookie removal) |

**API Endpoints:**
- `POST /api/v1/auth/signup` — Create account
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/logout` — Logout
- `POST /api/v1/auth/refresh` — Refresh token

#### Frontend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Login form validation | Email format, password requirements |
| OAuth buttons | Google, Facebook login buttons functional |
| Session persistence | Token stored in cookies, survives refresh |
| Logout | Clears token, redirects to home |

**Component:** `OAuthButton`, login forms
**State Management:** UserContext provides auth state globally

#### System Invariants
1. **Token validity**: JWT must be validated on every protected API request
2. **Password security**: Passwords never stored in plaintext, only hashed
3. **OAuth trust**: OAuth providers trusted for identity, no local password for OAuth users

---

### Flow 6: Feed Rendering

#### User Guarantee
When a user views their feed, the system MUST:
1. Return posts from followed users and public posts
2. Order by recency with engagement boost
3. Apply visibility filters (no private posts from non-followers)
4. Paginate results (cursor-based)
5. Include reaction counts and current user's reactions

#### Backend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Post retrieval | `FeedServiceV2` with scoring algorithm |
| Visibility filtering | SQL query excludes private posts from non-authors |
| Ordering | Score-based: `(recency_score * 0.7) + (engagement_score * 0.3)` |
| Pagination | Cursor-based, 20 posts per page |
| Author spacing | Prevent single author from dominating feed |

**API Endpoints:**
- `GET /api/v1/posts/feed` — Main feed
- `GET /api/v1/posts/feed?type=following` — Following-only feed

#### Frontend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Infinite scroll | Loads more posts on scroll |
| Loading states | Skeleton loaders during fetch |
| Empty state | "No posts yet" message when feed empty |
| Error handling | Error message + retry button on failure |

**Page:** `feed/page.tsx`
**Component:** `PostCard` rendered in list

#### System Invariants
1. **No private leakage**: Private posts never appear in other users' feeds
2. **Score determinism**: Same query parameters always return same ordering (within pagination window)
3. **Author diversity**: Maximum 50% of visible posts from single author

---

### Flow 7: Share System

#### User Guarantee
When a user shares a post, the system MUST:
1. Create a share record linking original post to sharer
2. Generate a notification for the original post author
3. Allow sharing to appear in sharer's profile
4. Maintain link to original post

#### Backend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Share record | `Share` table with `original_post_id`, `shared_by_user_id`, timestamps |
| Notification | `Notification` type `share` created for post author |
| Visibility | Shared posts inherit or respect original's visibility |

**API Endpoints:**
- `POST /api/v1/posts/{post_id}/share` — Create share

#### Frontend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Share button | Visible on PostCard |
| Share modal | Preview of share, optional message |
| Success feedback | Toast confirmation on successful share |

**Component:** `ShareModal`, share button in PostCard

#### System Invariants
1. **Share chain integrity**: Original post deletable even if shared (share record remains, links broken gracefully)
2. **Notification uniqueness**: One notification per share (not per share view)

---

### Flow 8: Image Reactions

#### User Guarantee
When a user reacts to an individual image inside a multi-image post, the system MUST:
1. Record the reaction scoped to that specific image (`object_type=image`, `object_id=<imageId>`)
2. Show the updated reaction count on the image immediately (optimistic update)
3. NOT affect the post-level reaction count
4. Synchronize the reacted state across all views (feed card, gallery modal, reaction viewer)
5. Retry automatically on transient network failure and show a manual retry prompt after 3 attempts

#### Backend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Polymorphic scope | `EmojiReaction.object_type` + `object_id` columns on existing table |
| Unique constraint | One reaction per `(user_id, post_id, object_type, object_id)` |
| Batched retrieval | `GET /api/posts/{postId}/image-reactions` returns all images in one call |
| No post count pollution | Image reactions excluded from `reactions_count` aggregation |

**API Endpoints:**
- `POST /api/v1/posts/{post_id}/reactions` with `object_type=image`, `object_id=<imageId>` — Add reaction
- `DELETE /api/v1/posts/{post_id}/reactions?object_type=image&object_id=<imageId>` — Remove reaction
- `GET /api/posts/{post_id}/image-reactions` — Batched summary for all images in post

#### Frontend Guarantees
| Guarantee | Implementation |
|-----------|---------------|
| Optimistic update | `useReactionMutation` updates cache synchronously before network call |
| Race-condition safety | Cache versioning (`version` counter) prevents stale overwrites |
| Retry on failure | Exponential backoff (1s, 2s, 4s), max 3 attempts via `useImageReactions` |
| Manual recovery | "Sync Error. Tap to retry" shown after retry exhaustion |
| Cross-view sync | Global subscriber cache ensures feed card + gallery always agree |
| Ghost request prevention | Retry timers cleared on unmount and manual refetch |

**Hooks:** `useImageReactions`, `useReactionMutation`
**Components:** `MultiImageModal`, `ReactionViewer`, `EmojiPicker`
**Config:** `src/config/reactions.ts`

#### System Invariants
1. **Domain isolation**: Image reactions MUST NOT appear in post-level reaction queries unless `object_type=image` is specified
2. **Cache consistency**: `updateImageReactionsCache` is the only write path; direct state mutation is forbidden
3. **Stale guard**: A scheduled retry MUST be a no-op if the cache status is no longer `error` with the same `retryCount`
4. **Timer lifecycle**: All `pendingRetryTimeouts` for a `postId` MUST be cleared when the last subscriber unmounts

---

## System-Wide Invariants

These invariants MUST hold across all flows:

| Invariant | Description |
|-----------|-------------|
| **Data consistency** | Database transactions are atomic; no partial state |
| **Authentication** | All protected endpoints validate JWT before processing |
| **Authorization** | Users can only modify their own resources |
| **Privacy** | Visibility filters applied at database query level |
| **No data loss** | Deletion cascades configured correctly; no orphaned records |
| **API contract** | Response schemas stable; breaking changes require version bump |

---

## Final System Guarantee Statement

> **The Grateful system guarantees that user actions are persisted correctly, notifications are generated for all relevant events, privacy boundaries are enforced at the database level, and authentication state is consistent across all requests.**

This guarantee holds regardless of:
- Test execution status
- Frontend load conditions
- Network latency variations
- Browser differences

The system is designed to fail safely (return errors) rather than produce incorrect state.

---

## Supporting Test Evidence

The following tests provide verification evidence for these guarantees. They are NOT the guarantees themselves — they are runtime assertions that the guarantees hold.

### Frontend @flow Tests
| Flow | Test File | Purpose |
|------|-----------|---------|
| Follow | `FollowButton.flow.test.tsx` | Button click → state update |
| Post | `PostCard.flow.test.tsx` | Post rendering, reactions |
| Notifications | `NotificationSystem.flow.test.tsx` | Display, read status |
| Auth | `OAuthButton.flow.test.tsx` | OAuth button interaction |
| Feed | `feed.flow.test.tsx` | Feed rendering |

### Backend Integration Tests
| Flow | Test File | Purpose |
|------|-----------|---------|
| Follow | `test_follow_api.py` | Follow API endpoints |
| Follow + Notify | `test_follow_notifications.py` | Follow → notification |
| Post | `test_posts_api.py` | CRUD operations |
| Reactions | `test_reactions_api.py` | Reaction add/remove |
| Image Reactions | `test_image_reactions_api.py` | Polymorphic reaction add/remove/batch |
| Notifications | `test_notifications_api.py` | List, read status |
| Auth | `test_oauth_endpoints.py` | OAuth flows |
| Feed | `test_feed_v2.py` | Feed generation |
| Share | `test_share_api.py` | Share creation |

---

*Document Version: 1.1*
*Last Updated: Phase 16 — Polymorphic Reaction System & Image Reactions*
*Classification: System Architecture — Not Test Coverage*