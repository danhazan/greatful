# Test Guidelines

## Test Layer Architecture

### Frontend

| Layer | Naming Pattern | Purpose | Example |
|-------|---------------|---------|---------|
| Unit | `*.test.ts` / `*.test.tsx` | Isolated logic, pure functions | `dateFilterUtils.test.ts` |
| Behavior | `*.test.tsx` | UI output (render, styles) | `DateFilterModal.test.tsx` |
| Interaction | `*.interactions.test.tsx` | API calls, user interactions | `PostCard.interactions.test.tsx` |
| Flow | `*.flow.test.tsx` | Full user journey, no internal mocks | `FollowButton.flow.test.tsx` |

Placement: unit/behavior tests go in `__tests__/` colocated alongside their source; interaction/flow tests go in `src/tests/` due to broader dependency scope. When in doubt, match the convention of adjacent test files.

### Backend

| Layer | Location | Purpose | Example |
|-------|----------|---------|---------|
| Unit | `tests/unit/` | Service and repository logic | `test_emoji_reactions.py` |
| Contract | `tests/contract/` | API contract validation | `test_api_contracts.py` |
| Integration | `tests/integration/` | Full API integration | `test_feed_v2.py` |

### Governance Rules

**Backend:**
1. No skipped tests without classification — must have `MIGRATE` / `DELETE` / `KEEP` comment
2. Deterministic tests only — no timing-dependent or flaky tests

**Frontend:**
1. Deterministic tests only — freeze time with `jest.setSystemTime()` when testing date logic
2. No skipped tests without classification — must have `MIGRATE` / `DELETE` / `KEEP` comment
3. `@flow` count frozen — do not add tests to `src/tests/integration/` without explicit review

---

## Safe vs Unsafe Changes

### Safe
- Adding new features with appropriate tests
- Extending existing flows with new test scenarios
- Adding new non-breaking API fields
- Fixing bugs within existing test coverage

### Unsafe
- Changing the response shape of existing API endpoints
- Removing fields used in the resolver (`username`, `displayName`, `*_Username`)
- Modifying contract invariants
- Bypassing the transformation layer
- Adding internal mocks to `@flow` tests
- Adding skipped tests without a `MIGRATE` / `DELETE` / `KEEP` classification
- Expanding the `@flow` test count

**Known exceptions:**
- Share flow has partial frontend coverage (intentional, non-critical)
- Backend transformation inconsistency is handled defensively in the resolver

---

## Test Structure

### Frontend (`apps/web/src/`)

```
src/
├── tests/                       # Integration, cross-cutting, shared utilities
│   ├── api/                     # API endpoint tests
│   ├── components/              # Component interaction and flow tests
│   ├── hooks/                   # Hook-level integration tests
│   ├── integration/             # Full user journey tests (@flow — count frozen)
│   └── utils/                   # Shared helpers: test-helpers.ts, testUtils.tsx
├── app/*/__tests__/             # Colocated unit/behavior tests
│   ├── feed/__tests__/
│   ├── auth/callback/__tests__/
│   └── auth/signup/__tests__/
├── utils/__tests__/             # Utility unit tests
└── hooks/__tests__/             # Hook behavior tests
```

### Backend (`apps/api/tests/`)

```
tests/
├── conftest.py                  # Fixtures: test_engine, async_client, auth_headers
├── integration/                 # Full API integration tests
│   ├── test_api_contracts.py
│   ├── test_profile_api.py
│   ├── test_reactions_api.py
│   └── test_notifications_api.py
├── unit/                        # Service and repository unit tests
│   ├── test_emoji_reactions.py
│   ├── test_user_profile.py
│   └── test_notification_batching.py
└── security/                    # Security tests — no database dependency
    ├── conftest.py              # Unified mock app via _create_security_test_app()
    ├── test_penetration_testing.py
    ├── test_security_compliance.py
    └── test_security_configuration.py
```

Backend tests always use the in-memory SQLite fixture (`sqlite+aiosqlite:///:memory:`, fresh per test via `test_engine` in `conftest.py`). Never use a real database in tests. Security tests use a dedicated mock FastAPI app with no database dependency — see `tests/security/conftest.py` before writing any new security tests.

---

## Test Categories

### Unit Tests

