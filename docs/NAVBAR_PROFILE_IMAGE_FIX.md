# Navbar Profile Image Fix

## Problem
Profile pictures were not displaying in the navbar dropdown — only initials were shown, even when `profile_image_url` existed in the backend response.

## Root Cause
The issue was a data normalization mismatch between different parts of the application:

1. **Notifications system** (working): Normalized `profile_image_url` → `image` in the API response
2. **Navbar system** (broken): Used raw `/api/users/me/profile` response where only `profile_image_url` existed
3. **UserAvatar component**: Checked `user.image` first, but this field wasn't available from the profile API

## Solution

### 1. Created User Data Normalization Utility
- **File**: `apps/web/src/utils/userDataMapping.ts`
- **Purpose**: Consistent field normalization across all user API responses
- **Key function**: `normalizeUserData()` maps `profile_image_url` → `image`

### 2. Updated API Routes
Updated the following API routes to use normalization:
- `apps/web/src/lib/user-profile-api.ts` - Profile endpoints (`/me/profile`, `/users/{id}/profile`)
- `apps/web/src/app/api/users/by-username/[username]/route.ts` - Username lookup
- `apps/web/src/app/api/users/search/route.ts` - User search

### 3. Fixed UserAvatar Component Structure
- **File**: `apps/web/src/components/UserAvatar.tsx`
- **Change**: Wrapped `<img>` in container with `overflow-hidden` and `w-full h-full` classes
- **Reason**: Match the working `ClickableProfilePicture` component structure

## Technical Details

### Before (Broken)
```typescript
// UserAvatar.tsx - Direct img rendering
const avatarContent = profileImageUrl && !imageError ? (
  <img
    src={profileImageUrl}
    className={`${sizeClasses[size]} rounded-full object-cover`}
    // ...
  />
) : (
  <div className={`${sizeClasses[size]} rounded-full bg-purple-600`}>
    {initials}
  </div>
)

// API Response - No image field
{
  "id": 123,
  "username": "Bob3",
  "profile_image_url": "https://cdn.example.com/profiles/bob3.jpg"
  // ❌ No "image" field
}
```

### After (Fixed)
```typescript
// UserAvatar.tsx - Container-wrapped img
const avatarContent = profileImageUrl && !imageError ? (
  <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-100`}>
    <img
      src={profileImageUrl}
      className="w-full h-full object-cover object-center"
      // ...
    />
  </div>
) : (
  <div className={`${sizeClasses[size]} rounded-full bg-purple-600`}>
    {initials}
  </div>
)

// API Response - Normalized data
{
  "id": 123,
  "username": "Bob3",
  "profile_image_url": "https://cdn.example.com/profiles/bob3.jpg",
  "image": "https://cdn.example.com/profiles/bob3.jpg", // ✅ Normalized
  "name": "Bob3"
}
```

## Testing
- ✅ All UserAvatar component tests pass
- ✅ All API route tests pass
- ✅ Backend integration tests pass
- ✅ User data normalization utility tests pass

## Expected Result
- Navbar dropdown shows real profile pictures instead of initials
- Behavior is consistent with notifications system
- Fallback to initials only when no valid image URL is available
- All existing functionality preserved

## Files Changed
1. `apps/web/src/utils/userDataMapping.ts` - New normalization utility
2. `apps/web/src/lib/user-profile-api.ts` - Added normalization to profile API
3. `apps/web/src/app/api/users/by-username/[username]/route.ts` - Added normalization
4. `apps/web/src/app/api/users/search/route.ts` - Added normalization
5. `apps/web/src/components/UserAvatar.tsx` - Fixed image container structure
6. `apps/web/src/tests/utils/userDataMapping.test.ts` - New tests for normalization