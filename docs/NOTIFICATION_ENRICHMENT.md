# Notification Enrichment Architecture Design

> **Status**: Design Document Only — Not Implemented
>
> This document defines how notification enrichment should evolve when additional use cases appear. The current implementation works and is production-ready. This design prevents premature abstraction while avoiding future fragmentation.

---

## 1. Current State Summary

### Where Enrichment Currently Happens

Image thumbnail enrichment lives in `ReactionService`:

```
apps/api/app/services/reaction_service.py
├── _get_image_thumbnail_url()      # Resolves image thumbnail URL
└── add_reaction()                   # Calls enrichment before notification
```

The notification pipeline flows through:

```
ReactionService → NotificationFactory → PostInteractionBatcher → Notification (DB)
```

### What Enrichment Exists

Currently, only **image thumbnail enrichment** exists:

- `object_type == "image"` reactions resolve `thumbnail_url` from `PostImage` model
- `thumbnail_url` is serialized to a full URL via `serialize_image_url()`
- `thumbnail_type: "image"` flag is added to notification data

### Why It Lives in ReactionService

The current implementation was built as part of the image reaction feature:

1. `ReactionService` already validates the image exists and belongs to the post
2. The image ID is already available in the reaction flow
3. Adding enrichment there required minimal changes
4. It works correctly and has full test coverage

---

## 2. Identified Limitation

### Why Current Approach Will Not Scale

The current approach embeds enrichment logic in service-specific code. When new notification types need similar enrichment, this creates problems:

| Future Use Case | Required Enrichment | Current Solution |
|----------------|-------------------|------------------|
| Comment notifications | Post preview thumbnail | Would need new logic in CommentService |
| Share notifications | Shared post thumbnail | Would need new logic in ShareService |
| Mention notifications | Post/comment context | Would need new logic in MentionService |
| Reaction on comment | Comment preview text | Would need new logic in ReactionService |

**The pattern**: Every notification type that needs object metadata would embed similar resolution logic in its service.

**The risk**: Fragmented enrichment logic across multiple services, inconsistent handling, and duplicated DB queries.

---

## 3. Proposed Future Architecture

### NotificationEnrichmentService

A centralized service responsible for resolving object metadata for notifications.

#### Responsibilities

1. **Resolve object metadata** — Given an object type and ID, fetch and return relevant display metadata
2. **Attach optional display metadata** — Add thumbnails, preview text, titles to notification context
3. **Remain stateless** — No internal state, pure resolution functions
4. **Be reusable** — Pluggable architecture that any notification type can use

#### Input / Output

```python
# Input: EnrichmentRequest
class EnrichmentRequest:
    object_type: str          # "image", "post", "comment", etc.
    object_id: str            # ID of the object
    context: dict             # Additional context (post_id, etc.)

# Output: EnrichmentContext
class EnrichmentContext:
    thumbnail_url: Optional[str]    # For display thumbnails
    preview_text: Optional[str]     # For comment/post previews
    target_title: Optional[str]     # For context titles
    metadata: dict                   # Extensible additional data
```

#### Example Resolvers

```python
# Resolver interface (conceptual)
class MetadataResolver:
    async def resolve(self, request: EnrichmentRequest) -> Optional[EnrichmentContext]:
        ...

# Image resolver (returns thumbnail)
class ImageMetadataResolver(MetadataResolver):
    async def resolve(self, request: EnrichmentRequest) -> Optional[EnrichmentContext]:
        image = await self.db.get(PostImage, request.object_id)
        if image:
            return EnrichmentContext(
                thumbnail_url=serialize_image_url(image.thumbnail_url),
                metadata={"width": image.width, "height": image.height}
            )
        return None

# Comment resolver (returns preview)
class CommentMetadataResolver(MetadataResolver):
    async def resolve(self, request: EnrichmentRequest) -> Optional[EnrichmentContext]:
        comment = await self.db.get(Comment, request.object_id)
        if comment:
            return EnrichmentContext(
                preview_text=comment.content[:100],  # Truncated preview
                metadata={"post_id": comment.post_id}
            )
        return None
```

---

## 4. Integration Strategy

### Option A: Caller → EnrichmentService → Factory → Batcher

```
ReactionService
    │
    ├─→ NotificationEnrichmentService.resolve(request)
    │       │
    │       └─→ returns EnrichmentContext
    │
    └─→ NotificationFactory.create_reaction_notification(
            ..., enrichment_context=context
        )
            │
            └─→ PostInteractionBatcher.create_interaction_notification(
                    target_data={...enrichment_context...}
                )
```

**Tradeoffs**:
- Service (ReactionService) needs to be aware of enrichment
- More control at caller level
- Suitable when caller already has object context

### Option B: Factory → EnrichmentService → Batcher

```
ReactionService
    │
    └─→ NotificationFactory.create_reaction_notification(
            object_type="image",
            object_id="..."
        )
            │
            ├─→ NotificationEnrichmentService.resolve(request)
            │
            └─→ PostInteractionBatcher.create_interaction_notification(
                    target_data={...enriched...}
                )
```

