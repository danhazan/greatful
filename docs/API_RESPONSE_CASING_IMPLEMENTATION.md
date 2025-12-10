# API Response Casing Implementation

## Implementation Complete (December 2024)

### Overview
The project has **standardized on camelCase** for all API responses:
- All endpoints now return **camelCase** (transformed by Next.js API routes using humps library)
- Backend continues to use **snake_case** (Python convention)
- Automatic transformation layer handles the conversion

### Backend (FastAPI)
- **Standard**: snake_case (Python convention)
- All Pydantic models use snake_case field names
- Examples: `comments_count`, `hearts_count`, `reactions_count`, `created_at`, `profile_image_url`

### Frontend (Next.js/React)
- **Standard**: camelCase (JavaScript/TypeScript convention)
- React components expect camelCase
- Examples: `commentsCount`, `heartsCount`, `reactionsCount`, `createdAt`, `profileImageUrl`

---

## Current Implementation Patterns

### Pattern 1: Manual Transformation (Posts Endpoints)
**Files**: 
- `apps/web/src/app/api/posts/route.ts`
- `apps/web/src/app/api/posts/[id]/route.ts`

**Behavior**: Next.js API routes manually transform backend responses from snake_case to camelCase

**Example**:
```typescript
// Backend returns: { hearts_count: 5, reactions_count: 3, comments_count: 2 }
// Next.js transforms to: { heartsCount: 5, reactionsCount: 3, commentsCount: 2 }

const transformedPost = {
  heartsCount: post.hearts_count || 0,
  reactionsCount: post.reactions_count || 0,
  commentsCount: post.comments_count || 0,
  // ... other fields
}
```

**Pros**:
- ✅ Frontend receives idiomatic camelCase
- ✅ Type-safe transformations
- ✅ Can add/modify fields during transformation

**Cons**:
- ❌ Manual mapping required for every field
- ❌ Easy to forget fields (like `comments_count` was initially missing)
- ❌ Maintenance burden when adding new fields
- ❌ Duplication across multiple endpoints

---

### Pattern 2: Passthrough Proxy (User/Profile Endpoints)
**Files**:
- `apps/web/src/lib/api-proxy.ts`
- `apps/web/src/app/api/users/me/posts/route.ts`
- `apps/web/src/app/api/users/me/profile/route.ts`
- `apps/web/src/app/api/users/[userId]/posts/route.ts`

**Behavior**: Next.js API routes pass through backend responses unchanged

**Example**:
```typescript
// Backend returns: { hearts_count: 5, reactions_count: 3, comments_count: 2 }
// Frontend receives: { hearts_count: 5, reactions_count: 3, comments_count: 2 }

return proxyApiRequest(request, `/api/v1/users/me/posts`, { 
  requireAuth: true 
})
```

**Pros**:
- ✅ No manual mapping needed
- ✅ Automatic inclusion of all fields
- ✅ Less code to maintain
- ✅ Faster to implement

**Cons**:
- ❌ Frontend receives snake_case (not idiomatic JavaScript)
- ❌ Requires frontend normalization utilities
- ❌ Inconsistent with transformed endpoints

---

## Frontend Normalization Layer

To handle the inconsistency, the frontend has normalization utilities:

**File**: `apps/web/src/utils/normalizePost.ts`

```typescript
export function normalizePostFromApi(apiResponse: any): NormalizedPost | null {
  const post: ApiPost = apiResponse.data ?? apiResponse

  return {
    // Handles both snake_case and camelCase
    heartsCount: post.hearts_count ?? post.heartsCount ?? 0,
    reactionsCount: post.reactions_count ?? post.reactionsCount ?? 0,
    commentsCount: post.comments_count ?? post.commentsCount ?? 0,
    createdAt: post.created_at ?? post.createdAt ?? new Date().toISOString(),
    // ... other fields
  }
}
```

**Pros**:
- ✅ Handles both casing styles
- ✅ Provides fallback values
- ✅ Single source of truth for post normalization

