# Test Refactor Progress

## Current Phase
Phase 2 - Completed

## Scope
Backend failing tests only (13 tests)

## Status
- Total failing: 13
- Processed: 13 / 13

---

## Test Tracking Table

| Test Name | Category | Root Cause | Action | Status |
|-----------|----------|------------|--------|--------|
| test_bulk_check_following_success (unit) | ❌ Test Bug | Test expects dict with status strings (e.g., "active") but service returns boolean dict | Document only | Complete |
| test_bulk_check_following_status_success (unit) | ❌ Test Bug | Test expects status strings but repo returns `Dict[int, bool]` not `Dict[int, str]` | Document only | Complete |
| test_store_image_hash_success (unit) | ❌ Test Bug | Test expects `/path/to/test.jpg` with leading slash but `storage.normalize_path()` strips leading slash | Document only | Complete |
| test_allowed_origins_parsing (unit) | ⚠️ Spec Mismatch | Test expects `localhost:8000` in allowed_origins but only `localhost:3000` is configured | Document only | Complete |
| test_share_service_privacy_edge_cases (unit) | ❌ Test Bug | Test expects error when sharing private post, but `_can_share_post()` correctly returns False and raises error. Issue: test uses wrong post creation method | Document only | Complete |
| test_create_post_response_structure (integration) | ⚠️ Spec Mismatch | Test expects `email` in author object, but API doesn't return email for privacy | Document only | Complete |
| test_custom_specific_users_visibility_pipeline (integration) | 🔧 Code Bug | SQLite feed visibility clause ignored custom privacy rules and only checked public/author | **FIXED** - mirrored existing privacy service logic for specific users/followers/following in `feed_service_v2.py` | Complete |
| test_custom_followers_and_specific_users_visibility_pipeline (integration) | 🔧 Code Bug | Same root cause - custom privacy posts were excluded from feed despite direct access succeeding | **FIXED** - mirrored existing privacy service logic for specific users/followers/following in `feed_service_v2.py` | Complete |
| test_oauth_callback_token_exchange_failure (integration) | 🔧 Code Bug | `UnboundLocalError: cannot access local variable 'e'` - code uses `from e` but exception variable not properly scoped | **FIXED** | Complete |
| test_oauth_callback_redirect_uri_mismatch (integration) | 🔧 Code Bug | Same root cause as above - `e` variable not defined in scope at line 286 | **FIXED** | Complete |
| test_oauth_callback_empty_code (integration) | 🔧 Code Bug | Same root cause - all 3 OAuth tests fail due to same `e` variable bug | **FIXED** | Complete |
| test_create_post_invalid_style_id (integration) | ⚠️ Spec Mismatch | Test expects 422 but API accepts any style_id (validation not enforced) | Document only | Complete |
| test_reference_counting_with_duplicate_posts (integration) | 🔧 Code Bug | Post image variants bypassed deduplication entirely because `save_post_image_variants()` did not reuse the existing hash lookup flow | **FIXED** - added shared hash-only lookup and reused it in `save_post_image_variants()` with `force_upload` support | Complete |

---

## Fix Summary

- **Privacy fix adjustments**: Completed the custom-privacy work by aligning the SQLite feed visibility clause with the existing privacy tables and by loading the post author relationship before serializing direct `GET /posts/{id}` responses, so private/custom posts no longer fail during direct retrieval.
- **Dedup fix validation**: Finalized the shared post-image dedup path so both duplicate and non-duplicate uploads return the same normalized payload shape (`position`, variant URLs, dimensions, `file_size`) from a single helper-backed flow.
- **PostImage persistence ordering**: Kept the safe post creation order in place: process image variants first without `db.add`, create and flush the post, add `PostImage` rows, flush, then commit.

## Decisions Log

### 1. OAuth Bug Fix (Priority: HIGH) - FIXED ✅
- **Decision**: The 3 OAuth tests share a common code bug - `UnboundLocalError` at line 286 in oauth.py
- **Reasoning**: This is a clear code bug that can be fixed. The `from e` clause references variable `e` that doesn't exist in scope
- **Action**: Fix the exception variable scope in oauth.py
- **Result**: FIXED - All 3 OAuth tests now pass

### 2. Follow Tests - Test Bugs
- **Decision**: These are test bugs, not code bugs
- **Reasoning**: The service/repo intentionally returns `Dict[int, bool]` per docstring, test expectations are wrong
- **Action**: Document only, do not modify tests

