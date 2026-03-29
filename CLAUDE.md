# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Grateful is a social gratitude platform for sharing daily gratitudes with emoji reactions, sharing, and community engagement. It's a monorepo with:
- **Backend**: FastAPI (Python) with async SQLAlchemy and PostgreSQL
- **Frontend**: Next.js 14 (TypeScript) with Tailwind CSS

## Development Commands

### Backend (apps/api)
```bash
cd apps/api
source venv/bin/activate

# Run server
uvicorn main:app --reload

# Run all tests
pytest

# Run single test file
pytest tests/unit/test_likes.py -v

# Run specific test
pytest tests/unit/test_likes.py::test_like_post -v

# Run with coverage
pytest --cov=app tests/

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Frontend (apps/web)
```bash
cd apps/web

# Development server
npm run dev

# Build
npm run build

# Run all tests
npm test

# Run single test file
npm test -- src/tests/components/PostCard.test.tsx

# Watch mode
npm run test:watch

# Type checking
npm run type-check

# Lint
npm run lint
```

## Architecture

### Backend Structure (apps/api)
- `main.py` - FastAPI app entry point with middleware configuration
- `app/api/v1/` - REST API endpoints (auth, posts, users, comments, reactions, hearts, notifications, follows, shares, oauth, health, monitoring, database, security, ssl, error_reporting)
- `app/models/` - SQLAlchemy models (User, Post, Comment, EmojiReaction, Notification, Follow, Share, and others)
- `app/services/` - Business logic layer (services including feed_service_v2, reaction_service, notification_service, oauth_service, share_service, mention_service, file_upload_service, post_privacy_service, etc.)
- `app/repositories/` - Data access layer (8 repository files)
- `app/core/` - Core infrastructure:
  - `database.py` - Async SQLAlchemy engine and session management
  - `security.py` - JWT token handling, password hashing
  - `rate_limiting.py` - Request rate limiting
  - `notification_batcher.py` - Groups notifications to prevent spam
  - `oauth_config.py` - OAuth provider configuration
  - `storage.py` - File storage management
  - `input_sanitization.py` - Input validation and sanitization
  - `structured_logging.py` - Application logging
  - Additional: monitoring, SSL, security audit, migration, performance utilities
- `alembic/` - Database migrations (43+ migrations)
- `scripts/` - Deployment and utility scripts

### Frontend Structure (apps/web)
- `src/app/` - Next.js App Router pages (feed, profile, post, auth, settings)
- `src/app/api/` - API routes (40+) that proxy to backend
- `src/components/` - React components (69 files):
  - `PostCard.tsx` - Main post display with reactions, hearts, comments
  - `EmojiPicker.tsx` / `MinimalEmojiPicker.tsx` / `EnhancedEmojiPicker.tsx` - Emoji reaction selectors
  - `CommentsModal.tsx` - Comment thread display
  - `CreatePostModal.tsx` / `EditPostModal.tsx` - Post creation/editing
  - `RichTextEditor.tsx` - WYSIWYG editor with formatting
  - `NotificationSystem.tsx` - Real-time notification handling
  - `ReactionsBanner.tsx` / `ReactionViewer.tsx` / `HeartsViewer.tsx` - Reaction displays
  - `ShareModal.tsx` - Post sharing
  - `UserItem.tsx` / `UserAvatar.tsx` / `UserSearchBar.tsx` - User components
  - `FollowButton.tsx` / `FollowersModal.tsx` / `FollowingModal.tsx` - Follow/social
  - `PostPrivacySelector.tsx` / `PostPrivacyBadge.tsx` - Privacy controls
  - `MentionAutocomplete.tsx` - Mention suggestions in editor
  - `LocationAutocomplete.tsx` / `LocationModal.tsx` - Location features
  - `GratitudeTemplates.tsx` - Template suggestions for posts
  - `Navbar.tsx`, `ErrorBoundary.tsx`, `ToastNotification.tsx` - UI infrastructure
- `src/lib/` - Shared utilities including API proxy helpers
- `src/utils/` - Utility functions (36 files):
  - `userDataMapping.ts` - User data normalization (snake_case to camelCase)
  - `notificationMapping.ts` - Notification data transformation
  - `emojiMapping.ts` - Emoji code-to-emoji conversion (source of truth for all 56 emojis)
  - `imageUpload.ts` - Image upload with validation
  - `mentionUtils.ts` - Mention parsing utilities
  - `htmlUtils.ts` - HTML parsing and sanitization
  - `normalizePost.ts` - Post data normalization
  - `smartNotificationPoller.ts` - Intelligent notification polling
  - `privacyUtils.ts` - Privacy/visibility helpers
  - `errorTracking.ts` - Error tracking utilities
  - `apiClient.ts` / `apiCache.ts` - API client with caching
- `src/hooks/` - Custom React hooks (7 files)
- `src/contexts/` - React context providers:
  - `UserContext.tsx` - Global user authentication state
  - `ToastContext.tsx` - Toast notification state
- `src/types/` - TypeScript type definitions
- `src/services/` - Client-side services

### API Proxy Pattern
The frontend uses a proxy pattern where Next.js API routes forward requests to the FastAPI backend. See `src/lib/api-proxy.ts` for the implementation. This handles:
- Authentication token forwarding
- Cookie management
- Response normalization (snake_case to camelCase)

### Data Normalization
Backend returns snake_case fields, frontend expects camelCase. Key utilities:
- `src/utils/userDataMapping.ts` - User data normalization
- `src/utils/notificationMapping.ts` - Notification data transformation
- `src/utils/normalizePost.ts` - Post data normalization

## Testing

### Backend Tests (apps/api/tests)
- `tests/unit/` - Unit tests for services and utilities (~45 files)
- `tests/integration/` - API endpoint integration tests (~54 files)
- `tests/security/` - Security and authorization tests (6 files)
- `tests/load/` - Load/performance tests (6 files)
- `tests/contract/` - API contract tests
- `tests/conftest.py` - Shared fixtures (test_user, test_post, auth_headers, db_session)

Uses in-memory SQLite for test isolation. Key fixtures:
- `db_session` - Fresh database session per test
- `test_user` / `test_user_2` - Pre-created test users
- `auth_headers` - JWT auth headers for authenticated requests
- `client` - FastAPI TestClient

### Frontend Tests (apps/web/src/tests)
Uses Jest with Testing Library. 137 test files organized to mirror component/utility structure. Categories include: component tests, API route tests, utility tests, integration tests, accessibility tests, and context tests.

## Key Patterns

### Feed System
- Single endpoint: `GET /api/v1/posts/feed` with cursor-based pagination (`cursor`, `page_size` params)
- Returns `{ posts, nextCursor }` response shape
- Backend: `app/services/feed_service_v2.py` — SQL CTE-based scoring with recency, engagement, and follow boosts
- Author spacing applied post-query to prevent feed domination
- Frontend: `src/app/feed/page.tsx` with infinite scroll via cursor pagination
- No read-status tracking, no algorithm toggle, no offset-based pagination

### Emoji Reaction System
- 56 positive emojis organized in 7 rows/categories: original (💜😍🤗🥹💪🙏🙌👏), love/warmth, joy/celebration, encouragement, nature/peace, affection, expressions
- One reaction per user per post (can be changed)
- Backend: `EmojiReaction` model in `app/models/emoji_reaction.py`
- Frontend: `src/utils/emojiMapping.ts` is the source of truth; `EmojiPicker.tsx`, `ReactionsBanner.tsx`, and reaction display in `PostCard.tsx`

### Real-time Updates
Reactions update immediately via API calls without page refresh. PostCard fetches updated counts after mutations.

### Authentication
JWT-based auth with tokens stored in cookies. Backend validates via `app/core/security.py`. OAuth integration available for Google/Facebook via `app/core/oauth_config.py` and `app/services/oauth_service.py`.

### Post Privacy
Posts support privacy/visibility settings. Backend: `app/services/post_privacy_service.py`. Frontend: `PostPrivacySelector.tsx`, `PostPrivacyBadge.tsx`, `src/utils/privacyUtils.ts`.

### Mentions
Users can be @mentioned in posts and comments. Backend: `app/services/mention_service.py`. Frontend: `MentionAutocomplete.tsx`, `src/utils/mentionUtils.ts`.

### File Uploads
Profile photos and post images supported. Backend: `app/services/file_upload_service.py`, `app/services/profile_photo_service.py`, `app/services/image_hash_service.py` (deduplication). Frontend: `src/utils/imageUpload.ts`.

## Known Issues

See `docs/KNOWN_ISSUES.md` for tracked bugs