**Cons**:
- ❌ Must be called manually in components
- ❌ Easy to forget to use
- ❌ Doesn't solve the root inconsistency

---

## Issues Caused by Inconsistency

### Issue 1: Missing Fields in Transformed Endpoints
**Problem**: When adding new fields to backend, they must be manually added to transformation mappings

**Example**: `comments_count` was added to backend but missing from Next.js transformations
- Backend returned: `comments_count: 5`
- Next.js transformed to: `{ heartsCount: 0, reactionsCount: 0 }` (missing commentsCount!)
- Frontend showed: 0 comments

**Solution**: Added `commentsCount: post.comments_count || 0` to all 4 transformation points

### Issue 2: Profile Pages Show 0 Comments
**Problem**: Profile endpoints use passthrough proxy, returning snake_case
- Backend returns: `comments_count: 5`
- Frontend expects: `commentsCount: 5`
- Frontend shows: 0 (because it looks for `commentsCount` but receives `comments_count`)

**Current State**: Not yet fixed

---

## Recommended Solutions

### Option 1: Standardize on camelCase (Recommended)
**Approach**: Transform ALL API responses to camelCase at the Next.js API layer

**Implementation**:
1. Create a shared transformation utility
2. Apply to all API routes (including passthrough proxies)
3. Remove frontend normalization utilities

**Pros**:
- ✅ Consistent camelCase across entire frontend
- ✅ Idiomatic JavaScript/TypeScript
- ✅ No frontend normalization needed
- ✅ Type-safe with TypeScript interfaces

**Cons**:
- ❌ Requires updating all API routes
- ❌ Ongoing maintenance when adding fields

**Example Implementation**:
```typescript
// apps/web/src/lib/caseTransform.ts
import { camelizeKeys } from 'humps'

export function transformApiResponse<T>(data: any): T {
  return camelizeKeys(data) as T
}

// Usage in API routes
const posts = await fetch(`${API_BASE_URL}/api/v1/users/me/posts`)
const data = await posts.json()
return NextResponse.json(transformApiResponse(data))
```

---

### Option 2: Standardize on snake_case
**Approach**: Remove transformations, use snake_case everywhere

**Implementation**:
1. Remove manual transformations from posts endpoints
2. Update frontend TypeScript interfaces to use snake_case
3. Update all React components to use snake_case

**Pros**:
- ✅ No transformation layer needed
- ✅ Direct passthrough from backend
- ✅ Consistent with backend

**Cons**:
- ❌ Not idiomatic JavaScript/TypeScript
- ❌ Requires updating ALL frontend code
- ❌ Goes against JavaScript conventions
- ❌ Harder to read in frontend code

**Not Recommended**: This goes against JavaScript/TypeScript conventions

---

### Option 3: Keep Current Hybrid Approach (Not Recommended)
**Approach**: Continue with mixed casing, rely on normalization utilities

**Implementation**:
1. Fix missing fields in transformations
2. Ensure normalization utilities handle both cases
3. Document which endpoints use which casing

**Pros**:
- ✅ No major refactoring needed
- ✅ Works with existing code

**Cons**:
- ❌ Inconsistent and confusing
- ❌ Easy to introduce bugs
- ❌ Requires constant vigilance
- ❌ Poor developer experience

**Not Recommended**: This is the current state and causes ongoing issues

---

## Recommended Action Plan

### Phase 1: Fix Immediate Issues (High Priority)
1. ✅ **DONE**: Add `commentsCount` to posts endpoint transformations
2. **TODO**: Add transformation to user posts endpoints
3. **TODO**: Add transformation to profile endpoints
4. **TODO**: Test all endpoints return consistent camelCase

### Phase 2: Standardize Transformation (Medium Priority)
1. Create shared transformation utility using `humps` library
2. Apply to all API routes
3. Remove manual field-by-field transformations
4. Update tests

### Phase 3: Cleanup (Low Priority)
1. Remove frontend normalization utilities (no longer needed)
2. Update TypeScript interfaces to only use camelCase
3. Remove snake_case fallbacks from components
4. Update documentation