### 3. Privacy/Feed Tests - Code Bugs - FIXED ✅
- **Decision**: Reused the existing custom privacy model and mirrored its visibility checks only in the SQLite feed clause used by integration tests
- **Root Cause**: feed_service_v2.py visibility_clause only checked author/public fallback rows and skipped custom privacy tables entirely
- **Action**: Extended `visibility_clause` in `feed_service_v2.py` to allow feed visibility for `specific_users`, `followers`, and `following` using `EXISTS` subqueries against the existing schema
- **Status**: FIXED

### 4. Reference Counting Test - FIXED ✅
- **Decision**: Reused the existing deduplication flow instead of creating a second implementation for post variants
- **Root Cause**: `save_post_image_variants()` always created new variant files and never consulted the existing hash lookup path, so duplicate post uploads bypassed deduplication and `force_upload` handling
- **Action**: Added `get_existing_file_by_hash()` to `file_upload_service.py`, reused `check_for_duplicate()` without DB writes, normalized the duplicate/non-duplicate result shape through shared payload assembly, and threaded `force_upload` through the post image upload path
- **Status**: FIXED

### 5. Other Tests - Spec Mismatches or Test Bugs
- **Decision**: Do not modify code for these
- **Reasoning**: Either spec mismatches (test expectations outdated) or test bugs
- **Action**: Document only

---

## Notes

### Cluster Analysis

**Cluster 1: OAuth Bugs (3 tests) - FIXED ✅**
- Root cause: Code bug in oauth.py line 286
- Variable `e` used in `from e` but not defined in that scope
- Fix: Remove `from e` - code change in oauth.py line 286
- Status: ✅ FIXED - All 3 tests pass

**Cluster 2: Follow System (2 tests) - Test Bugs**
- Root cause: Test bugs - mismatched expectations
- Service/repo return booleans, test expects status strings
- Status: ❌ Test bugs - document only

**Cluster 3: Privacy/Feed Visibility (2 tests) - FIXED ✅**
- Root cause: Code bug in feed query (feed_service_v2.py line 403-407)
- The visibility_clause only checks for `public` or `author_id`, not custom privacy rules like `specific_users` or `followers`
- Fix: mirrored the existing privacy service logic in the SQLite feed clause with `EXISTS` checks
- Status: ✅ FIXED

**Cluster 4: Image Hash/Path (2 tests) - Mixed**
- test_store_image_hash_success: Test bug (expects slash, code strips it)
- test_reference_counting_with_duplicate_posts: Code bug - post variants bypassed deduplication, FIXED
- Status: ✅ Phase 2 deduplication fix completed for duplicate post uploads

**Cluster 5: Spec Mismatches (3 tests)**
- test_allowed_origins_parsing: Config doesn't include 8000
- test_create_post_response_structure: Email not returned
- test_create_post_invalid_style_id: Validation not enforced
- Status: ❌ Spec mismatches - document only

**Cluster 6: Share Privacy Test (1 test)**
- test_share_service_privacy_edge_cases: Test bug - post not properly marked private
- Status: ❌ Test bug - document only

---

## Summary

### Fixed Tests (3 tests) ✅
1. test_oauth_callback_token_exchange_failure - oauth.py:286 fixed
2. test_oauth_callback_redirect_uri_mismatch - same fix
3. test_oauth_callback_empty_code - same fix

### Fixed Tests (Phase 2 - 3 tests) ✅
1. test_custom_specific_users_visibility_pipeline - feed visibility now includes custom privacy rules
2. test_custom_followers_and_specific_users_visibility_pipeline - same fix
3. test_reference_counting_with_duplicate_posts - post variant uploads now reuse existing dedup flow

### Test Bugs (4 tests - document only)
1. test_bulk_check_following_success
2. test_bulk_check_following_status_success
3. test_store_image_hash_success
4. test_share_service_privacy_edge_cases

### Spec Mismatches (3 tests - document only)
1. test_allowed_origins_parsing
2. test_create_post_response_structure
3. test_create_post_invalid_style_id

---

## Final Deliverables

### Fixed Tests Count: 6
### Blocked Tests: 0
### Test Bugs: 4
### Spec Mismatches: 3

### Root Cause Clusters:
1. **OAuth variable scope bug** (3 tests) - Fixed
2. **Feed privacy query bug** (2 tests) - Fixed
3. **Follow service return type mismatch** (2 tests) - Test bugs
4. **Image deduplication bug** (1 test) - Fixed
5. **Various test/spec mismatches** (4 tests) - Document only
