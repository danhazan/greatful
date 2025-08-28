# Console Error Fix Summary

## Problem
The feed page was showing multiple console errors like:
```
GET http://localhost:3000/api/users/username/Bob7%3F%3F 404 (Not Found)
```

## Root Cause
The mention regex was too permissive, allowing special characters like `?`, `!`, `+` in usernames:
```javascript
// OLD (problematic)
/@([a-zA-Z0-9_\-\.\?\!\+]+)/g
```

This caused extraction of invalid usernames like:
- `@Bob7??` → extracted `Bob7??` 
- `@user+name` → extracted `user+name`
- `@test!user` → extracted `test!user`

These invalid usernames were then validated against the API, causing 404 errors.

## Solution
1. **Restricted the regex** to only match realistic username patterns:
   ```javascript
   // NEW (fixed)
   /@([a-zA-Z0-9_\-\.]+)/g
   ```

2. **Added validation filter** in PostCard to prevent API calls for invalid usernames:
   ```javascript
   const validFormatUsernames = usernames.filter(isValidUsername)
   ```

3. **Updated validation function** to match the new regex:
   ```javascript
   const usernameRegex = /^[a-zA-Z0-9_\-\.]{1,50}$/
   ```

## What Changed
- **Allowed characters**: letters, numbers, underscores, dots, dashes
- **Removed support for**: `?`, `!`, `+`, `@`, spaces, and other special characters
- **Added client-side validation** to prevent unnecessary API calls

## Result
- ✅ No more console 404 errors for invalid usernames
- ✅ Only realistic usernames are validated against the API
- ✅ Valid usernames like `alice.doe-123`, `user_name`, `Bob7` still work
- ✅ All tests pass

## Files Modified
- `apps/web/src/utils/mentionUtils.ts` - Updated regex and validation
- `apps/web/src/components/PostCard.tsx` - Added validation filter
- `apps/web/src/tests/utils/mentionUtils.special-chars.test.ts` - Updated tests

The fix prevents extraction of invalid usernames that don't exist in the database, eliminating the console errors while maintaining support for all realistic username patterns.