---

## Implementation Guide

### Step 1: Install humps library
```bash
npm install humps
npm install --save-dev @types/humps
```

### Step 2: Create shared transformation utility
```typescript
// apps/web/src/lib/caseTransform.ts
import { camelizeKeys, decamelizeKeys } from 'humps'

/**
 * Transform API response from snake_case to camelCase
 */
export function transformApiResponse<T = any>(data: any): T {
  if (!data) return data
  return camelizeKeys(data, (key, convert) => {
    // Don't transform specific keys if needed
    // For example, keep 'oauth_provider' as is
    return convert(key)
  }) as T
}

/**
 * Transform request data from camelCase to snake_case
 */
export function transformApiRequest<T = any>(data: any): T {
  if (!data) return data
  return decamelizeKeys(data) as T
}
```

### Step 3: Update API proxy
```typescript
// apps/web/src/lib/api-proxy.ts
import { transformApiResponse } from './caseTransform'

export async function proxyApiRequest(
  request: any, 
  backendPath: string, 
  opts: ProxyOptions & { transform?: boolean } = {}
) {
  const { transform = true, ...proxyOpts } = opts
  
  // ... existing proxy logic ...
  
  const respText = await resp.text()
  const respData = JSON.parse(respText)
  
  // Transform response if requested
  const finalData = transform ? transformApiResponse(respData) : respData
  
  return new NextResponse(JSON.stringify(finalData), {
    status: resp.status,
    headers: { "content-type": "application/json" },
  })
}
```

### Step 4: Update posts endpoints
```typescript
// apps/web/src/app/api/posts/route.ts
import { transformApiResponse } from '@/lib/caseTransform'

// Replace manual transformation with:
const transformedPosts = transformApiResponse(posts)
return NextResponse.json(transformedPosts)
```

### Step 5: Test thoroughly
- Test all API endpoints return camelCase
- Test all components receive correct data
- Test edge cases (null values, nested objects, arrays)

---

## Current Status (Updated: December 2024)

### ✅ IMPLEMENTATION COMPLETE

All API endpoints now use automated snake_case to camelCase transformation via the `humps` library.

**Latest Updates (December 8, 2024):**
- Fixed remaining endpoints that were missing transformation:
  - `/api/users/validate-batch` - Now returns `validUsernames` instead of `valid_usernames`
  - `/api/follows/{userId}/status` - Now returns `isFollowing`, `followStatus`, etc.
  - `/api/follows/{userId}` - POST/DELETE now transform responses
  - `/api/posts/update-feed-view` - Now transforms response
- Updated frontend components to handle camelCase responses:
  - `PostCard.tsx` - Updated to use `validUsernames`
  - `FollowButton.tsx` - Updated interface to use camelCase
  - `useUserState.ts` - Updated to handle `isFollowing` (with fallback for compatibility)

### Implemented Changes

1. **Shared Transformation Utility** (`apps/web/src/lib/caseTransform.ts`)
   - ✅ Created `transformApiResponse<T>()` using `camelizeKeys` from humps
   - ✅ Created `transformApiRequest<T>()` using `decamelizeKeys` for request payloads
   - ✅ Handles nested objects and arrays automatically

2. **API Proxy Enhancement** (`apps/web/src/lib/api-proxy.ts`)
   - ✅ Added `transform?: boolean` option (default: true)
   - ✅ Automatically transforms all passthrough responses to camelCase
   - ✅ Maintains backward compatibility with `transform: false` option

3. **Posts Endpoints** (Manual → Automated)
   - ✅ `GET /api/posts` (feed) - Now uses automated transformation
   - ✅ `POST /api/posts` (create post) - Now uses automated transformation
   - ✅ `GET /api/posts/:id` (single post) - Now uses automated transformation
   - ✅ `PUT /api/posts/:id` (update post) - Now uses automated transformation

