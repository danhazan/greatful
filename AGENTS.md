# AGENTS.md

## Project Overview

Grateful is a social gratitude platform with FastAPI backend (`apps/api`) and Next.js frontend (`apps/web`).

**Full documentation**: See `docs/README.md` for the documentation index. Key refs:
- Setup guide: `docs/ARCHITECTURE_AND_SETUP.md`
- Testing: `docs/TEST_GUIDELINES.md`
- Commands: `docs/USEFUL_COMMANDS.md`
- Troubleshooting: `docs/KNOWN_ISSUES.md`
- Past bug resolutions: `agent/COMMON_FIXES.md`

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

---

## Agent Task Harness

**Every development task follows `agent/HARNESS.md`. Read it before doing anything else.**

The harness covers two task types (bugs and features/refactors) through five phases: Task Digest → Investigation → Plan + Quality Gates → Human Approval → TDD Implementation + Quality Gates → Completion Report.

Two tools are required throughout every task: **Superpowers** (workflow enforcement, subagent review, TDD discipline) and **Ponytail** (complexity and YAGNI review). Both must be active. See `agent/HARNESS.md` for how and when each is used.

When you receive a task:
1. Confirm Superpowers and Ponytail are active on your platform
2. Open `agent/HARNESS.md` and follow it from Phase 0
3. Your task definition lives in `agent/tasks/<task-id>.md`

---

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

## Testing

**Before writing any test, read `docs/TEST_GUIDELINES.md`** — layer architecture, file placement, governance rules, and date/time standards.

- Backend: in-memory SQLite (`sqlite+aiosqlite:///:memory:`), fresh per test via `test_engine` fixture in `tests/conftest.py`. Never test against a real database.
- Frontend: Jest with Testing Library. Colocate unit/behavior tests in `__tests__/`; broader tests in `src/tests/`.
- Test governance: `npm run test:governance`

## Security Considerations

- Never commit secrets. Environment variables in `.env` (not committed).
- Auth: bcrypt via `app/core/security.py`. Don't implement custom auth.
- OAuth: handled by `app/services/oauth_service.py`. Don't modify without review.
- User input: Use `app/core/input_sanitization.py`
- Post visibility: Always use `cache: 'no-store'` for individual post fetches to prevent temporal privacy leaks.
- **Security enforcement is never a candidate for YAGNI or simplification.** Auth checks, input sanitization, and boundary validation are always written in full, regardless of any quality-gate simplification pressure.
