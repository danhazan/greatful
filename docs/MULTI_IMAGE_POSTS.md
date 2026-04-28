# Multi-Image Post Support

## Overview

Posts can contain up to 7 images with automatic variant generation for optimized display across different contexts.

## Configuration

### Image Limits

| Setting | Backend Env Var | Frontend Env Var | Default |
|---------|-----------------|------------------|---------|
| Max images per post | `MAX_POST_IMAGES` | `NEXT_PUBLIC_MAX_POST_IMAGES` | 7 |

**Important:** The backend configuration is authoritative. Frontend configuration mirrors these values for UX purposes (early validation, UI feedback) but does not override backend validation.

### Image Constraints

| Constraint | Value | Notes |
|------------|-------|-------|
| Max file size | 5MB per image | Validated on frontend and backend |
| Allowed types | JPEG, PNG, WebP | GIF not supported |
| Max images per post | 7 (configurable) | Set via `MAX_POST_IMAGES` env var |

### Image Variants

Each uploaded image is processed into three variants:

| Variant | Width | Purpose |
|---------|-------|---------|
| Thumbnail | 400px | Upload previews, reorder UI, stacked card backgrounds, gallery thumbnails |
| Medium | 1200px | Feed display (primary in stacked preview), gallery navigation |
| Original | 2560px max | Full resolution expand/zoom view |

All variants use JPEG compression at 85% quality for optimal file size vs quality balance.

## Data Model

### Backend: PostImage Model

```python
class PostImage(Base):
    __tablename__ = "post_images"

    id = Column(String, primary_key=True)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"))
    position = Column(Integer, nullable=False, default=0)
    thumbnail_url = Column(String(500), nullable=False)
    medium_url = Column(String(500), nullable=False)
    original_url = Column(String(500), nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### Frontend: PostImage Interface

```typescript
interface PostImage {
  id: string
  position: number
  thumbnailUrl: string
  mediumUrl: string
  originalUrl: string
  width?: number
  height?: number
}
```

## Image Display

### Feed View: Stacked Image Preview

The `StackedImagePreview` component displays multi-image posts in the feed:

- Primary image (position 0) displays using medium variant
- Up to 2 background cards show actual thumbnails with slight rotation/offset
- Image count indicator appears for 2-3 images (dots) or 4+ images (+N badge)
- Click opens fullscreen gallery at the clicked image index

### Fullscreen View: MultiImageModal

The `MultiImageModal` component provides image gallery navigation:

- Displays medium variant for fast gallery navigation
- Swipe gestures (mobile) and arrow keys (desktop) for navigation
- Thumbnail strip for direct navigation to any image
- Pinch-to-zoom and pan support
- Image counter showing current position (e.g., "3 / 7")
- "Expand" button (Maximize2 icon) opens full resolution original variant
- **Image Reaction Button**: Heart/emoji button (top-center) for per-image emoji reactions
- **Reaction Summary Bar**: Bottom-center strip showing aggregate emoji counts; tap to view detailed reactor list
- **Error Recovery UI**: If reaction sync fails, the bar shows a "Sync Error. Tap to retry" prompt

### Full Resolution: ImageModal (Shared)

Both single-image and multi-image posts use the same `ImageModal` component for full resolution viewing:

- Single-image posts: Click image opens ImageModal directly
- Multi-image posts: Click expand button in gallery opens ImageModal with originalUrl
- Full zoom/pan support for detailed viewing
- Scroll wheel zoom and pinch-to-zoom on mobile

---

## Image Reactions

### Overview

Every image within a multi-image post supports independent emoji reactions via a **Polymorphic Reaction System**. Reaction state is tracked per `(postId, imageId)` pair and synchronized across all views (feed, gallery, reaction viewer) using a global reactive cache.

### Architecture

```
PostCard (feed)
  └── StackedImagePreview ──→ MultiImageModal
                                  ├── Top-center: Reaction Button (emoji/heart)
                                  ├── Bottom-center: ReactionSummary strip
                                  └── ReactionViewer modal (full list)
                                        └── EmojiPicker (overlay)
```

#### Scroll Lock Stacking

Nested overlays (MultiImageModal → ReactionViewer → EmojiPicker) are managed by `ScrollLockManager` in `src/utils/scrollLock.ts`. This utility tracks a ref count so the body scroll is only restored when the last overlay closes, regardless of close order.

### Global Cache (`useImageReactions`)

Image reactions are managed by a global, event-driven cache in `src/hooks/useImageReactions.ts`.

**Cache entry shape:**

```typescript
interface CacheEntry {
  data: ImageReactionsMap;   // keyed by imageId
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: Error;
  timestamp: number;
  version: number;           // monotonic counter for race detection
  retryCount: number;
  lastAttemptAt: number;
}
```

**Key guarantees:**
- **Deduplication**: Only one in-flight request per `postId` via `pendingFetches` map.
- **Optimistic update safety**: Versioning (`version`) ensures stale network responses never overwrite local mutations, even if they land within the same millisecond.
- **No ghost requests**: All scheduled retry timers are tracked and canceled on unmount or manual refetch.

### Retry Policy

Configured centrally in `src/config/reactions.ts`:

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_RETRIES` | 3 | Max automatic retry attempts after a failed fetch |
| `RETRY_DELAY_MS` | 1000 | Base delay for first retry (ms) |
| `RETRY_BACKOFF_FACTOR` | 2 | Exponential multiplier: delays are 1s, 2s, 4s |