**Backend unit tests cover:**
- Service layer business logic (AuthService, UserService, ReactionService, NotificationService)
- Database models and validation
- Custom exception handling
- Service layer validation and error handling
- Mock external dependencies and database operations

**Frontend unit tests cover:**
- React components in isolation (DateFilterModal, PostCard, LocaleDateInput)
- Utility functions (dateFilterUtils, feedFilterState, normalizePost)
- Custom hooks (useTaggedQuery, useInfiniteFeed)
- Mock all external dependencies

### Integration Tests

**Backend integration tests cover:**
- Complete API workflows with standardised response validation
- API contract validation and response structure
- Authentication flows with JWT middleware
- Service layer integration with database operations
- Notification system with batching behaviour

**Frontend integration tests cover:**
- Page-level component interactions
- API route handlers
- Form submissions and multi-step user flows
- Cross-component state coordination

---

## Running Tests

### Frontend
```bash
cd apps/web
npm test                                         # All tests
npm test -- --watch                              # Watch mode
npm test PostCard.test.tsx                       # Single file
npm test -- --testNamePattern="PostCard"         # By name
npm test -- --coverage                           # Coverage report
npm run test:governance                          # Governance checks
```

### Backend
```bash
cd apps/api
pytest                                           # All tests
pytest tests/unit/test_likes.py -v              # Single file
pytest --cov=app tests/                          # Coverage
```

### Full pre-commit verification
```bash
cd apps/web && npm run lint && npm run type-check && npm test
cd apps/api && pytest
```

---

## Standards

### Shared Types and Contracts

The shared type system bridges frontend and backend:

```
shared/types/
├── api.ts            # API contract types for all endpoints
├── models.ts         # Database model types and interfaces
├── services.ts       # Service layer interface definitions
├── core.ts           # Core types, enums, and constants
└── python/models.py  # Python equivalents of TypeScript types
```

Use shared types when constructing test data: `const mockPost: PostResponse = { ... }`. This means contract violations surface at compile time rather than at runtime.

Contract tests (`tests/contract/`, `tests/integration/test_api_contracts.py`) validate that live API responses match shared type definitions. When adding a field to a Pydantic response model, add a corresponding contract test assertion.

### Standardised API Response Format

All backend API endpoints return a standardised envelope. Tests asserting on API responses must validate this structure:

**Success response:**
```python
assert data["success"] is True
assert "data" in data
assert "timestamp" in data
assert "request_id" in data
```

**Error response:**
```python
assert data["success"] is False
assert "error" in data
assert "code" in data["error"]
assert "message" in data["error"]
```

### Service Layer Architecture

All business logic lives in service classes that inherit from `BaseService`. Backend unit tests target the service layer directly, not the route handlers.

- Test services by calling their methods with a `db_session` fixture
- Raise custom exceptions (`NotFoundError`, `ValidationException`, `ConflictError`) and assert `status_code` and `error_code` on the exception
- API endpoints are thin controllers — test the service, then separately test the endpoint's request/response contract

### Date/Time Testing

**Mandatory standards:**

1. **Freeze time** — call `jest.useFakeTimers()` and `jest.setSystemTime()` in `beforeEach` for any test that touches date logic. Restore with `jest.useRealTimers()` in `afterEach`.
2. **ISO dates as canonical state** — all date state is `YYYY-MM-DD`. Assert ISO format; never assert locale-formatted strings as state.
3. **No live clock** — never rely on `new Date()` or `Date.now()` in assertions without freezing time first.

**Recommended practices:**

1. **Test locale formatting independently** — `isoToLocaleString()` converts ISO to display strings; test it with known locales (`en-US`, `de-DE`, `fr-FR`), not the runtime locale.
2. **Avoid timezone-sensitive assertions** — when testing `getUtcRangeFromLocalDates()`, compute expected values dynamically via `new Date(year, month, day).toISOString()` rather than hardcoding UTC strings.
3. **Favour behaviour over implementation** — test what a function does (input → output) rather than how it does it.

**Canonical date architecture — do not break this layering:**

| Layer | Format | Used in |
|-------|--------|---------|
| Application state | `YYYY-MM-DD` | `localRange.start/end`, draft values |
| URL parameters | `YYYY-MM-DD` | `date_start=`, `date_end=` query params |
| API communication | UTC ISO 8601 | converted via `getUtcRangeFromLocalDates()` |
| Presentation | Locale string | `isoToLocaleString()` — display only, never stored |

