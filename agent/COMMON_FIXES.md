# Common Fixes

Agent reference for recurring bugs and architectural gotchas. Check this file during **Phase 1 investigation** for any bug task, and before planning any task that touches API endpoints, data fields, or form inputs.

Each entry has a **fingerprint** — the specific signals that identify the problem before you know the root cause. Match symptoms to fingerprint first, then read root cause and fix pattern to confirm.

Entries are grouped by category. **Instances** track every recurrence so the pattern's frequency is visible.

When a bug task completes, the implementing agent adds or updates an entry here. Keep entries concise — enough to diagnose and orient, not a full tutorial.

---

## Contents

**[Architectural Gotchas](#architectural-gotchas)** — check first for any bug involving a new endpoint, field, or dynamic dictionary

- [Missing Next.js API Proxy Route](#missing-nextjs-api-proxy-route) · `High recurrence`
- [Missing Field in Next.js Proxy Transformation](#missing-field-in-nextjs-proxy-transformation) · `High recurrence`
- [API Case Transformation Corrupting Dynamic Dictionary Keys](#api-case-transformation-corrupting-dynamic-dictionary-keys) · `High recurrence`

**[Component and State Bugs](#component-and-state-bugs)**

- [Profile Page Navbar Unresponsive](#profile-page-navbar-unresponsive) · `Medium recurrence`
- [Follow Counter Showing Wrong Value (Optimistic Update Conflict)](#follow-counter-showing-wrong-value-optimistic-update-conflict) · `Medium recurrence`
- [Spurious Requests for Unrelated User Profiles](#spurious-requests-for-unrelated-user-profiles) · `Low recurrence`
- [Notification List Clearing on Page Navigation](#notification-list-clearing-on-page-navigation) · `Low recurrence`

**[UI and CSS Patterns](#ui-and-css-patterns)**

- [Invisible Text in Mobile Input Fields](#invisible-text-in-mobile-input-fields) · `Medium recurrence`
- [Dropdown Overflowing Viewport or Misaligned on Mobile](#dropdown-overflowing-viewport-or-misaligned-on-mobile) · `Medium recurrence`

**[Environment and Infrastructure](#environment-and-infrastructure)**

- [PostgreSQL "Password Authentication Failed" After Credential Change](#postgresql-password-authentication-failed-after-credential-change) · `Low recurrence`

---

## Architectural Gotchas

These recur whenever the architecture is extended. **Always check these first** for any bug involving a new endpoint, new field, or new dynamic dictionary. Recurrence risk is high because the architecture requires manual steps that are easy to miss.

---

### Missing Next.js API Proxy Route

**Fingerprint:** Backend endpoint works when called directly (curl/Postman returns 200). The same path called from the frontend returns 404 or 422. Network tab shows the request going to `/api/...` with no matching response, even though the FastAPI route is registered and tested.

**Root cause:** The frontend cannot call FastAPI directly — all requests go through Next.js proxy routes in `apps/web/src/app/api/`. A new FastAPI endpoint is completely invisible to the frontend until a matching `route.ts` file is created.

**Fix pattern:** Create `apps/web/src/app/api/<path>/route.ts` for every new backend endpoint. The proxy must forward the `Authorization` header, pass the body through, and return `NextResponse.json(data, { status: response.status })` to preserve backend status codes. Path mapping: backend `/api/v1/users/batch-profiles` → proxy file `apps/web/src/app/api/users/batch-profiles/route.ts` → frontend calls `/api/users/batch-profiles`.

**Checklist when adding any new endpoint:**
1. FastAPI route in `apps/api/app/api/v1/`
2. Next.js proxy route in `apps/web/src/app/api/`
3. `apiClient` method in `apps/web/src/utils/apiClient.ts` (if needed)
4. Test backend directly, then through proxy

**Key files:** `apps/api/app/api/v1/*.py` · `apps/web/src/app/api/**/route.ts` · `apps/web/src/utils/apiClient.ts`

**Recurrence risk:** High — every new endpoint.
**First resolved:** February 2026
**Instances:** `batch-profiles` `/api/users/batch-profiles` (Feb 2026) · `batch-follow-status` `/api/follows/batch-status` (Feb 2026)

---

### Missing Field in Next.js Proxy Transformation

**Fingerprint:** A field is confirmed present in the raw backend response (direct API test or Network tab on the backend call). The frontend receives the proxy response but the field is missing or `undefined`. Other similar fields (e.g., `reactionsCount`) work correctly. The FastAPI Pydantic model includes the field.

**Root cause:** The proxy routes manually map snake_case backend fields to camelCase frontend fields. New fields are not auto-forwarded — every transformation block must be updated explicitly.

**Fix pattern:** Find all transformation points with `grep -r "reactionsCount.*reactions_count" apps/web/src/app/api/` and add the new mapping in parallel. Cover every HTTP method: GET feed, POST create, GET single, PUT update. Always add a fallback default (e.g., `|| 0` for counts). Update the TypeScript interface in `apps/web/src/types/` too.

**Key files:** `apps/web/src/app/api/posts/route.ts` · `apps/web/src/app/api/posts/[id]/route.ts` · `apps/api/app/api/v1/posts.py`

**Recurrence risk:** High — every new post-shaped field.
**First resolved:** December 2024
**Instances:** `commentsCount` / `comments_count` (Dec 2024)

---

### API Case Transformation Corrupting Dynamic Dictionary Keys

**Fingerprint:** A feature works correctly after a full page refresh (clean API data) but breaks immediately after a user action (in-memory state). Dynamic dictionary keys that should stay snake_case (e.g., `heart_eyes`) appear in camelCase (`heartEyes`) in frontend state. A fallback value is shown instead (e.g., emoji reactions show 👍). Duplicate keys may appear with both casings in state.

**Root cause:** `caseTransform.ts` uses `humps` to recursively camelize all response keys, including the contents of dynamic dictionaries like `emojiCounts`. Dictionary keys are domain identifiers (not schema field names) and must preserve their original casing. `emojiMapping.ts` and similar lookups expect snake_case and fail silently when they find camelCase.

**Fix pattern:** Add the dictionary's parent key to `PROTECTED_KEYS` in `apps/web/src/lib/caseTransform.ts`. The `deepCamelize` function stops recursing into the subtree of any protected key — keys and all descendants are left untransformed.

**Prevention:** Any time a new API response includes a dynamic dictionary (keys are domain identifiers, not schema fields), add its parent key to `PROTECTED_KEYS` immediately.

**Key files:** `apps/web/src/lib/caseTransform.ts` · `apps/web/src/utils/emojiMapping.ts` · `apps/web/src/components/PostCard.tsx`

**Recurrence risk:** High — every new dynamic dictionary in the API.
**First resolved:** March 2025
**Instances:** `emojiCounts` / `reactionEmojiCodes` (Mar 2025)

---

## Component and State Bugs

Bugs in specific components or state management patterns. Lower recurrence risk than architectural gotchas, but the patterns are instructive for similar components.

---

### Profile Page Navbar Unresponsive

**Fingerprint:** Navbar elements (logo, feed icon, profile dropdown, logout button) are visually present and correctly styled but do not respond to clicks. Issue is isolated to profile pages — the identical navbar works on other pages. No JavaScript errors in the console.

**Root cause:** `currentUser` is passed to `<Navbar>` as `null` while the async fetch is still in flight. The click handlers inside Navbar depend on a non-null user and silently do nothing when it's null.

**Fix pattern:** In the profile page `useEffect`, fetch `currentUser` via `apiClient.getCurrentUserProfile({ cacheTTL: 300000 })` (5-minute cache — current user data changes infrequently). Only after the fetch resolves, set state and render Navbar with a fully populated `user` prop and an explicit `onLogout` handler that clears the token, nulls state, and pushes to `/`.

**Key files:** Profile page component(s) · `apps/web/src/components/Navbar.tsx`

**Recurrence risk:** Medium — any new page that fetches `currentUser` asynchronously before rendering `<Navbar>`.
**First resolved:** October 2025
**Instances:** User profile page (Oct 2025)

---

### Follow Counter Showing Wrong Value (Optimistic Update Conflict)

**Fingerprint:** Follow counter shows a wildly wrong number on initial load (e.g., 86946 instead of 2), or shows 0 when followers exist. Counter may self-correct after a follow/unfollow action or page refresh.

**Root cause:** Two compounding problems: (1) profile data was fetched with cache, so `followersCount` started at a stale or zero value; (2) the profile page's `onFollowChange` handler applied optimistic increments on top of that wrong starting value. Each navigation cycle compounded the error.

**Fix pattern:** (1) Always fetch profile data with `skipCache: true` — follower counts must be fresh. (2) Map both `followers_count` and `followersCount` from the API response with nullish coalescing to handle casing variations. (3) Remove optimistic counter updates from the profile page — let `FollowButton` be the single source of truth and allow it to refetch the authoritative count after an action.

**Key files:** Profile page component · `apps/web/src/components/FollowButton.tsx` · `apps/web/src/hooks/useUserState.ts`

**Recurrence risk:** Medium — any component combining optimistic updates with asynchronously initialized state.
**First resolved:** October 2025
**Instances:** User profile page — counter showed 86946 vs actual 2 (Oct 2025)

---

### Spurious Requests for Unrelated User Profiles

**Fingerprint:** Network tab shows profile requests for user IDs unrelated to the current page (e.g., on user A's profile page, requests fire for user B). `useUserState` hooks appear to activate for multiple different user IDs simultaneously.

**Root cause:** A fallback in the profile page loaded all feed posts when the user-specific posts endpoint failed. This rendered `FollowButton` components for every post author, each triggering its own `useUserState` hook and profile API request.

**Fix pattern:** Remove fallbacks that load semantically unrelated data to fill a gap. On failure of a user-specific endpoint, show empty state — do not substitute feed content. This keeps the set of rendered components bounded and predictable.

**Key files:** Profile page component · `apps/web/src/hooks/useUserState.ts`

**Recurrence risk:** Low — specific to the removed fallback pattern.
**First resolved:** October 2025
**Instances:** User profile page (Oct 2025)

---

### Notification List Clearing on Page Navigation

**Fingerprint:** Notification bell shows the correct count before the user clicks a notification. After navigating to the linked page (post, profile, etc.), the count resets to 0 and the list is empty. Notifications reappear after the next poll interval (30–60 seconds).

**Root cause:** `NotificationSystem` stores notifications in local React state. On navigation the component unmounts, clearing state. On remount it starts with empty state and waits for the next poll cycle. The singleton `SmartNotificationPoller` was not preserving the last-known state between mounts.

**Fix pattern:** Add a `lastNotificationState` property to `SmartNotificationPoller`. After every successful fetch, store the result. In `start()`, if cached state exists, immediately push it to all registered callbacks before the next fetch. In `stop()`, do NOT clear the cache — preserve it for the next mount. Because the poller is a singleton, the cache persists across component lifecycle.

**Key files:** `apps/web/src/utils/smartNotificationPoller.ts` · `apps/web/src/components/NotificationSystem.tsx` · `apps/web/src/tests/utils/smartNotificationPoller.persistence.test.ts`

**Recurrence risk:** Low — the fix is in the singleton and covers all consumers automatically.
**First resolved:** December 2024
**Instances:** NotificationSystem on all pages (Dec 2024)

---

## UI and CSS Patterns

Recurring styling issues with established fix patterns. When the fingerprint matches, apply the existing utility — do not write a new fix.

---

### Invisible Text in Mobile Input Fields

**Fingerprint:** Text is invisible or transparent when typed into an input field on iOS Safari or Chrome mobile. Placeholder text is visible; typed text is not. Autofill may briefly show text that then disappears. Desktop browsers are unaffected.

**Root cause:** Mobile browsers apply autofill styles that override `color`, and `-webkit-text-fill-color` (which takes precedence over `color` on iOS) can be set to transparent by browser defaults. Tailwind's `text-*` classes set `color` but not `-webkit-text-fill-color`.

**Fix pattern:** Apply `getCompleteInputStyling()` from `apps/web/src/utils/inputStyles.ts` to every `<input>` and `<textarea>`. The critical CSS property is `WebkitTextFillColor: '#374151'` — this overrides autofill transparent text. Also apply `caretColor: '#374151'` to ensure cursor visibility.

**Prevention:** Use `getCompleteInputStyling()` for all new text input elements. Verify on iOS Safari and Chrome mobile before marking any form task complete.

**Recurrence risk:** Medium — any new form component that doesn't use the shared utility.
**Instances:** Signup form · Login form · UserSearchBar · LocationAutocomplete · Profile edit form · RichTextEditor

---

### Dropdown Overflowing Viewport or Misaligned on Mobile

**Fingerprint:** A dropdown or popover overflows the screen edge on mobile, or appears offset from its trigger. Desktop layout is correct. The component uses `position: absolute` relative to the trigger.

**Root cause:** Absolute positioning relative to the trigger element causes overflow on narrow viewports where the trigger is near an edge.

**Fix pattern:** Use a dual strategy: mobile gets fixed viewport-centered positioning (`fixed left-1/2 -translate-x-1/2 w-[90vw] max-w-sm z-50`); desktop gets trigger-relative absolute positioning (`sm:absolute sm:top-full sm:mt-1 sm:left-0 sm:transform-none sm:w-full sm:max-w-sm`). Apply both together via Tailwind responsive prefixes.

**Key files:** `apps/web/src/components/UserSearchBar.tsx` · `apps/web/src/components/NotificationSystem.tsx` · `apps/web/src/components/ProfileDropdown.tsx`

**Recurrence risk:** Medium — any new dropdown component.
**Instances:** UserSearchBar · NotificationSystem dropdown · ProfileDropdown

---

## Environment and Infrastructure

---

### PostgreSQL "Password Authentication Failed" After Credential Change

**Fingerprint:** Logs contain `PostgreSQL Database directory appears to contain a database; Skipping initialization`. All connections fail with `FATAL: password authentication failed`. Environment variables are correctly set. Redeploying with updated credentials has no effect.

**Root cause:** PostgreSQL only reads initialization credentials on first startup with an empty data directory. If a volume already contains a database, the container skips init entirely and the original credentials remain in effect — env var changes are ignored.

**Fix pattern:** Detach the existing volume, create a fresh empty volume mounted at `/var/lib/postgresql/data`, and redeploy. Confirm logs show `PostgreSQL init process complete; ready for start up` (not `Skipping initialization`). On Railway: `railway volume detach` → `railway volume add` → `railway redeploy`.

**⚠️ Warning:** This destroys all data in the database. Dev/staging only. For production, use `ALTER USER postgres WITH PASSWORD 'new_password'` inside the running container instead.

**Recurrence risk:** Low — typically a one-time setup issue per environment.
**Instances:** Railway PostgreSQL (dev environment)
