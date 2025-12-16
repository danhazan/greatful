# Frontend Components Documentation

## Overview

This document provides comprehensive documentation for the React components used in the Grateful frontend application. Components are organized by functionality and include usage examples, props interfaces, and implementation details.

## Table of Contents

- [Modal Components](#modal-components)
  - [FollowersModal](#followersmodal)
  - [FollowingModal](#followingmodal)
  - [ShareModal](#sharemodal)
  - [EmojiPicker](#emojipicker)
  - [ReactionViewer](#reactionviewer)
- [User Interface Components](#user-interface-components)
  - [UserListItem](#userlistitem)
  - [ProfilePhotoDisplay](#profilephotodisplay)
- [Interactive Components](#interactive-components)
  - [MentionAutocomplete](#mentionautocomplete)
  - [NotificationSystem](#notificationsystem)
- [Post Components](#post-components)
  - [PostCard](#postcard)
  - [CreatePostModal](#createpostmodal)

---

## Modal Components

### FollowersModal

A modal component that displays a user's followers list with search functionality and navigation to user profiles.

**Location:** `apps/web/src/components/FollowersModal.tsx`

#### Props Interface

```typescript
interface FollowersModalProps {
  isOpen: boolean
  onClose: () => void
  userId: number
  username: string
}
```

#### Features

- **Followers List Display**: Shows paginated list of followers with profile pictures and usernames
- **Loading States**: Displays loading spinner while fetching data
- **Error Handling**: Shows error messages with retry functionality
- **Empty State**: Displays friendly message when user has no followers
- **Profile Navigation**: Click on any follower to navigate to their profile
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Accessibility**: Full keyboard navigation and screen reader support

#### Usage Example

```typescript
import FollowersModal from '@/components/FollowersModal'

function ProfilePage() {
  const [showFollowers, setShowFollowers] = useState(false)
  
  return (
    <>
      <button onClick={() => setShowFollowers(true)}>
        View Followers
      </button>
      
      <FollowersModal
        isOpen={showFollowers}
        onClose={() => setShowFollowers(false)}
        userId={user.id}
        username={user.username}
      />
    </>
  )
}
```

#### API Integration

- **Endpoint**: `GET /api/users/{userId}/followers`
- **Parameters**: `limit=50&offset=0`
- **Authentication**: Requires Bearer token
- **Response**: Array of follower objects with user details

---

### FollowingModal

A modal component that displays the list of users that a specific user is following.

**Location:** `apps/web/src/components/FollowingModal.tsx`

#### Props Interface

```typescript
interface FollowingModalProps {
  isOpen: boolean
  onClose: () => void
  userId: number
  username: string
}
```

#### Features

- **Following List Display**: Shows users that the profile owner is following
- **Profile Navigation**: Click to navigate to any followed user's profile
- **Loading and Error States**: Comprehensive state management
- **Empty State**: Shows when user isn't following anyone yet
- **Consistent UI**: Matches FollowersModal design patterns
- **Mobile Optimized**: Touch-friendly interface with proper sizing

#### Usage Example

```typescript
import FollowingModal from '@/components/FollowingModal'

function ProfileMetrics({ user }) {
  const [showFollowing, setShowFollowing] = useState(false)
  
  return (
    <>
      <button onClick={() => setShowFollowing(true)}>
        {user.following_count} Following
      </button>
      
      <FollowingModal
        isOpen={showFollowing}
        onClose={() => setShowFollowing(false)}
        userId={user.id}
        username={user.username}
      />
    </>
  )
}
```

#### API Integration

- **Endpoint**: `GET /api/users/{userId}/following`
- **Parameters**: `limit=50&offset=0`
- **Authentication**: Requires Bearer token
- **Response**: Array of following user objects

---

### ShareModal

Enhanced sharing modal with multiple sharing options including URL copy, message sending, and WhatsApp integration.

**Location:** `apps/web/src/components/ShareModal.tsx`

#### Props Interface

```typescript
interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  post: Post
  onShare?: (method: 'url' | 'message' | 'whatsapp', data: any) => void
  position?: { x: number, y: number }
}
```

#### Features

- **Multiple Share Methods**:
  - **Copy Link**: Generates shareable URL and copies to clipboard
  - **Send as Message**: Share directly with other users in the app
  - **WhatsApp Share**: Opens WhatsApp with formatted share text
- **User Selection**: Autocomplete search for message recipients (max 5 users)
- **Mobile Detection**: Optimized WhatsApp sharing for mobile vs desktop
- **Analytics Tracking**: Tracks share events for all methods
- **Success Feedback**: Visual confirmation for all share actions
- **Error Handling**: Graceful error handling with retry options

#### WhatsApp Integration

The ShareModal includes comprehensive WhatsApp sharing functionality:

```typescript
// WhatsApp share configuration
const whatsAppText = formatWhatsAppShareText(cleanContent, shareUrl)
const whatsAppUrl = generateWhatsAppURL(whatsAppText)

// Opens WhatsApp Web on desktop, WhatsApp app on mobile
window.open(whatsAppUrl, '_blank')
```

#### Usage Example

```typescript
import ShareModal from '@/components/ShareModal'

function PostCard({ post }) {
  const [showShare, setShowShare] = useState(false)
  const [sharePosition, setSharePosition] = useState({ x: 0, y: 0 })
  
  const handleShareClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setSharePosition({ x: rect.left, y: rect.bottom })
    setShowShare(true)
  }
  
  return (
    <>
      <button onClick={handleShareClick}>Share</button>
      
      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        post={post}
        position={sharePosition}
        onShare={(method, data) => {
          console.log(`Shared via ${method}:`, data)
        }}
      />
    </>
  )
}
```

---

### EmojiPicker

A modal component for selecting emoji reactions on posts. Features a scrollable grid of 56 positive emojis organized in 7 themed rows.

**Location:** `apps/web/src/components/EmojiPicker.tsx`

#### Props Interface

```typescript
interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void           // Called when emoji is selected (sends reaction)
  onCancel: () => void          // Called when X clicked or click outside (cancels, no reaction)
  onEmojiSelect: (emojiCode: string) => void
  currentReaction?: string
  position?: { x: number, y: number }
  isLoading?: boolean
}
```

#### Features

- **56 Emoji Options**: Organized in 7 themed rows (Original, Love/Warmth, Joy/Celebration, Encouragement, Nature/Peace, Affection, Expressions)
- **Scrollable Grid**: Vertically scrollable with scroll containment to prevent background scrolling
- **Cancel vs Confirm Behavior**:
  - Clicking emoji: Sends reaction immediately, closes picker
  - X button / Click outside / Escape: Cancels without sending reaction
  - Scroll outside: Blocked entirely
- **Current Reaction Highlight**: Shows purple ring around currently selected emoji
- **Accessibility**: Full keyboard navigation, ARIA labels, focus trapping
- **Mobile Optimized**: Touch-friendly with haptic feedback support

#### Available Emojis (7 Rows)

| Row | Theme | Emojis |
|-----|-------|--------|
| 1 | Original | 💜 😍 🤗 🥹 💪 🙏 🙌 👏 |
| 2 | Love/Warmth | ⭐ 🔥 ✨ 🥰 💖 💝 💕 💗 |
| 3 | Joy/Celebration | 🎉 🎊 🥳 😊 😄 😁 🤩 🙂 |
| 4 | Encouragement | 💯 🏆 🌟 👑 💎 🎯 ✅ 💫 |
| 5 | Nature/Peace | 🌈 🌻 🌸 🍀 🌺 🌷 🌼 🦋 |
| 6 | Affection | 🫶 🤝 👐 🫂 💐 🎁 🕊️ ☀️ |
| 7 | Expressions | 😇 🥲 😌 🤭 😎 🤗 😋 🫡 |

#### Usage Example

```typescript
import EmojiPicker from '@/components/EmojiPicker'

function PostCard() {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleEmojiSelect = async (emojiCode: string) => {
    await apiClient.post(`/posts/${postId}/reactions`, { emoji_code: emojiCode })
    // Update local state...
  }

  return (
    <>
      <button onClick={(e) => {
        setPosition({ x: e.clientX, y: e.clientY })
        setShowEmojiPicker(true)
      }}>
        React
      </button>

      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onCancel={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
        currentReaction={currentUserReaction}
        position={position}
      />
    </>
  )
}
```

#### API Integration

- **Add Reaction**: `POST /api/v1/posts/{post_id}/reactions` with `{ emoji_code: string }`
- **Remove Reaction**: `DELETE /api/v1/posts/{post_id}/reactions`
- **Get Summary**: `GET /api/v1/posts/{post_id}/reactions/summary`

---

### ReactionViewer

A modal component that displays all users who have reacted to a post, grouped by emoji type.

**Location:** `apps/web/src/components/ReactionViewer.tsx`

#### Props Interface

```typescript
interface ReactionViewerProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  reactions: Array<{
    id: string
    emoji_code: string
    user: { id: number, username: string, name: string, image?: string }
  }>
  onUserClick?: (userId: string) => void
}
```

#### Features

- **Grouped Display**: Reactions grouped by emoji type with counts
- **User List**: Shows users who reacted with each emoji
- **Profile Navigation**: Click user to view their profile
- **Responsive Design**: Works on mobile and desktop

---

## User Interface Components

### UserListItem

A reusable component for displaying user information in lists, used throughout the application for followers, following, mentions, and search results.

**Location:** `apps/web/src/components/UserListItem.tsx`

#### Props Interface

```typescript
interface UserListItemProps {
  user: {
    id: string | number
    name: string
    username?: string
    image?: string
    bio?: string
    createdAt?: string
  }
  rightElement?: React.ReactNode
  onClick?: () => void
  showTimestamp?: boolean
  className?: string
  role?: string
  tabIndex?: number
  ariaLabel?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
}
```

#### Features

- **Flexible User Display**: Shows profile photo, name, username, and bio
- **Customizable Right Element**: Supports follow buttons, timestamps, or other actions
- **Accessibility Support**: Full ARIA labels and keyboard navigation
- **Responsive Design**: Adapts to different screen sizes
- **Profile Photo Integration**: Uses ProfilePhotoDisplay component
- **Truncation**: Handles long usernames and bios gracefully

#### Usage Examples

```typescript
// Basic user list item
<UserListItem
  user={user}
  onClick={() => navigateToProfile(user.id)}
/>

// With follow button
<UserListItem
  user={user}
  rightElement={<FollowButton userId={user.id} />}
  onClick={() => navigateToProfile(user.id)}
/>

// With timestamp
<UserListItem
  user={user}
  showTimestamp={true}
  onClick={() => navigateToProfile(user.id)}
/>
```

---

## Component Architecture Patterns

### Modal Design Patterns

All modal components in the application follow consistent design patterns:

#### Structure
1. **Backdrop**: Semi-transparent overlay (`bg-black bg-opacity-50`)
2. **Modal Container**: Centered with responsive sizing
3. **Header**: Title with close button
4. **Content Area**: Scrollable content with loading/error states
5. **Footer**: Action buttons or additional controls

#### Accessibility Features
- **Focus Management**: Automatic focus on modal open
- **Keyboard Navigation**: Tab cycling within modal
- **Escape Key**: Closes modal
- **ARIA Labels**: Proper labeling for screen readers
- **Click Outside**: Closes modal when clicking backdrop

#### Mobile Optimization
- **Touch Targets**: Minimum 44px touch targets
- **Responsive Sizing**: Adapts to screen size
- **Scroll Handling**: Proper overflow handling
- **Safe Areas**: Respects mobile safe areas

### State Management Patterns

Components use consistent state management patterns:

```typescript
// Loading states
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

// Data states
const [data, setData] = useState<DataType[]>([])

// UI states
const [isOpen, setIsOpen] = useState(false)
```

### Error Handling Patterns

All components implement consistent error handling:

```typescript
// Error display with retry
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
  // Normal content
)}
```

## Testing Guidelines

### Component Testing

All components should include comprehensive tests:

```typescript
// Example test structure
describe('FollowersModal', () => {
  it('renders followers list correctly', () => {
    // Test implementation
  })
  
  it('handles loading state', () => {
    // Test loading spinner
  })
  
  it('handles error state with retry', () => {
    // Test error handling
  })
  
  it('navigates to user profile on click', () => {
    // Test navigation
  })
})
```

### Accessibility Testing

- **Screen Reader Testing**: Test with VoiceOver/NVDA
- **Keyboard Navigation**: Verify tab order and keyboard shortcuts
- **Color Contrast**: Ensure WCAG 2.1 AA compliance
- **Focus Management**: Test focus trapping in modals

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Modal components are loaded only when needed
2. **Memoization**: Use React.memo for expensive components
3. **Virtual Scrolling**: For large user lists (future enhancement)
4. **Image Optimization**: Profile photos use Next.js Image component
5. **Debounced Search**: Search inputs use 300ms debounce

### Bundle Size

- **Tree Shaking**: Components are properly exported for tree shaking
- **Code Splitting**: Modal components can be dynamically imported
- **Icon Optimization**: Lucide React icons are tree-shakeable

---

## Additional Components

### ProfilePhotoDisplay

A component for displaying user profile photos with fallback to default avatar, used throughout the application for consistent profile photo rendering.

**Location:** `apps/web/src/components/ProfilePhotoDisplay.tsx`

#### Props Interface

```typescript
interface ProfilePhotoDisplayProps {
  photoUrl?: string | null
  username?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  onClick?: () => void
}
```

#### Features

- **Multiple Sizes**: Predefined size variants from xs (24px) to 2xl (128px)
- **Fallback Avatar**: Purple gradient background with user icon when no photo
- **Error Handling**: Graceful fallback when image fails to load
- **Click Support**: Optional click handler for navigation
- **Accessibility**: Proper alt text and ARIA labels
- **Responsive**: Scales appropriately across devices

#### Usage Examples

```typescript
// Basic profile photo
<ProfilePhotoDisplay
  photoUrl={user.profile_image_url}
  username={user.username}
  size="md"
/>

// Clickable profile photo
<ProfilePhotoDisplay
  photoUrl={user.profile_image_url}
  username={user.username}
  size="lg"
  onClick={() => navigateToProfile(user.id)}
/>

// Small avatar for lists
<ProfilePhotoDisplay
  photoUrl={user.profile_image_url}
  username={user.username}
  size="sm"
  className="border-0 shadow-none"
/>
```

#### Size Variants

- **xs**: 24px (6x6) - Inline mentions, small lists
- **sm**: 32px (8x8) - User lists, compact displays
- **md**: 48px (12x12) - Default size, post authors
- **lg**: 64px (16x16) - Profile headers, emphasis
- **xl**: 96px (24x24) - Large profile displays
- **2xl**: 128px (32x32) - Profile editing, hero sections

---

### ClickableUsername

A component for rendering clickable usernames that navigate to user profiles, with intelligent ID resolution and error handling.

**Location:** `apps/web/src/components/ClickableUsername.tsx`

#### Props Interface

```typescript
interface ClickableUsernameProps {
  userId?: string | number
  username?: string
  displayName?: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}
```

#### Features

- **Intelligent Navigation**: Handles both user IDs and usernames for navigation
- **Username Resolution**: Automatically resolves usernames to user IDs when needed
- **Fallback Handling**: Graceful handling when user data is unavailable
- **Custom Styling**: Configurable CSS classes with sensible defaults
- **Accessibility**: Full keyboard navigation and ARIA labels
- **Event Handling**: Prevents event bubbling and supports custom click handlers

#### Usage Examples

```typescript
// With user ID (direct navigation)
<ClickableUsername
  userId={user.id}
  displayName={user.display_name}
  username={user.username}
/>

// With username (requires resolution)
<ClickableUsername
  username="johndoe"
  displayName="John Doe"
/>

// In notification context
<ClickableUsername
  userId={notification.actor_id}
  username={notification.actor_username}
  className="font-semibold text-purple-600 hover:text-purple-800"
/>

// Custom click handler
<ClickableUsername
  userId={user.id}
  username={user.username}
  onClick={(e) => {
    // Custom logic before navigation
    trackUserClick(user.id)
  }}
/>
```

#### Navigation Logic

The component implements intelligent navigation with the following priority:

1. **Direct ID Navigation**: If `userId` is provided and valid, navigate directly
2. **Username Resolution**: If username is provided, resolve to ID via API
3. **Fallback Display**: Show "Unknown User" if neither ID nor username available
4. **Error Handling**: Log warnings for failed navigation attempts

---

### PostCard

The main component for displaying gratitude posts with social interactions including hearts, reactions, comments, and sharing.

**Location:** `apps/web/src/components/PostCard.tsx`

#### Props Interface

```typescript
interface PostCardProps {
  post: Post
  currentUserId?: string
  hideFollowButton?: boolean
  onHeart?: (postId: string, isCurrentlyHearted: boolean, heartInfo?: any) => void
  onReaction?: (postId: string, emojiCode: string, reactionSummary?: any) => void
  onRemoveReaction?: (postId: string, reactionSummary?: any) => void
  onShare?: (postId: string) => void
  onUserClick?: (userId: string) => void
  onEdit?: (postId: string, updatedPost: Post) => void
  onDelete?: (postId: string) => void
}
```

#### Features

- **Social Interactions**: Heart/like, emoji reactions, comments, and sharing
- **Comments System**: View and add comments with reply support
- **Real-time Updates**: Synchronizes post state across components
- **Authentication Handling**: Graceful handling for logged-out users
- **Mobile Optimized**: Touch-friendly buttons with proper spacing
- **Accessibility**: Full keyboard navigation and screen reader support

#### Comments Button Integration

The comments button is positioned between the reactions and share buttons in the post toolbar.

**Button Features:**
- **Icon**: 💬 (speech bubble emoji)
- **Comment Count**: Displays number of comments next to icon
- **Visual Feedback**: Purple ring when post has comments
- **Loading States**: Shows spinner while loading comments
- **Authentication**: Redirects to login for unauthenticated users
- **Touch Targets**: Minimum 44px × 44px for mobile accessibility

**Styling:**
```typescript
// Authenticated user styling
className="text-gray-500 hover:text-purple-500 hover:bg-purple-50"

// With comments (shows ring)
className="ring-1 ring-purple-200"

// Unauthenticated user styling
className="text-gray-400 cursor-pointer hover:bg-gray-50"
```

**Usage Example:**

```typescript
<PostCard
  post={post}
  currentUserId={currentUser?.id}
  onHeart={handleHeart}
  onReaction={handleReaction}
  onShare={handleShare}
/>
```

#### Comments Modal Integration

When the comments button is clicked, the `CommentsModal` component is opened with:

- **Top-level Comments**: Initially loads only parent comments
- **Reply Support**: Load replies on demand when user expands a comment
- **Comment Submission**: Post new comments with real-time updates
- **Reply Submission**: Reply to existing comments with threading
- **Loading States**: Proper loading indicators during API calls
- **Error Handling**: User-friendly error messages with retry options

**API Endpoints:**
- `GET /api/posts/{postId}/comments` - Load top-level comments
- `POST /api/posts/{postId}/comments` - Submit new comment
- `GET /api/comments/{commentId}/replies` - Load comment replies

#### Button Layout

The post toolbar contains four main interaction buttons in this order:

1. **Heart Button** (💜) - Like/unlike the post
2. **Reaction Button** (😊+) - Add emoji reactions
3. **Comments Button** (💬) - View and add comments
4. **Share Button** (Share) - Share the post

**Responsive Spacing:**
- Desktop: `gap-8` (2rem spacing between buttons)
- Mobile: `gap-4` (1rem spacing between buttons)

---

## Future Enhancements

### Planned Improvements

1. **Virtual Scrolling**: For followers/following lists with 1000+ users
2. **Infinite Scroll**: Load more users as user scrolls
3. **Search Functionality**: Search within followers/following lists
4. **Bulk Actions**: Select multiple users for batch operations
5. **Export Features**: Export follower/following lists
6. **Advanced Filtering**: Filter users by join date, activity, etc.

### Component Roadmap

- **UserGroupModal**: Manage user groups/lists
- **AdvancedShareModal**: Additional sharing platforms
- **UserAnalyticsModal**: User engagement statistics
- **BulkActionModal**: Batch operations on users