4. **User Posts Endpoints** (Passthrough → Automated)
   - ✅ `GET /api/users/me/posts` - Now uses automated transformation
   - ✅ `GET /api/users/:userId/posts` - Now uses automated transformation
   - ✅ All other user-related endpoints using `proxyApiRequest` - Automatically transformed

5. **Frontend Utilities Updated**
   - ✅ `apps/web/src/utils/normalizePost.ts` - Simplified to remove snake_case fallbacks
   - ✅ TypeScript interfaces updated to only use camelCase
   - ✅ Removed dual-casing support

### Benefits Achieved
- ✅ Consistent camelCase across entire frontend
- ✅ No manual field mapping needed
- ✅ Automatic inclusion of new backend fields
- ✅ Idiomatic JavaScript/TypeScript code
- ✅ Reduced maintenance burden
- ✅ Profile pages now show correct comment counts
- ✅ All endpoints return consistent data structure

### Impact
- **Feed page**: ✅ Works correctly with automated transformation
- **Profile pages**: ✅ Now shows correct comments and all engagement data
- **User posts**: ✅ Consistent camelCase data structure
- **All API endpoints**: ✅ Automatically transformed to camelCase

---

## Decision Required

**Question for Team**: Which approach should we take?

1. **Option 1 (Recommended)**: Standardize on camelCase with automated transformation
   - Effort: Medium (1-2 days)
   - Benefit: High (consistent, maintainable, idiomatic)

2. **Option 2**: Standardize on snake_case
   - Effort: High (3-5 days)
   - Benefit: Low (not idiomatic JavaScript)

3. **Option 3**: Keep hybrid approach
   - Effort: Low (ongoing)
   - Benefit: None (continues current issues)

**Recommendation**: Implement Option 1 (camelCase with automated transformation)

---

## Implementation Notes

### Usage Guidelines for Future Development

1. **New API Endpoints**: All new API endpoints automatically receive camelCase transformation via `proxyApiRequest`
2. **Disabling Transformation**: If needed, pass `transform: false` to `proxyApiRequest` options
3. **Request Payloads**: Use `transformApiRequest()` when sending camelCase data to snake_case backend
4. **TypeScript Interfaces**: Always use camelCase in frontend interfaces

### Example: Creating a New API Endpoint

```typescript
// apps/web/src/app/api/new-endpoint/route.ts
import { proxyApiRequest } from '@/lib/api-proxy'

export async function GET(request: NextRequest) {
  // Automatically transforms snake_case to camelCase
  return proxyApiRequest(request, '/api/v1/backend-endpoint', {
    requireAuth: true,
    transform: true  // default, can be omitted
  })
}
```

### Example: Sending Request Data

```typescript
import { transformApiRequest } from '@/lib/caseTransform'

const requestData = {
  heartsCount: 5,
  createdAt: new Date().toISOString()
}

// Transform to snake_case for backend
const backendData = transformApiRequest(requestData)
// Result: { hearts_count: 5, created_at: "..." }
```

## Next Steps

✅ **COMPLETED**: All planned implementation steps have been completed
- Shared transformation utility implemented
- All endpoints using automated transformation
- Manual mappings removed
- Documentation updated

---

## Related Files

### Backend
- `apps/api/app/api/v1/posts.py` - Posts endpoints (snake_case)
- `apps/api/app/api/v1/users.py` - User endpoints (snake_case)
- `apps/api/app/models/*.py` - All models use snake_case

### Frontend API Routes
- `apps/web/src/app/api/posts/route.ts` - Manual transformation
- `apps/web/src/app/api/posts/[id]/route.ts` - Manual transformation
- `apps/web/src/lib/api-proxy.ts` - Passthrough proxy
- `apps/web/src/lib/user-posts-api.ts` - Uses passthrough

### Frontend Utilities
- `apps/web/src/utils/normalizePost.ts` - Handles both casings
- `apps/web/src/utils/userDataMapping.ts` - User data normalization

### Documentation
- `docs/COMMON_FIXES.md` - Documents the comments_count fix
