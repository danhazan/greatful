# UI/UX Guidelines

## Overview

This document outlines the user interface and user experience guidelines for the Grateful platform. It covers design principles, component patterns, navigation flows, and interaction guidelines that ensure a consistent and intuitive user experience across the application.

## Table of Contents

- [Design Principles](#design-principles)
- [Visual Design System](#visual-design-system)
- [Navigation Patterns](#navigation-patterns)
- [Modal Design Guidelines](#modal-design-guidelines)
- [Mobile Optimization](#mobile-optimization)
- [Accessibility Guidelines](#accessibility-guidelines)
- [Interaction Patterns](#interaction-patterns)
- [Error Handling UX](#error-handling-ux)

---

## Design Principles

### Core Values

1. **Positivity First**: Every interaction should reinforce positive emotions and gratitude
2. **Simplicity**: Clean, uncluttered interfaces that focus on content
3. **Accessibility**: Inclusive design that works for all users
4. **Mobile-First**: Optimized for mobile devices with desktop enhancements
5. **Consistency**: Predictable patterns and behaviors throughout the app

### User Experience Goals

- **Encourage Daily Gratitude**: Make posting gratitude quick and rewarding
- **Foster Community**: Enable meaningful connections between users
- **Reduce Friction**: Minimize steps required for common actions
- **Provide Feedback**: Clear confirmation for all user actions
- **Maintain Context**: Users should always know where they are and how to navigate

---

## Visual Design System

### Color Palette

**Primary Colors:**
- **Purple Primary**: `#7C3AED` - Main brand color for buttons, links, and accents
- **Purple Secondary**: `#A855F7` - Hover states and secondary elements
- **Purple Light**: `#DDD6FE` - Background highlights and subtle accents

**Semantic Colors:**
- **Success Green**: `#10B981` - Success messages, confirmations
- **Warning Orange**: `#F59E0B` - Warnings, cautions
- **Error Red**: `#EF4444` - Errors, destructive actions
- **Info Blue**: `#3B82F6` - Information, neutral actions

**Neutral Colors:**
- **Gray 900**: `#111827` - Primary text
- **Gray 700**: `#374151` - Secondary text
- **Gray 500**: `#6B7280` - Tertiary text, placeholders
- **Gray 200**: `#E5E7EB` - Borders, dividers
- **Gray 100**: `#F3F4F6` - Background highlights
- **Gray 50**: `#F9FAFB` - Light backgrounds

### Typography

**Font Family**: System font stack for optimal performance and readability
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif
```

**Text Hierarchy:**
- **Heading 1**: `text-2xl font-bold` (24px, 700 weight)
- **Heading 2**: `text-xl font-semibold` (20px, 600 weight)
- **Heading 3**: `text-lg font-semibold` (18px, 600 weight)
- **Body Large**: `text-base` (16px, 400 weight)
- **Body**: `text-sm` (14px, 400 weight)
- **Caption**: `text-xs` (12px, 400 weight)

### Spacing System

**Consistent spacing using Tailwind CSS scale:**
- **xs**: `0.25rem` (4px)
- **sm**: `0.5rem` (8px)
- **base**: `1rem` (16px)
- **lg**: `1.5rem` (24px)
- **xl**: `2rem` (32px)
- **2xl**: `3rem` (48px)

### Border Radius

- **Small**: `rounded` (4px) - Buttons, inputs
- **Medium**: `rounded-lg` (8px) - Cards, modals
- **Large**: `rounded-xl` (12px) - Large containers
- **Full**: `rounded-full` - Avatars, pills

---

## Navigation Patterns

### Primary Navigation

**Navbar Structure:**
- **Logo**: Purple heart emoji (💜) with "Grateful" text
- **Navigation Links**: Feed, Profile, Notifications
- **User Actions**: Create post, notifications bell, user menu

**Navigation Behavior:**
- **Active States**: Clear indication of current page
- **Responsive**: Collapses to hamburger menu on mobile
- **Persistent**: Always visible for easy navigation

### Profile Navigation Patterns

#### Clickable User Elements

Throughout the application, user-related elements are consistently clickable and lead to user profiles:

**1. Post Author Navigation:**
```typescript
// In PostCard component
<div 
  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition-colors"
  onClick={() => navigateToProfile(post.author.id)}
>
  <ProfilePhotoDisplay photoUrl={post.author.image} />
  <div>
    <p className="font-semibold">{post.author.display_name}</p>
    <p className="text-sm text-gray-500">@{post.author.username}</p>
  </div>
</div>
```

**2. User List Navigation:**
```typescript
// In UserListItem component (used in followers/following modals)
<UserListItem
  user={user}
  onClick={() => window.location.href = `/profile/${user.id}`}
  className="hover:bg-gray-50 cursor-pointer"
/>
```

**3. Mention Navigation:**
```typescript
// In post content with mentions
<span 
  className="text-purple-600 hover:text-purple-800 cursor-pointer font-medium"
  onClick={() => navigateToProfile(mentionedUser.id)}
>
  @{mentionedUser.username}
</span>
```

#### Profile Metrics Navigation

**Followers/Following Metrics:**
- **Clickable Counts**: Follower and following counts open respective modals
- **Modal Navigation**: Users in modals are clickable to navigate to profiles
- **Breadcrumb Context**: Clear indication of whose followers/following are being viewed

```typescript
// Profile metrics with modal triggers
<div className="flex space-x-4">
  <button 
    onClick={() => setShowFollowers(true)}
    className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors"
  >
    <p className="font-semibold">{user.followers_count}</p>
    <p className="text-sm text-gray-500">Followers</p>
  </button>
  
  <button 
    onClick={() => setShowFollowing(true)}
    className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors"
  >
    <p className="font-semibold">{user.following_count}</p>
    <p className="text-sm text-gray-500">Following</p>
  </button>
</div>
```

**Posts Metric Navigation:**
- **Clickable Posts Count**: Scrolls smoothly to user's posts section
- **Visual Feedback**: Smooth scroll animation with focus indication
- **Context Preservation**: Maintains user's position context after scroll

```typescript
// Posts metric with scroll navigation
<button 
  onClick={() => {
    const postsSection = document.getElementById('user-posts-section')
    postsSection?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    })
  }}
  className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors"
>
  <p className="font-semibold">{user.posts_count}</p>
  <p className="text-sm text-gray-500">Posts</p>
</button>
```

### Modal Navigation Patterns

**Modal Opening Triggers:**
- **Metric Buttons**: Profile metrics (followers, following) open modals
- **Share Buttons**: Open share modal with positioning
- **Reaction Counts**: Open reaction viewer modal
- **User Lists**: Various user list contexts

**Modal Navigation Behavior:**
- **Backdrop Click**: Closes modal and returns to previous context
- **Escape Key**: Keyboard shortcut to close modal
- **Internal Navigation**: Clicking users within modals navigates to profiles
- **Context Preservation**: Modals maintain parent page context

### Deep Linking Patterns

**URL Structure:**
- **User Profiles**: `/profile/{userId}` - Direct access to user profiles
- **Posts**: `/post/{postId}` - Shareable post URLs
- **Feed**: `/feed` - Main application feed

**Navigation State Management:**
- **Browser History**: Proper back/forward button support
- **URL Parameters**: Preserve filter and pagination state
- **Deep Links**: All major views are directly accessible via URL

---

## Modal Design Guidelines

### Modal Structure

**Consistent Modal Layout:**
1. **Backdrop**: Semi-transparent overlay (`bg-black bg-opacity-50`)
2. **Container**: Centered modal with responsive sizing
3. **Header**: Title with close button (X icon)
4. **Content**: Scrollable content area with loading/error states
5. **Footer**: Action buttons or additional controls

### Modal Sizing

**Responsive Modal Sizes:**
```css
/* Standard modal */
.modal-container {
  @apply w-full max-w-md max-h-[80vh] mx-4;
}

/* Large modal for complex content */
.modal-large {
  @apply w-full max-w-2xl max-h-[90vh] mx-4;
}

/* Mobile optimization */
@media (max-width: 640px) {
  .modal-container {
    @apply max-w-[calc(100vw-32px)] max-h-[85vh];
  }
}
```

### Modal Behavior

**Opening Animation:**
```css
/* Fade in backdrop and scale in modal */
.modal-enter {
  @apply opacity-0;
}
.modal-enter-active {
  @apply opacity-100 transition-opacity duration-200;
}
.modal-content-enter {
  @apply scale-95 opacity-0;
}
.modal-content-enter-active {
  @apply scale-100 opacity-100 transition-all duration-200;
}
```

**Focus Management:**
- **Auto Focus**: Modal receives focus when opened
- **Focus Trap**: Tab navigation stays within modal
- **Focus Return**: Focus returns to trigger element when closed

### Modal Content Patterns

**Loading States:**
```typescript
{isLoading ? (
  <div className="p-8 text-center">
    <div className="text-gray-400 text-4xl mb-4">⏳</div>
    <p className="text-gray-500">Loading...</p>
  </div>
) : (
  // Content
)}
```

**Error States:**
```typescript
{error ? (
  <div className="p-8 text-center">
    <div className="text-gray-400 text-4xl mb-4">😔</div>
    <p className="text-gray-600 mb-4">{error}</p>
    <button
      onClick={retryFunction}
      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
    >
      Try Again
    </button>
  </div>
) : (
  // Content
)}
```

**Empty States:**
```typescript
{items.length === 0 ? (
  <div className="p-8 text-center">
    <div className="text-gray-400 text-4xl mb-4">📭</div>
    <p className="text-gray-500">No items found</p>
    <p className="text-sm text-gray-400 mt-1">
      Helpful message about the empty state
    </p>
  </div>
) : (
  // Content list
)}
```

---

## Mobile Optimization

### Touch Targets

**Minimum Touch Target Size:**
- **Primary Actions**: 44px minimum (iOS guideline)
- **Secondary Actions**: 40px minimum
- **Text Links**: 32px minimum with adequate padding

**Touch Target Implementation:**
```css
.touch-target {
  @apply min-h-[44px] min-w-[44px] flex items-center justify-center;
}

.touch-target-secondary {
  @apply min-h-[40px] min-w-[40px] flex items-center justify-center;
}
```

### Mobile-Specific Interactions

**Tap Feedback:**
```css
.tap-feedback {
  @apply active:bg-gray-100 transition-colors duration-75;
}

.tap-feedback-purple {
  @apply active:bg-purple-100 transition-colors duration-75;
}
```

**Swipe Gestures:**
- **Modal Dismissal**: Swipe down to close modals (future enhancement)
- **Navigation**: Swipe between tabs or sections (future enhancement)

### Responsive Breakpoints

**Tailwind CSS Breakpoints:**
- **sm**: `640px` - Small tablets
- **md**: `768px` - Tablets
- **lg**: `1024px` - Small desktops
- **xl**: `1280px` - Large desktops

**Mobile-First Approach:**
```css
/* Base styles for mobile */
.component {
  @apply p-4 text-sm;
}

/* Tablet and up */
@media (min-width: 768px) {
  .component {
    @apply p-6 text-base;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .component {
    @apply p-8 text-lg;
  }
}
```

---

## Accessibility Guidelines

### ARIA Labels and Roles

**Modal Accessibility:**
```typescript
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Modal Title</h2>
  <p id="modal-description">Modal description</p>
</div>
```

**Button Accessibility:**
```typescript
<button
  aria-label="Close modal"
  aria-describedby="close-help"
>
  <X className="h-5 w-5" />
</button>
<div id="close-help" className="sr-only">
  Press Escape key or click to close
</div>
```

### Keyboard Navigation

**Tab Order:**
- **Logical Flow**: Tab order follows visual layout
- **Skip Links**: Skip to main content for screen readers
- **Focus Indicators**: Clear visual focus indicators

**Keyboard Shortcuts:**
- **Escape**: Close modals and dropdowns
- **Enter/Space**: Activate buttons and links
- **Arrow Keys**: Navigate lists and menus

### Screen Reader Support

**Hidden Content for Screen Readers:**
```typescript
<div className="sr-only">
  Additional context for screen readers
</div>
```

**Live Regions for Dynamic Content:**
```typescript
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

---

## Interaction Patterns

### User Search Dropdown Consistency Rule

All user-search dropdown surfaces must share the same row structure and behavior contract:

- Avatar
- Display name (primary)
- `@username`
- Bio (secondary text)

Implementation rule:

- Reuse `apps/web/src/components/UserSearchDropdown.tsx` and `apps/web/src/components/UserSearchResultItem.tsx`.
- Reuse `apps/web/src/hooks/useUserSearch.ts` for search state/debounce/loading semantics.
- Do not implement feature-specific user-search row markup.

### Button States

**Primary Button States:**
```css
.btn-primary {
  @apply bg-purple-600 text-white px-4 py-2 rounded-lg font-medium;
  @apply hover:bg-purple-700 active:bg-purple-800;
  @apply focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2;
  @apply disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed;
  @apply transition-colors duration-200;
}
```

**Secondary Button States:**
```css
.btn-secondary {
  @apply bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium;
  @apply hover:bg-gray-200 active:bg-gray-300;
  @apply focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2;
  @apply disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed;
  @apply transition-colors duration-200;
}
```

### Loading States

**Button Loading State:**
```typescript
<button disabled={isLoading} className="btn-primary">
  {isLoading ? (
    <>
      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
      Loading...
    </>
  ) : (
    'Submit'
  )}
</button>
```

**Content Loading State:**
```typescript
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

### Success Feedback

**Toast Notifications:**
- **Success**: Green background with checkmark icon
- **Error**: Red background with X icon
- **Info**: Blue background with info icon
- **Warning**: Orange background with warning icon

**Inline Success States:**
```typescript
{success && (
  <div className="flex items-center space-x-2 text-green-600 mt-2">
    <Check className="h-4 w-4" />
    <span className="text-sm">Action completed successfully</span>
  </div>
)}
```

---

## Error Handling UX

### Error Message Guidelines

**Error Message Principles:**
1. **Clear and Specific**: Explain what went wrong
2. **Actionable**: Provide steps to resolve the issue
3. **Friendly Tone**: Avoid technical jargon
4. **Contextual**: Show errors near relevant form fields

**Error Message Examples:**
```typescript
// Good error messages
"Please enter a valid email address"
"Password must be at least 8 characters long"
"This username is already taken. Please try another."

// Avoid generic messages
"Invalid input"
"Error occurred"
"Something went wrong"
```

### Error State Patterns

**Form Field Errors:**
```typescript
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Email
  </label>
  <input
    type="email"
    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
      error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'
    }`}
  />
  {error && (
    <p className="mt-1 text-sm text-red-600 flex items-center">
      <AlertCircle className="h-4 w-4 mr-1" />
      {error}
    </p>
  )}
</div>
```

**Network Error Handling:**
```typescript
{networkError ? (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <div className="flex items-center">
      <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
      <div>
        <h3 className="text-sm font-medium text-red-800">
          Connection Error
        </h3>
        <p className="text-sm text-red-700 mt-1">
          Unable to connect to the server. Please check your internet connection and try again.
        </p>
        <button
          onClick={retryAction}
          className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  </div>
) : (
  // Normal content
)}
```

---

## Performance Guidelines

### Perceived Performance

**Loading Indicators:**
- **Immediate Feedback**: Show loading state within 100ms
- **Progress Indication**: Show progress for operations > 2 seconds
- **Skeleton Screens**: Use skeleton loading for content areas

**Optimistic Updates:**
- **Immediate UI Updates**: Update UI before server confirmation
- **Rollback on Error**: Revert changes if server request fails
- **Visual Feedback**: Show pending state during server sync

### Image Optimization

**Profile Photos:**
```typescript
// Use Next.js Image component for optimization
<Image
  src={user.profile_image_url}
  alt={`${user.name}'s profile`}
  width={40}
  height={40}
  className="rounded-full"
  loading="lazy"
/>
```

**Responsive Images:**
```typescript
// Provide multiple sizes for different screen densities
<Image
  src={post.image_url}
  alt="Post image"
  width={600}
  height={400}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  loading="lazy"
/>
```

---

## Future Enhancements

### Planned UX Improvements

1. **Advanced Animations:**
   - Page transitions with smooth animations
   - Micro-interactions for better feedback
   - Gesture-based navigation on mobile

2. **Personalization:**
   - Customizable themes and colors
   - User preference-based layouts
   - Adaptive UI based on usage patterns

3. **Advanced Navigation:**
   - Breadcrumb navigation for deep pages
   - Quick navigation shortcuts
   - Search-based navigation

4. **Enhanced Accessibility:**
   - Voice navigation support
   - High contrast mode
   - Reduced motion preferences

5. **Progressive Web App Features:**
   - Offline functionality
   - Push notifications
   - App-like navigation

### Design System Evolution

**Component Library:**
- Standardized component library with Storybook
- Design tokens for consistent theming
- Automated accessibility testing

**Design Documentation:**
- Interactive design system documentation
- Component usage guidelines
- Design decision rationale

This UI/UX guidelines document serves as the foundation for maintaining consistency and quality across the Grateful platform while ensuring an excellent user experience for all users.
