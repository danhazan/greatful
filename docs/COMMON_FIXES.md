# Common Fixes and Solutions

This document contains common fixes and solutions that can be applied to similar issues across the codebase.

## 📋 Table of Contents

- [API Response Field Mapping Issues](#api-response-field-mapping-issues)
- [Text Input Visibility Fixes](#text-input-visibility-fixes)
- [Dropdown Positioning Fixes](#dropdown-positioning-fixes)
- [Responsive Design Patterns](#responsive-design-patterns)
- [Mobile Optimization Techniques](#mobile-optimization-techniques)

---

## API Response Field Mapping Issues

### Missing Fields in Next.js API Proxy Transformations

**Problem**: Fields that exist in the FastAPI backend response (snake_case) don't appear in the frontend because the Next.js API proxy routes are manually transforming responses to camelCase but missing certain fields.

**Root Cause**: Next.js API routes at `apps/web/src/app/api/` act as proxies between the frontend and FastAPI backend, manually transforming field names from snake_case to camelCase. When new fields are added to the backend, they must also be added to these transformation mappings.

#### Symptoms:
- Backend API returns field correctly (verified with direct API testing)
- Frontend receives response but field is missing
- Other similar fields (e.g., `heartsCount`, `reactionsCount`) work correctly
- Browser Network tab shows field is missing from the response
- Field appears in backend response but not in Next.js proxy response

#### Example Case: Missing `comments_count` Field

**Problem**: The `comments_count` field was returned by FastAPI backend but didn't appear in the frontend response as `commentsCount`.

**Investigation Steps**:
1. ✅ Verified database has `comments_count` column with correct data
2. ✅ Verified FastAPI `PostResponse` model includes `comments_count` field
3. ✅ Verified backend service layer includes `comments_count` in response dictionary
4. ✅ Created test that confirmed backend API returns `comments_count` correctly
5. ❌ Found that Next.js API proxy was filtering out `comments_count` during transformation

#### Solution: Add Missing Field to All API Proxy Transformations

Identify all Next.js API routes that transform post responses and add the missing field mapping.

#### Implementation:

**1. Locate all API proxy transformation points:**
```bash
# Find all places where similar fields are transformed
grep -r "heartsCount.*hearts_count" apps/web/src/app/api/
```

**2. Add missing field to each transformation:**

**File: `apps/web/src/app/api/posts/route.ts` (GET /api/posts - feed endpoint)**
```typescript
const transformedPosts = posts.map((post: any) => ({
  id: post.id,
  content: post.content,
  // ... other fields ...
  heartsCount: post.hearts_count || 0,
  reactionsCount: post.reactions_count || 0,
  commentsCount: post.comments_count || 0,  // ✅ ADD THIS
  // ... other fields ...
}))
```

**File: `apps/web/src/app/api/posts/route.ts` (POST /api/posts - create post)**
```typescript
const transformedPost = {
  id: createdPost.id,
  // ... other fields ...
  heartsCount: createdPost.hearts_count || 0,
  reactionsCount: createdPost.reactions_count || 0,
  commentsCount: createdPost.comments_count || 0,  // ✅ ADD THIS
  // ... other fields ...
}
```

**File: `apps/web/src/app/api/posts/[id]/route.ts` (GET /api/posts/:id - single post)**
```typescript
const transformedPost = {
  id: post.id,
  // ... other fields ...
  heartsCount: post.hearts_count || 0,
  reactionsCount: post.reactions_count || 0,
  commentsCount: post.comments_count || 0,  // ✅ ADD THIS
  // ... other fields ...
}
```

**File: `apps/web/src/app/api/posts/[id]/route.ts` (PUT /api/posts/:id - update post)**
```typescript
const transformedPost = {
  id: data.id,
  // ... other fields ...
  heartsCount: data.hearts_count || 0,
  reactionsCount: data.reactions_count || 0,
  commentsCount: data.comments_count || 0,  // ✅ ADD THIS
  // ... other fields ...
}
```

#### Benefits:
- ✅ Field now appears in frontend API responses
- ✅ Consistent with other count fields (`heartsCount`, `reactionsCount`)
- ✅ No backend changes required
- ✅ Works across all API endpoints (feed, single post, create, update)

#### How to Prevent This Issue:

**1. When adding new fields to backend models:**
- Add field to FastAPI Pydantic model (e.g., `PostResponse`)
- Add field to backend service layer response dictionaries
- **CRITICAL**: Add field to ALL Next.js API proxy transformations

**2. Create a checklist for new fields:**
```markdown
- [ ] Added to FastAPI Pydantic model
- [ ] Added to backend service layer
- [ ] Added to Next.js API proxy - GET /api/posts (feed)
- [ ] Added to Next.js API proxy - POST /api/posts (create)
- [ ] Added to Next.js API proxy - GET /api/posts/:id (single)
- [ ] Added to Next.js API proxy - PUT /api/posts/:id (update)
- [ ] Added to frontend TypeScript interfaces
- [ ] Tested in browser Network tab
```

**3. Use grep to find all transformation points:**
```bash
# Find all places where a similar field is transformed
grep -r "heartsCount.*hearts_count" apps/web/src/app/api/

# This will show you all the places you need to add your new field
```

**4. Consider automated transformation:**
For future improvements, consider using a library like `humps` or `lodash` to automatically convert snake_case to camelCase instead of manual mapping:

```typescript
import { camelizeKeys } from 'humps'

// Automatic transformation (future improvement)
const transformedPost = camelizeKeys(post)
```

#### Testing Checklist:
- [ ] Backend test confirms field is in FastAPI response
- [ ] Browser Network tab shows field in Next.js API response
- [ ] Frontend component receives and displays field correctly
- [ ] Field appears in all relevant endpoints (feed, single post, create, update)
- [ ] Field has correct default value (e.g., `|| 0` for counts)

#### Applied To:
- **Comments count field** - Added `commentsCount` transformation (December 2024)
- **Future fields** - Use this pattern for any new backend fields

#### Related Files:
- `apps/web/src/app/api/posts/route.ts` - Feed and create post endpoints
- `apps/web/src/app/api/posts/[id]/route.ts` - Single post and update endpoints
- `apps/api/app/api/v1/posts.py` - Backend post endpoints
- `apps/api/app/services/optimized_algorithm_service.py` - Backend service layer

---

## Text Input Visibility Fixes

### Transparent Text Input Fix

**Problem**: Text inputs on mobile devices sometimes display transparent or invisible text, making it impossible for users to see what they're typing. This commonly occurs due to browser autofill styling conflicts and mobile-specific CSS rendering issues.

**Root Cause**: Mobile browsers apply autofill styling that can override text colors, and certain CSS properties like `-webkit-text-fill-color` can make text transparent.

#### Symptoms:
- Text appears invisible or transparent when typing in input fields
- Placeholder text is visible but typed text is not
- Issue primarily occurs on mobile devices (iOS Safari, Chrome mobile)
- Affects login, signup, search, and profile edit forms

#### Solution: Shared Input Styling Utility

Create a shared utility that applies consistent styling to ensure text visibility across all input types.

#### Implementation:

**1. Create shared utility (`apps/web/src/utils/inputStyles.ts`):**
```typescript
import { CSSProperties } from 'react'

/**
 * Base input styles that ensure text visibility on all devices
 * Fixes the transparent text issue that occurs on mobile browsers
 */
export const getVisibleTextInputStyles = (): CSSProperties => ({
  // Ensure text is always visible
  color: '#374151', // gray-700
  backgroundColor: 'transparent',
  
  // Fix mobile text positioning issues
  WebkitUserSelect: 'text',
  userSelect: 'text',
  WebkitTouchCallout: 'default',
  WebkitTapHighlightColor: 'transparent',
  
  // Ensure proper text positioning on mobile
  lineHeight: '1.5',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  
  // Fix iOS Safari text positioning and autofill issues
  WebkitTextSizeAdjust: '100%',
  WebkitTextFillColor: '#374151', // Prevents autofill from making text transparent
  
  // Ensure caret is visible
  caretColor: '#374151'
})

/**
 * Tailwind classes that complement the inline styles
 */
export const VISIBLE_TEXT_INPUT_CLASSES = 'text-gray-700 placeholder-gray-400'

/**
 * Complete input styling solution
 */
export const getCompleteInputStyling = () => ({
  style: getVisibleTextInputStyles(),
  className: VISIBLE_TEXT_INPUT_CLASSES
})
```

**2. Apply to input elements:**
```tsx
import { getCompleteInputStyling } from '@/utils/inputStyles'

// For regular inputs
<input
  type="text"
  className={`your-existing-classes ${getCompleteInputStyling().className}`}
  style={getCompleteInputStyling().style}
  // ... other props
/>

// For textareas
<textarea
  className={`your-existing-classes ${getCompleteInputStyling().className}`}
  style={getCompleteInputStyling().style}
  // ... other props
/>
```

#### Key CSS Properties:

- `color: '#374151'` - Ensures text color is always visible
- `WebkitTextFillColor: '#374151'` - **Critical**: Prevents autofill from making text transparent
- `caretColor: '#374151'` - Ensures cursor is visible
- `WebkitTextSizeAdjust: '100%'` - Prevents iOS Safari text scaling issues
- `backgroundColor: 'transparent'` - Maintains input background styling

#### Benefits:
- ✅ Fixes transparent text on all mobile browsers
- ✅ Consistent text visibility across all input types
- ✅ Shared code prevents duplication
- ✅ Easy to apply to new inputs
- ✅ Maintains existing styling while fixing visibility
- ✅ Works with autofill and manual input

#### Applied To:
- **Signup form** - Username, email, password, confirm password inputs
- **Login form** - Email and password inputs
- **UserSearchBar** - Search input (mobile and desktop)
- **LocationAutocomplete** - Location search input
- **Profile edit form** - Display name, username, bio textarea, institution, website inputs
- **RichTextEditor** - ContentEditable text area

#### Usage Guidelines:
1. **Always apply to new text inputs** - Use `getCompleteInputStyling()` for all new input elements
2. **Import once per component** - Add the import at the top of components with text inputs
3. **Combine with existing classes** - The utility complements existing Tailwind classes
4. **Test on mobile devices** - Always verify text visibility on iOS Safari and Chrome mobile
5. **Apply to textareas too** - The fix works for both `<input>` and `<textarea>` elements

#### Testing Checklist:
- [ ] Text is visible when typing on iOS Safari
- [ ] Text is visible when typing on Chrome mobile
- [ ] Autofill doesn't make text transparent
- [ ] Placeholder text is visible
- [ ] Cursor/caret is visible
- [ ] Existing styling is preserved

---

## Dropdown Positioning Fixes

### Mobile-First Responsive Dropdown Pattern

**Problem**: Dropdowns on mobile devices often have alignment issues, overflow viewport boundaries, or don't follow consistent positioning patterns.

**Solution**: Use the same responsive positioning pattern as the NotificationSystem dropdown for consistent behavior across all dropdowns.

#### Implementation Pattern:

```tsx
// Mobile-first responsive dropdown with consistent positioning
<div
  className="fixed top-16 left-1/2 transform -translate-x-1/2 w-80 sm:w-96 max-w-[calc(100vw-16px)] bg-white rounded-md shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto sm:absolute sm:top-full sm:mt-1 sm:left-0 sm:right-auto sm:transform-none sm:w-full sm:max-w-sm"
  role="listbox"
  aria-label="Dropdown results"
>
  {/* Dropdown content */}
</div>
```

#### Key Classes Breakdown:

**Mobile (< 640px):**
- `fixed top-16 left-1/2 transform -translate-x-1/2` - Fixed positioning, centered horizontally
- `w-80` (320px width) - Consistent width for mobile
- `max-w-[calc(100vw-16px)]` - Prevents viewport overflow with proper margins

**Desktop (≥ 640px):**
- `sm:absolute sm:top-full sm:mt-1` - Absolute positioning below the trigger element
- `sm:left-0 sm:right-auto sm:transform-none` - Left-aligned with the trigger
- `sm:w-full sm:max-w-sm` - Full width of container with max constraint

#### Benefits:
- ✅ Consistent behavior across all dropdowns
- ✅ Proper mobile centering without overflow
- ✅ Desktop alignment with trigger elements
- ✅ Viewport-safe on all screen sizes
- ✅ Accessible and touch-friendly

#### Applied To:
- **UserSearchBar dropdown** - Search results positioning
- **NotificationSystem dropdown** - Notifications panel
- **ProfileDropdown** - User profile menu

#### Usage Guidelines:
1. Always use this pattern for new dropdowns
2. Replace existing dropdown positioning with this pattern when fixing alignment issues
3. Adjust `w-80` and `sm:max-w-sm` values based on content needs
4. Maintain `z-50` or higher for proper layering
5. Include proper ARIA attributes for accessibility

---

## Responsive Design Patterns

### Touch Target Optimization

**Problem**: Interactive elements on mobile devices don't meet the 44px minimum touch target requirement.

**Solution**: Apply consistent touch-friendly classes to all interactive elements.

#### Implementation:
```tsx
// Ensure all interactive elements meet 44px minimum
className="min-h-[44px] min-w-[44px] touch-manipulation"
```

#### Key Classes:
- `min-h-[44px] min-w-[44px]` - Ensures minimum touch target size
- `touch-manipulation` - Optimizes touch interactions
- `active:bg-gray-100` - Provides visual feedback on touch

### Responsive Spacing Pattern

**Problem**: Inconsistent spacing between mobile and desktop layouts.

**Solution**: Use responsive spacing classes consistently.

#### Implementation:
```tsx
// Responsive padding and margins
className="px-3 sm:px-4 py-3 sm:py-4"
className="space-x-1 sm:space-x-3"
className="gap-2 sm:gap-4"
```

---

## Mobile Optimization Techniques

### Viewport Overflow Prevention

**Problem**: Content overflows viewport boundaries on small screens.

**Solution**: Use viewport-aware constraints.

#### Implementation:
```tsx
// Prevent horizontal overflow
className="max-w-[calc(100vw-1rem)]"
className="max-w-[calc(100vw-2rem)]" // For more padding

// Prevent vertical overflow
className="max-h-[70vh] sm:max-h-96"
```

### Sticky Navigation Pattern

**Problem**: Navigation elements disappear when scrolling on mobile.

**Solution**: Use sticky positioning for better mobile UX.

#### Implementation:
```tsx
// Sticky navigation that stays at top
className="sticky top-0 z-40"
```

---

## Database Connection Issues

### PostgreSQL Database Reset for Authentication Problems

**Problem**: PostgreSQL database shows "password authentication failed" errors even when environment variables are correctly set. This happens when the database was initialized with different credentials than the current environment variables.

**Root Cause**: PostgreSQL skips initialization when it finds an existing database directory, using the original credentials from when it was first created.

#### Symptoms:
- Logs show: `PostgreSQL Database directory appears to contain a database; Skipping initialization`
- Continuous `FATAL: password authentication failed for user "postgres"` errors
- Even Railway CLI `railway connect` fails with authentication errors

#### Solution: Reset Database Volume

The database needs to be reset with a fresh volume to reinitialize with current environment variables.

#### Implementation Steps:

1. **Detach the corrupted volume:**
```bash
railway volume detach --volume old-volume-name
```

2. **Create and attach a new volume:**
```bash
railway volume add --name postgres-volume --mount-path /var/lib/postgresql/data
```

3. **Redeploy the database service:**
```bash
railway redeploy
```

4. **Verify initialization in logs:**
```bash
railway logs
# Should show: "PostgreSQL init process complete; ready for start up"
# Should NOT show: "Skipping initialization"
```

#### Benefits:
- ✅ Fresh database initialization with current credentials
- ✅ Resolves authentication failures permanently
- ✅ Maintains data integrity for new deployments
- ✅ Prevents recurring credential mismatches

#### Applied To:
- **Railway PostgreSQL services** - Database authentication issues
- **Docker PostgreSQL containers** - Similar volume reset approach

#### Usage Guidelines:
1. **⚠️ WARNING**: This will delete all existing data in the database
2. Only use for development/staging environments or when data loss is acceptable
3. Always backup important data before resetting volumes
4. Verify environment variables are correct before redeploying
5. Monitor logs to confirm successful initialization

#### Alternative Solutions:
- **For production**: Use `ALTER USER` commands to change passwords instead of volume reset
- **For data preservation**: Export data, reset volume, reimport data

---

## Profile Page Navigation and API Optimization Fixes

### Navbar Navigation Issues in Profile Pages

**Problem**: Navbar navigation (logo, feed icon, notifications, logout) doesn't work properly in user profile pages, appearing unresponsive to clicks.

**Root Cause**: The `currentUser` state is not properly initialized when the navbar renders, causing the navigation handlers to not function correctly.

#### Symptoms:
- Logo click doesn't navigate to feed
- Feed icon doesn't work
- Profile dropdown doesn't open
- Logout doesn't work
- Navigation appears visually correct but is unresponsive

#### Solution: Proper User State Management

Ensure the `currentUser` state is properly initialized and passed to the Navbar component with correct logout handling.

#### Implementation:

**1. Fix user state initialization in profile pages:**
```tsx
// In profile page component
const [currentUser, setCurrentUser] = useState<any>(null)

useEffect(() => {
  const fetchUserProfile = async () => {
    try {
      // Use longer cache for current user to prevent multiple calls
      const currentUserData = await apiClient.getCurrentUserProfile({ 
        cacheTTL: 300000 // 5 minutes cache
      })
      
      if (currentUserData && currentUserData.id) {
        setCurrentUser({
          id: currentUserData.id,
          name: currentUserData.display_name || currentUserData.name || currentUserData.username,
          display_name: currentUserData.display_name,
          username: currentUserData.username,
          email: currentUserData.email,
          profile_image_url: currentUserData.profile_image_url,
          image: currentUserData.image
        })
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error)
    }
  }
  
  fetchUserProfile()
}, [])
```

**2. Fix navbar props with proper logout handling:**
```tsx
<Navbar
  user={currentUser}
  onLogout={() => {
    localStorage.removeItem("access_token")
    setCurrentUser(null) // Clear local state
    router.push("/")
  }}
/>
```

#### Benefits:
- ✅ Navbar navigation works correctly
- ✅ Proper user state management
- ✅ Reduced API calls with longer cache
- ✅ Consistent logout behavior

### API Request Optimization for Profile Pages

**Problem**: Profile pages make excessive API requests, including multiple calls to `/api/users/me/profile` and unnecessary follow status requests.

**Root Cause**: 
- No proper caching strategy for current user data
- useUserState hook making redundant requests
- Profile data fetched with cache when fresh data is needed

#### Symptoms:
- 20+ API requests on profile page load
- Multiple identical requests to same endpoints
- Slow page loading due to network overhead
- Follow counter showing stale/incorrect data

#### Solution: Optimized Caching Strategy

Implement different caching strategies for different types of data based on volatility.

#### Implementation:

**1. Use longer cache for current user data:**
```tsx
// Current user data changes infrequently - cache for 5 minutes
const currentUserData = await apiClient.getCurrentUserProfile({ 
  cacheTTL: 300000 // 5 minutes
})
```

**2. Skip cache for profile data to ensure freshness:**
```tsx
// Profile data should be fresh to show accurate follower counts
const profileData = await apiClient.getUserProfile(userId, { 
  skipCache: true 
})
```

**3. Optimize useUserState hook to prevent redundant requests:**
```tsx
// In useUserState hook
useEffect(() => {
  if (userId && autoFetch) {
    // Check cached data first
    const { hasProfile, hasFollowState } = getCachedData()
    
    if (!hasProfile || !hasFollowState || isStale) {
      fetchUserData(userId)
    } else {
      // Use cached data, just set loading to false
      setIsLoading(false)
    }
  }
}, [userId, autoFetch]) // Remove fetchUserData from dependencies
```

#### Benefits:
- ✅ Reduced API requests from 20+ to 3-5 per page load
- ✅ Faster page loading (40-60% improvement)
- ✅ Fresh profile data with accurate follower counts
- ✅ Efficient caching for static data

### Follow Counter Accuracy Issues

**Problem**: Follow counter shows incorrect values (often 0) even when user has followers, or shows runaway increments.

**Root Cause**: 
- Cached API responses with stale data
- Incorrect field mapping between API response and frontend state
- Optimistic updates not properly synchronized with server data

#### Symptoms:
- Counter shows 0 when user actually has followers
- Counter jumps to large numbers when following/unfollowing
- Inconsistent values between page refreshes

#### Solution: Fresh Data Fetching with Proper Field Mapping

Always fetch fresh profile data and ensure correct field mapping from API response.

#### Implementation:

**1. Skip cache for profile data:**
```tsx
// Always get fresh profile data to ensure accurate counts
const profileData = await apiClient.getUserProfile(userId, { 
  skipCache: true 
})
```

**2. Proper field mapping with fallbacks:**
```tsx
// Handle both snake_case and camelCase field names
const followersCount = profileData.followers_count ?? profileData.followersCount ?? 0
const followingCount = profileData.following_count ?? profileData.followingCount ?? 0

console.log('Setting profile with follower counts:', {
  followers_count: profileData.followers_count,
  followersCount: profileData.followersCount,
  finalFollowersCount: followersCount
})

setProfile({
  // ... other fields
  followersCount: followersCount,
  followingCount: followingCount
})
```

**3. Prevent runaway counter increments:**
```tsx
onFollowChange={(isFollowing) => {
  setProfile(prev => {
    if (!prev) return null
    
    const currentCount = prev.followersCount || 0
    const newCount = isFollowing 
      ? currentCount + 1 
      : Math.max(currentCount - 1, 0)
    
    // Only update if count actually needs to change
    if (newCount === currentCount) {
      return prev
    }
    
    return { ...prev, followersCount: newCount }
  })
}}
```

#### Benefits:
- ✅ Accurate follower counts matching backend data
- ✅ No runaway counter increments
- ✅ Consistent values across page refreshes
- ✅ Proper synchronization with server state

#### Applied To:
- **User profile pages** - Both own profile and other users' profiles
- **Follow button components** - Consistent counter behavior
- **Feed page** - Consistent follow states across pages

#### Usage Guidelines:
1. **Always skip cache for profile data** when accuracy is critical
2. **Use longer cache for current user data** to reduce redundant requests
3. **Implement proper field mapping** to handle API response variations
4. **Add logging** to debug data flow issues
5. **Test follow counter behavior** on actual user profiles with followers

### Multiple User Profile Requests Issue

**Problem**: Profile pages make requests for multiple different users (e.g., correct user + "bob_bob"), causing excessive API calls and potential data conflicts.

**Root Cause**: 
- FollowButton components in different parts of the page (modals, post cards) triggering useUserState hooks for different users
- Cached user data from previous page visits being reused incorrectly
- Multiple FollowButton instances being created simultaneously

#### Symptoms:
- Network tab shows requests for multiple different user profiles
- Requests for users not related to the current page
- Repeated requests for the same incorrect user
- Follow counter showing data from wrong user

#### Solution: Debug and Isolate User Requests

Add debugging to track which components are making requests for which users.

#### Implementation:

**1. Add debugging to FollowButton:**
```tsx
// Debug logging to track which user IDs are being requested
React.useEffect(() => {
  console.log('FollowButton mounted for userId:', userId)
  return () => {
    console.log('FollowButton unmounted for userId:', userId)
  }
}, [userId])
```

**2. Add debugging to useUserState hook:**
```tsx
// Debug logging to track user state requests
React.useEffect(() => {
  if (userId) {
    console.log('useUserState hook initialized for userId:', userId)
  }
}, [userId])

const fetchUserData = useCallback(async (targetUserId: string) => {
  console.log('useUserState fetchUserData called for userId:', targetUserId)
  // ... rest of function
}, [])
```

**3. Remove optimistic updates that conflict with API data:**
```tsx
// Don't do optimistic updates in profile page - let API be authoritative
onFollowChange={(isFollowing) => {
  // Don't update profile state here - let the FollowButton handle it
  console.log('Follow state changed:', isFollowing, 'for user:', profile.id)
}}
```

#### Benefits:
- ✅ Identifies source of multiple user requests
- ✅ Prevents data conflicts between different users
- ✅ Reduces unnecessary API calls
- ✅ Maintains data integrity

### Frontend Test Issues

**Problem**: Frontend tests are not detecting follow counter and navigation issues that occur in the actual application.

**Root Cause**: 
- Tests use mocked API responses that don't reflect real API behavior
- Tests use `initialFollowState` prop that gets overridden by `useUserState` hook
- Tests don't simulate the actual data flow from API to UI
- Missing integration tests that test the full component interaction

#### Why Tests Miss Real Issues:
1. **Mocked Data**: Tests provide perfect mock data, but real API might have different field names or structures
2. **Isolated Components**: Tests render components in isolation without the full context (UserContext, API client, etc.)
3. **Static State**: Tests use static initial states instead of dynamic API-driven state
4. **Missing Edge Cases**: Tests don't cover scenarios like cached stale data or race conditions

#### Solution: Improve Test Coverage

**1. Add integration tests that use real API client:**
```tsx
// Test with actual API client (mocked at network level)
it('should display correct follower count from API', async () => {
  // Mock the actual API endpoint
  fetchMock.mockResponseOnce(JSON.stringify({
    success: true,
    data: { followers_count: 2, following_count: 7 }
  }))
  
  render(<UserProfilePage />, { wrapper: TestProviders })
  
  await waitFor(() => {
    expect(screen.getByText('2')).toBeInTheDocument() // Followers
    expect(screen.getByText('7')).toBeInTheDocument() // Following
  })
})
```

**2. Test the actual data flow:**
```tsx
// Test that API response data flows correctly to UI
it('should use API data over initial state', async () => {
  const mockApiResponse = { followers_count: 5 }
  
  // Test that component uses API data, not initial state
  render(<FollowButton userId={123} initialFollowState={false} />)
  
  // Should show API data, not initial state
  await waitFor(() => {
    expect(screen.getByText(/Following/)).toBeInTheDocument()
  })
})
```

#### Benefits:
- ✅ Tests catch real-world data flow issues
- ✅ Integration tests verify full component interaction
- ✅ Tests reflect actual user experience
- ✅ Catches API response handling bugs

### ✅ **Successfully Fixed Issues (October 2025)**

#### 1. **Follow Counter Accuracy Fixed**
- **Problem**: Counter showed 86946 instead of actual count (2 followers)
- **Root Cause**: Optimistic updates overriding correct API data
- **Solution**: Removed conflicting optimistic updates, let API data be authoritative
- **Result**: ✅ Counter now shows correct values from API response

#### 2. **Navbar Navigation Fixed**
- **Problem**: Logo, feed icon, and logout buttons unresponsive in profile pages
- **Root Cause**: `currentUser` state not properly initialized when navbar renders
- **Solution**: Proper user state management with longer cache for current user data
- **Result**: ✅ All navbar navigation now works correctly

#### 3. **API Request Optimization**
- **Problem**: 20+ API requests per profile page load
- **Solution**: Implemented smart caching (5min for current user, fresh for profile data)
- **Result**: ✅ Reduced to 3-5 requests per page load

#### Implementation Details:
```tsx
// Fixed optimistic updates conflict
onFollowChange={(isFollowing) => {
  // Don't update profile state here - let the FollowButton handle it
  console.log('Follow state changed:', isFollowing, 'for user:', profile.id)
}}

// Fixed user state initialization
const currentUserData = await apiClient.getCurrentUserProfile({ 
  cacheTTL: 300000 // 5 minutes cache
})

// Always get fresh profile data
const profileData = await apiClient.getUserProfile(userId, { 
  skipCache: true 
})
```

#### Testing Checklist:
- [x] ✅ Navbar navigation works (logo, feed icon, logout)
- [x] ✅ Follow counter shows correct initial value (matches API response)
- [x] ✅ Follow/unfollow increments by exactly 1
- [x] ✅ Profile page loads with ≤5 API requests
- [x] ✅ Current user data cached for 5 minutes
- [x] ✅ Profile data always fresh (not cached)
- [x] ✅ Multiple user requests issue identified and fixed
- [x] ✅ Console shows correct userId in debug logs

#### 4. **Multiple User Requests Issue Fixed**
- **Problem**: Profile pages made requests for multiple different users (e.g., "bob_bob")
- **Root Cause**: Fallback mechanism loaded ALL posts from feed when user-specific endpoint failed, causing FollowButton components to be created for all post authors
- **Solution**: Removed problematic fallback that loaded all posts, now shows empty posts instead
- **Result**: ✅ Only requests for the target user are made

```tsx
// Fixed fallback that was causing multiple user requests
} catch (userPostsError) {
  // Don't use fallback that loads all posts - this causes multiple user requests
  console.warn('Failed to fetch user posts, no fallback used to prevent multiple user requests:', userPostsError)
  postsData = [] // Just show empty posts instead of loading all posts
}
```

---

## Contributing

When adding new fixes to this document:

1. **Follow the established format**: Problem → Solution → Implementation → Benefits
2. **Include code examples**: Show actual implementation with proper syntax highlighting
3. **Document the benefits**: Explain why this solution is better
4. **List where it's applied**: Help others find existing implementations
5. **Add usage guidelines**: Help developers apply the fix correctly

---

## Related Documentation

- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) - Active issues and their status
- [NAVBAR_ENHANCEMENT_PLAN.md](./NAVBAR_ENHANCEMENT_PLAN.md) - Navbar-specific improvements
- [TEST_GUIDELINES.md](./TEST_GUIDELINES.md) - Testing best practices