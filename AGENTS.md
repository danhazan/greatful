# AGENTS.md

## Project Overview

Grateful is a social gratitude platform with FastAPI backend (`apps/api`) and Next.js frontend (`apps/web`).

**Full documentation**: See `docs/README.md` for the documentation index. Key refs:
- Setup guide: `docs/ARCHITECTURE_AND_SETUP.md`
- Testing: `docs/TEST_GUIDELINES.md`
- Commands: `docs/USEFUL_COMMANDS.md`
- Troubleshooting: `docs/KNOWN_ISSUES.md`

### Decision Table: Post-Shaped Payloads

Is the payload a post or feed item?

| Condition | Action |
|-----------|--------|
| Post/feed payload | Use `normalizePostFromApi()` in `src/utils/normalizePost.ts` |
| User data | Use `src/utils/userDataMapping.ts` |
| Notification | Use `src/utils/notificationMapping.ts` |
| Authenticated request | `apiClient` with `skipCache: true` |
| Anonymous/public | `fetchPublicPost()` in `src/lib/post-data.ts` |

**Rule**: SSR is anonymous placeholder only. Authenticated CSR data is the single source of truth.

## Build and Test Commands

### Backend
```bash
cd apps/api
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload        # Dev server on :8000
pytest                              # All tests
pytest tests/unit/test_likes.py -v # Single test file
```

### Frontend
```bash
cd apps/web
npm install
npm run dev                         # Dev server on :3000
npm run lint && npm run type-check && npm test  # Full verification
npm test -- src/tests/components/PostCard.test.tsx
```

## Code Style Guidelines

- Run `npm run lint && npm run type-check` before committing
- Imports: snake_case (backend), camelCase (frontend)
- Use async SQLAlchemy patterns for backend

## Testing Instructions

- Backend: in-memory SQLite (`sqlite+aiosqlite:///:memory:`), fresh db per test via `test_engine` fixture in `tests/conftest.py`
- Frontend: Jest with Testing Library, tests live alongside components
- Backend coverage: `pytest --cov=app tests/`
- Frontend coverage: `npm test -- --coverage`
- Test governance: `npm run test:governance`

## Security Considerations

- Never commit secrets. Environment variables in `.env` (not committed).
- Auth: bcrypt via `app/core/security.py`. Don't implement custom auth.
- OAuth: handled by `app/services/oauth_service.py`. Don't modify without review.
- User input: Use `app/core/input_sanitization.py`
- Post visibility: Always use `cache: 'no-store'` for individual post fetches to prevent temporal privacy leaks.