**Tradeoffs**:
- Factory handles all enrichment orchestration
- Callers remain simpler
- Suitable when enrichment is always needed for certain types

### Decision

**Defer this choice** — The optimal integration depends on the first new notification type that requires enrichment. The design supports both patterns.

---

## 5. Migration Plan

### Step 1: Introduce Service Alongside Existing Logic

- Create `app/services/notification_enrichment_service.py`
- Implement base class and `ImageMetadataResolver`
- **Do NOT modify ReactionService yet** — keep existing logic
- Purpose: Prove the service works in isolation

### Step 2: Move One Enrichment (Image) Into Service

- Refactor `ReactionService._get_image_thumbnail_url()` to call `EnrichmentService`
- Run existing tests — must pass without changes to behavior
- Keep the old method as a fallback during transition
- Purpose: Validate migration without breaking anything

### Step 3: Remove Old Logic

- After Step 2 tests pass, remove fallback code
- Delete `ReactionService._get_image_thumbnail_url()`
- Purpose: Complete migration

### Step 4: Expand to New Notification Types

- When new notification types need enrichment (e.g., comments), add new resolvers
- Follow the same pattern: test alongside, migrate, remove old
- Purpose: Reusable infrastructure for future

---

## 6. Trigger Conditions

This abstraction should only be implemented when the following conditions are met:

### Primary Triggers

1. **Second notification type requires enrichment**
   - Example: Comment notifications need post preview thumbnails
   - Rationale: One-off enrichment in one service is acceptable; duplication is not

2. **Duplicate enrichment logic appears**
   - Example: Two different services resolve the same object type differently
   - Rationale: Code duplication signals the need for abstraction

### Secondary Triggers (Consider)

3. **More than one service starts resolving metadata**
   - Example: ReactionService, CommentService, ShareService all query PostImage
   - Rationale: Suggests a shared utility would reduce duplication

4. **Enrichment complexity increases**
   - Example: Need caching, batch fetching, or fallback chains
   - Rationale: Service abstraction provides better organization for complex logic

### When NOT to Implement

- ❌ "Just in case" — Premature abstraction
- ❌ Single notification type works fine
- ❌ No visible duplication yet
- ❌ Current approach is understandable and maintainable

---

## 7. Non-Goals

This design explicitly does NOT include:

| Non-Goal | Reason |
|----------|--------|
| **No changes to batching** | Batch logic is orthogonal to enrichment. Batcher receives data, doesn't care how it was enriched. |
| **No frontend contract changes** | The notification payload structure remains the same. Only the internal path to build it changes. |
| **No event system yet** | This is purely about synchronous enrichment during notification creation, not async event handling. |
| **No real-time updates** | Enrichment is about notification payload content, not delivery mechanism. |
| **No notification templates** | This design is about data enrichment, not message formatting. |

---

## 8. Design Principles

### 8.1 Single Source of Truth

Each enrichment field must have exactly one authoritative resolver.

**Example**:
- `thumbnail_url` → resolved ONLY by `ImageMetadataResolver`
- No fallback logic scattered across services

**Why this matters**:
- Prevents future drift where different features use different thumbnail logic
- Prevents inconsistent rendering bugs from diverging implementations
- Makes debugging straightforward: if thumbnail is wrong, check the resolver

**Anti-pattern to avoid**:
```python
# BAD: Multiple paths to same data
class ReactionService:
    def get_thumbnail(self):
        if image:
            return self._get_from_postimage()  # One path

class CommentService:
    def get_thumbnail(self):
        if image:
            return self._get_from_posts_table()  # Another path! 💀
```

---

### 8.2 No Double Fetch Guarantee

Enrichment must not introduce duplicate database lookups for the same object within a single notification flow.

**Rule**:
```python
# If caller already fetched object → pass it to enrichment service
# Otherwise → resolver fetches it
# NEVER both
```

**Example**:
```python
# Caller already has the image object
image = await post_repo.get_image(image_id)
enrichment_request = EnrichmentRequest(
    object_type="image",
    object_id=image_id,
    context={"prefetched_image": image}  # Pass it along
)
```

**Why this matters**:
- Prevents N+1 query patterns in batch notification creation
- Ensures consistent data within a single request cycle
- Critical when handling burst reaction scenarios

---

### 8.3 Data Ownership Rule

Clear boundaries between what each layer owns:

| Layer | Owns | Does NOT Own |
|-------|------|--------------|
| **ReactionService** | Reaction semantics (create, update, delete) | Display metadata |
| **NotificationEnrichmentService** | Display metadata (thumbnails, previews) | Business logic |
| **PostInteractionBatcher** | Aggregation and formatting | Object resolution |

**What this prevents**:
- Enrichment service deciding business logic (e.g., "should this notification exist?")
- Services leaking UI concerns into data layer
- Scope creep where enrichment starts validating rules

**Anti-pattern to avoid**:
```python
# BAD: Enrichment making business decisions
class ImageMetadataResolver:
    async def resolve(self, request):
        # Enrichment checking if user should see thumbnail? 💀
        if not user.has_permission(request.object_id):
            return None
```

---

## 9. Testing Strategy

### Unit Tests Per Resolver

Each resolver must have dedicated unit tests:

```python
class TestImageMetadataResolver:
    async def test_returns_thumbnail_for_valid_image(self):
        request = EnrichmentRequest(object_type="image", object_id="img-123")
        context = await resolver.resolve(request)
        assert context.thumbnail_url == "https://..."

    async def test_returns_none_for_missing_image(self):
        request = EnrichmentRequest(object_type="image", object_id="missing")
        context = await resolver.resolve(request)
        assert context is None

    async def test_respects_prefetched_object(self):
        # No additional DB query when object passed in context
        request = EnrichmentRequest(object_type="image", object_id="img-123",
                                     context={"prefetched_image": image})
        # Verify no query executed
```

### Integration Tests Per Notification Type

Test end-to-end enrichment for each notification type:

```python
async def test_image_reaction_notification_includes_thumbnail(db):
    # User reacts to image
    reaction = await add_reaction(post_id="post-1", object_type="image",
                                  object_id="img-1", emoji_code="heart_eyes")

    # Notification should have thumbnail
    notification = await get_notification(user_id=post_author_id)
    assert notification.data["thumbnail_url"] == "https://..."
```

### Regression Tests (Critical)

Must have regression coverage for:

1. **Missing metadata fallback**
   ```python
   async def test_image_deleted_after_reaction():
       # Image is deleted between reaction and notification fetch
       # Should gracefully handle, not crash
       notification = await get_notification()
       assert "thumbnail_url" not in notification.data  # Safe omission
   ```

2. **Cross-type contamination**
   ```python
   async def test_post_reaction_never_has_image_metadata():
       # Post reaction should never accidentally include image thumbnail
       reaction = await add_reaction(object_type="post", ...)
       notification = await get_notification()
       assert "thumbnail_url" not in notification.data
   ```

3. **Enrichment isolation**
   ```python
   async def test_multiple_notifications_same_image():
       # Two reactions to same image should get same thumbnail
       n1 = await create_notification(image_id="img-1")
       n2 = await create_notification(image_id="img-1")
       assert n1.data["thumbnail_url"] == n2.data["thumbnail_url"]
   ```

---

## 10. Example End-to-End Flow

### Scenario: User Reacts to an Image in a Post

**Flow**:
```
User clicks heart emoji on image →
  useReactionMutation (frontend) →
    POST /api/v1/reactions (body: {object_type: "image", object_id: "img-123"})
      →
        ReactionService.add_reaction(object_type="image", object_id="img-123")
          →
            _resolve_reaction_object_id() → validates image belongs to post
            _get_image_thumbnail_url("img-123") → fetches thumbnail
              →
                Query: SELECT thumbnail_url FROM post_images WHERE id = "img-123"
                Returns: "/uploads/posts/img_thumb.jpg"
              →
                serialize_image_url() → "http://localhost:8000/uploads/posts/img_thumb.jpg"
            →
            NotificationFactory.create_reaction_notification(..., thumbnail_url=...)
              →
                target_data = {object_type: "image", object_id: "img-123",
                               thumbnail_url: "http://localhost:8000/uploads/posts/img_thumb.jpg"}
              →
                PostInteractionBatcher.create_interaction_notification(target_data=...)
                  →
                    notification_data = {object_type: "image", object_type: "image",
                                         thumbnail_type: "image",
                                         thumbnail_url: "http://localhost:8000/uploads/posts/img_thumb.jpg"}
                  →
                    Notification(id="notif-1", data=notification_data) saved to DB
```

### Payload Comparison

**Before Enrichment** (if this were a design alternative):
```json
{
  "type": "emoji_reaction",
  "message": "reacted to an image in your post with 😍",
  "data": {
    "object_type": "image",
    "object_id": "img-123",
    "thumbnail_type": "image"
    // ❌ Missing thumbnail_url - frontend can't display image
  }
}
```

**After Enrichment** (current implementation):
```json
{
  "type": "emoji_reaction",
  "message": "reacted to an image in your post with 😍",
  "data": {
    "object_type": "image",
    "object_id": "img-123",
    "thumbnail_type": "image",
    "thumbnail_url": "http://localhost:8000/uploads/posts/img_thumb.jpg"
    // ✅ Frontend can display the reacted image as notification thumbnail
  }
}
```

---

## 11. Related Documentation

- [FEED_SYSTEM.md](./FEED_SYSTEM.md) — Related notification delivery
- [SYSTEM_CONTRACT_MAP.md](./SYSTEM_CONTRACT_MAP.md) — System contracts including reactions
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — Current known issues

---

## 12. History

| Date | Change |
|------|--------|
| 2026-05-04 | Initial design document created |
| 2026-05-04 | Added: Single Source of Truth, No Double Fetch, Data Ownership principles |
| 2026-05-04 | Added: Testing Strategy with unit, integration, and regression tests |
| 2026-05-04 | Added: End-to-end flow example with before/after payload |
| Status | Not implemented — wait for trigger conditions |

---

## Summary

The current implementation works and is production-ready. This design prevents premature abstraction while providing a clear path forward when the system earns it.

**Guiding Principle**: We design the abstraction now, but only build it when the system needs it.