# API Response Casing Analysis

## Current State (December 2024)

### Overview
The project currently has **inconsistent casing** between different API endpoints:
- Some endpoints return **camelCase** (transformed by Next.js API routes)
- Some endpoints return **snake_case** (passthrough from FastAPI backend)

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

## Current Status

### Endpoints Using Manual Transformation (camelCase)
- ✅ `GET /api/posts` (feed)
- ✅ `POST /api/posts` (create post)
- ✅ `GET /api/posts/:id` (single post)
- ✅ `PUT /api/posts/:id` (update post)

### Endpoints Using Passthrough (snake_case)
- ❌ `GET /api/users/me/posts` (user's own posts)
- ❌ `GET /api/users/me/profile` (user's own profile)
- ❌ `GET /api/users/:userId/posts` (other user's posts)
- ❌ `GET /api/users/:userId/profile` (other user's profile)
- ❌ Most other user-related endpoints

### Impact
- **Feed page**: ✅ Works correctly (uses transformed endpoints)
- **Profile pages**: ❌ Shows 0 comments (uses passthrough endpoints)
- **User posts**: ❌ Inconsistent data structure

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

## Next Steps

1. **Immediate**: Fix profile pages by adding transformation to user posts endpoints
2. **Short-term**: Implement shared transformation utility
3. **Long-term**: Apply transformation to all endpoints and remove manual mappings

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
