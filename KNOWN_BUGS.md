# Known Bugs

This document tracks known bugs that need to be fixed.

## Bug #1: CreatePostModal Footer Alignment Issue

**Status:** Open  
**Priority:** Medium  
**Component:** `apps/web/src/components/CreatePostModal.tsx`  

**Description:**
The footer elements in the CreatePostModal are not properly aligned within the modal container. The "Draft saved automatically" text, "Cancel" and "Share Gratitude" buttons appear to be outside or misaligned with the modal box.

**Expected Behavior:**
- All footer elements should be contained within the modal box
- Buttons should be properly aligned
- The spacing line above the footer should be removed to make more space

**Current Behavior:**
- Footer elements appear misaligned or outside the modal container
- Poor visual hierarchy and spacing

**Steps to Reproduce:**
1. Open the feed page
2. Click the floating "+" button to create a post
3. Observe the modal footer alignment

**Related Files:**
- `apps/web/src/components/CreatePostModal.tsx`

**Notes:**
- Attempted fix by removing border-t and adjusting padding, but issue persists
- May need to review the overall modal structure and CSS classes

---

## Bug #2: User Profile Posts Not Displaying

**Status:** Open  
**Priority:** High  
**Component:** `apps/web/src/app/profile/[userId]/page.tsx`  

**Description:**
When navigating to another user's profile page, the posts section shows "No posts yet" even when the user has posts (as indicated by the posts count showing "3").

**Expected Behavior:**
- User's posts should be displayed in the posts section
- Posts should be fetched from the API and rendered properly

**Current Behavior:**
- Posts section shows empty state despite posts count being > 0
- API may not be returning posts or posts are not being processed correctly

**Steps to Reproduce:**
1. Go to feed page
2. Click on another user's profile picture or name
3. Navigate to their profile page
4. Observe that posts section shows "No posts yet" despite posts count showing a number > 0

**Related Files:**
- `apps/web/src/app/profile/[userId]/page.tsx`
- `apps/web/src/app/api/users/[userId]/posts/route.ts`

**Notes:**
- Profile information loads correctly (username, bio, posts count)
- Issue seems to be specifically with posts fetching or rendering
- Need to debug API response and frontend processing

---

*Last Updated: January 8, 2025*