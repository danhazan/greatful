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
- `app/api/v1/` - REST API endpoints (auth, posts, users, comments, reactions, notifications, follows)
- `app/models/` - SQLAlchemy models (User, Post, Comment, EmojiReaction, Notification, Follow, Share)
- `app/services/` - Business logic layer (algorithm_service, reaction_service, notification_service, etc.)
- `app/repositories/` - Data access layer (not explicitly used, services often access DB directly)
- `app/core/` - Core infrastructure:
  - `database.py` - Async SQLAlchemy engine and session management
  - `security.py` - JWT token handling, password hashing
  - `rate_limiting.py` - Request rate limiting
  - `notification_batcher.py` - Groups notifications to prevent spam
- `alembic/` - Database migrations

### Frontend Structure (apps/web)
- `src/app/` - Next.js App Router pages (feed, profile, post, auth, settings)
- `src/app/api/` - API routes that proxy to backend
- `src/components/` - React components:
  - `PostCard.tsx` - Main post display with reactions, hearts, comments
  - `EmojiPicker.tsx` - Emoji reaction selector
  - `CommentsModal.tsx` - Comment thread display
  - `CreatePostModal.tsx` / `EditPostModal.tsx` - Post creation/editing
  - `RichTextEditor.tsx` - WYSIWYG editor with formatting
  - `NotificationSystem.tsx` - Real-time notification handling
- `src/lib/` - Shared utilities including API proxy helpers
- `src/utils/` - Utility functions (notificationMapping, userDataMapping)
- `src/contexts/` - React context providers

### API Proxy Pattern
The frontend uses a proxy pattern where Next.js API routes forward requests to the FastAPI backend. See `src/lib/api-proxy.ts` for the implementation. This handles:
- Authentication token forwarding
- Cookie management
- Response normalization (snake_case to camelCase)

### Data Normalization
Backend returns snake_case fields, frontend expects camelCase. Key utilities:
- `src/utils/userDataMapping.ts` - User data normalization
- `src/utils/notificationMapping.ts` - Notification data transformation

## Testing

### Backend Tests (apps/api/tests)
- `tests/unit/` - Unit tests for services and utilities
- `tests/integration/` - API endpoint integration tests
- `tests/security/` - Security and authorization tests
- `tests/conftest.py` - Shared fixtures (test_user, test_post, auth_headers, db_session)

Uses in-memory SQLite for test isolation. Key fixtures:
- `db_session` - Fresh database session per test
- `test_user` / `test_user_2` - Pre-created test users
- `auth_headers` - JWT auth headers for authenticated requests
- `client` - FastAPI TestClient

### Frontend Tests (apps/web/src/tests)
Uses Jest with Testing Library. Test files mirror component structure.

## Key Patterns

### Emoji Reaction System
- 8 supported emojis
- One reaction per user per post (can be changed)
- Backend: `EmojiReaction` model in `app/models/emoji_reaction.py`
- Frontend: `EmojiPicker.tsx` and reaction display in `PostCard.tsx`

### Real-time Updates
Reactions update immediately via API calls without page refresh. PostCard fetches updated counts after mutations.

### Authentication
JWT-based auth with tokens stored in cookies. Backend validates via `app/core/security.py`. OAuth integration available for Google/Facebook.

## Known Issues

See `docs/KNOWN_ISSUES.md` for tracked bugs