**Retry lifecycle:**
1. Fetch fails → status becomes `'error'`, `retryCount` increments.
2. A `setTimeout` is registered for the next attempt.
3. When the timer fires, it checks the current cache state and only proceeds if status is still `'error'` with the matching `retryCount` (stale retry guard).
4. After `MAX_RETRIES` is exhausted, no further automatic retries are made; the UI shows a manual retry prompt.

### Mutation Hook (`useReactionMutation`)

For optimistic UI, use `useReactionMutation` from `src/hooks/useReactionMutation.ts`:

```typescript
const { handleReaction, isInFlight } = useReactionMutation({
  postId,
  objectType: 'image',
  objectId: imageId,
  currentReactionState,
})

// React to an image
handleReaction('heart') // Optimistic update fires immediately

// Remove reaction
handleReaction(null)
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/posts/{postId}/image-reactions` | Fetch all image reactions for a post (batched per image) |
| `POST` | `/api/v1/posts/{postId}/reactions` | Add/replace reaction (`object_type=image`, `object_id=imageId`) |
| `DELETE` | `/api/v1/posts/{postId}/reactions` | Remove reaction (`object_type=image`, `object_id=imageId`) |
| `GET` | `/api/v1/posts/{postId}/reactions` | Detailed reactor list for `ReactionViewer` |

### Domain Separation

Image reactions are strictly scoped to `object_type: 'image'`. Post-level reactions use `object_type: 'post'`. These namespaces are validated in:
- `ReactionViewer` (dev-only assertion at render)
- Backend polymorphic endpoint routing

---

## Post Creation

### Image Upload Flow

1. User selects up to 7 images via drag-and-drop or file picker
2. Frontend validates file type and size before upload
3. Images display as draggable thumbnails for reordering
4. Position is determined by visual order (0 = leftmost/top)
5. First image is marked as "Primary" with visual emphasis
6. On submit, images upload as FormData with position preserved

### Drag-and-Drop Reordering

- Drag handles allow repositioning images before publish
- Reorder operations update position values immutably
- Primary image indicator follows position 0 automatically

## Backend API

### Create Post with Images

```http
POST /api/v1/posts/upload
Content-Type: multipart/form-data

images: File[] (up to MAX_POST_IMAGES)
content: string
[other post fields...]
```

### Post Response

```json
{
  "id": "post-123",
  "content": "...",
  "images": [
    {
      "id": "img-1",
      "position": 0,
      "thumbnail_url": "/uploads/posts/abc_thumb.jpg",
      "medium_url": "/uploads/posts/abc_medium.jpg",
      "original_url": "/uploads/posts/abc_original.jpg",
      "width": 1920,
      "height": 1080
    }
  ]
}
```

## URL Transformation

Backend returns relative URLs (e.g., `/uploads/posts/...`). The frontend API routes transform these to absolute URLs:

```typescript
const transformImageUrl = (url: string | null): string | null => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url}`
}
```

## Design Decisions

### Synchronous Processing

Image variants are generated synchronously during upload rather than via async queues. This is acceptable for the maximum of 7 images per post.

### Position-Based Ordering

Images use an integer `position` column for explicit order control. Position 0 is always the primary image displayed prominently in the feed.

### Legacy Support

The `image_url` field on posts is deprecated but maintained for backward compatibility. New posts use the `images` array exclusively.

### Passive Feed Display

The stacked preview in the feed is passive (no hover carousel or auto-rotation). Click interaction opens the fullscreen gallery.

## Known Limitations

### Draft Image Previews

Draft images are not restored when reopening a saved draft. This is by design:

- Image previews use ephemeral blob URLs created by `URL.createObjectURL()`
- Blob URLs are tied to the browser session and cannot be persisted
- Storing base64-encoded images would exceed localStorage limits
- Users should complete image posts in one session or re-add images when resuming

See `KNOWN_ISSUES.md` for full details.

## File Locations

### Backend

| File | Purpose |
|------|---------|
| `apps/api/app/models/post_image.py` | PostImage model |
| `apps/api/app/config/image_config.py` | Centralized image configuration |
| `apps/api/app/services/file_upload_service.py` | Variant processing |
| `apps/api/app/api/v1/posts.py` | Upload and response handling |

### Frontend

| File | Purpose |
|------|---------|
| `apps/web/src/components/StackedImagePreview.tsx` | Feed stacked preview |
| `apps/web/src/components/MultiImageModal.tsx` | Fullscreen gallery with reaction UI |
| `apps/web/src/components/ImageModal.tsx` | Full resolution zoom (shared) |
| `apps/web/src/components/ReactionViewer.tsx` | Modal listing users who reacted to an object |
| `apps/web/src/components/EmojiPicker.tsx` | Emoji selection overlay |
| `apps/web/src/components/OptimizedPostImage.tsx` | Single-image display |
| `apps/web/src/components/CreatePostModal.tsx` | Upload and reorder UI |
| `apps/web/src/hooks/useImageReactions.ts` | Global reactive cache + hook for image reactions |
| `apps/web/src/hooks/useReactionMutation.ts` | Optimistic mutation hook for adding/removing reactions |
| `apps/web/src/config/reactions.ts` | Centralized retry policy config |
| `apps/web/src/utils/scrollLock.ts` | Stack-aware scroll lock manager |
| `apps/web/src/utils/imageUpload.ts` | Validation utilities |
| `apps/web/src/types/post.ts` | TypeScript interfaces |

## Testing

### Backend Tests

```bash
cd apps/api
pytest tests/unit/test_post_images.py -v
```

### Frontend Tests

```bash
cd apps/web
npm test -- --testPathPattern="StackedImagePreview|imageUpload"
```