`getUtcRangeFromLocalDates()` is the **only** conversion path from local ISO to UTC for API calls. Locale-formatted strings must never be stored in state, written to URLs, or sent to the API.

**Single Source of Truth:**
- Avoid duplicated authoritative state. Derived values must be computed from canonical state, not stored separately.
- When two pieces of state must stay in sync, derive one from the other rather than synchronising bidirectionally.
- React state is canonical; derived UI (class names, disabled attributes, validation messages) is computed during render.
- `feedFilterState.ts` is the single source of truth for feed filter parameters; URL serialisation and API parameter generation are derived from it.

### Behaviour-First Testing

Test observable behaviour and public contracts, not implementation details.

- Test that a modal opens on button click — not that `useEffect` was called
- Test that a filter returns the correct UTC range — not that `new Date()` was invoked internally
- Test that an invalid date shows an error message — not that a specific class name was toggled

**Exception:** When an implementation detail *is* the public contract (a serialisation format, a URL encoding scheme), assert it explicitly.

### Style and Consistency

- Import shared test utilities from `src/tests/utils/` (`test-helpers.ts`, `testUtils.tsx`) rather than reimplementing mock patterns locally
- Use consistent `describe`/`it` nesting; match the structure of adjacent test files in the same directory
- Extract shared mock setup to `beforeEach`; tear down in `afterEach`
- File naming: lowercase-with-hyphens for tests in `src/tests/`; PascalCase matching the source file for colocated `__tests__/` tests
- Backend: use `async_client` and `auth_headers` fixtures from `conftest.py` for all HTTP-layer tests

---

## Mobile Standards

Any task that adds or modifies UI components must meet these standards before completion.

### Component Requirements
- All interactive elements have a minimum 44px touch target
- Text is readable without zooming (minimum 16px font size)
- Modals adapt correctly to mobile viewports
- Images scale correctly without causing horizontal scroll

### Interaction Requirements
- Tap interactions work without double-tap zoom issues
- Keyboard appearance does not break layout
- Form inputs are accessible and correctly sized

### Accessibility Requirements
- Screen reader compatible (VoiceOver, TalkBack)
- Keyboard navigation works with external keyboards
- Colour contrast meets WCAG 2.1 AA standards
- Focus indicators are visible and correctly managed

### Best Practices
- Test on actual devices (iOS Safari, Android Chrome) in addition to browser simulation
- Test both portrait and landscape orientations
- Validate image optimisation and lazy loading
- Ensure error states are mobile-friendly

---

## Common Patterns

### Backend
- **HTTP layer tests**: use `async_client` fixture with `auth_headers` to test route, status code, and response envelope
- **Service layer tests**: instantiate the service with `db_session`, call its methods directly, assert on return value or raised exception
- **Authentication tests**: use the `auth_headers` JWT fixture; separately test 401 responses by omitting it
- **Error tests**: assert on `exc_info.value.status_code` and `exc_info.value.error_code` for custom exceptions

### Frontend
- **Component tests**: render with minimal props, assert on what's visible in the DOM
- **Hook tests**: use `renderHook` in isolation; mock any API calls the hook makes
- **API route tests**: mock `fetch` or the relevant `apiClient` method; test the route handler's response format
- **Form tests**: use `userEvent` for typed input; assert on validation messages and submission calls

---

## Troubleshooting

1. **Async/await issues** — ensure `pytest-asyncio` mode is set and test functions are `async def`; ensure `await` is not missing before assertions on async results
2. **Database conflicts** — if tests interfere, check that `test_engine` fixture is scoped correctly (function scope gives a fresh DB per test)
3. **Mock issues** — call `jest.clearAllMocks()` in `beforeEach`; verify the mock is imported from the correct path
4. **`Response` not defined** — import the global `Response` mock from `src/tests/utils/test-helpers.ts`; do not redefine it locally
5. **Shared utilities missing** — import from `src/tests/utils/test-helpers.ts` and `testUtils.tsx`; if a common mock is not there, add it there rather than inline in the test file
6. **Environment variable errors** — check `src/tests/setup.ts` for the full list of mocked env vars; add any missing ones there, not in individual test files
