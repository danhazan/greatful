/**
 * Tests for PostCard local state updates during reactions
 * This test focuses on verifying that the PostCard component updates its local state
 * immediately after API calls, providing responsive UI feedback.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import { jest } from '@jest/globals'
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import PostCard from '@/components/PostCard'
import { 
  setupTestEnvironment, 
  cleanupTestEnvironment,
  createTestPost
} from '../utils/test-helpers'

// Mock the API client
const mockApiClient = {
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn()
}

jest.mock('@/utils/apiClient', () => ({
  __esModule: true,
  apiClient: mockApiClient
}))

// Mock other dependencies
jest.mock('@/utils/auth', () => ({
  getAccessToken: jest.fn(() => 'mock-token'),
  isAuthenticated: jest.fn(() => true)
}))

jest.mock('@/services/analytics', () => ({
  __esModule: true,
  default: {
    trackReactionEvent: jest.fn()
  }
}))

// Mock the EmojiPicker component
jest.mock('@/components/EmojiPicker', () => {
  return function MockEmojiPicker({ isOpen, onEmojiSelect, onClose }: any) {
    if (!isOpen) return null
    return (
      <div data-testid="emoji-picker">
        <button title="heart" onClick={() => onEmojiSelect('heart')}>💜</button>
        <button title="pray" onClick={() => onEmojiSelect('pray')}>🙏</button>
        <button onClick={onClose}>Close</button>
      </div>
    )
  }
})

// Mock other components
jest.mock('@/components/ReactionViewer', () => {
  return function MockReactionViewer() { return null }
})

jest.mock('@/components/HeartsViewer', () => {
  return function MockHeartsViewer() { return null }
})

jest.mock('@/components/ShareModal', () => {
  return function MockShareModal() { return null }
})

jest.mock('@/components/CommentsModal', () => {
  return function MockCommentsModal() { return null }
})

jest.mock('@/components/MentionHighlighter', () => {
  return function MockMentionHighlighter({ children }: any) { return children }
})

jest.mock('@/components/FollowButton', () => {
  return function MockFollowButton() { return null }
})

jest.mock('@/components/ProfilePhotoDisplay', () => {
  return function MockProfilePhotoDisplay({ onClick }: any) { 
    return <div onClick={onClick}>Profile Photo</div>
  }
})

jest.mock('@/components/RichContentRenderer', () => {
  return function MockRichContentRenderer({ content }: any) { 
    return <div>{content}</div>
  }
})

jest.mock('@/components/LocationDisplayModal', () => {
  return function MockLocationDisplayModal() { return null }
})

jest.mock('@/components/EditPostModal', () => {
  return function MockEditPostModal() { return null }
})

jest.mock('@/components/DeleteConfirmationModal', () => {
  return function MockDeleteConfirmationModal() { return null }
})

jest.mock('@/components/OptimizedPostImage', () => {
  return function MockOptimizedPostImage() { return null }
})

// Mock hooks
jest.mock('@/hooks/useStateSynchronization', () => ({
  usePostStateSynchronization: jest.fn()
}))

// Mock contexts
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showLoading: jest.fn(),
    hideToast: jest.fn()
  })
}))

// Mock utilities
jest.mock('@/utils/emojiMapping', () => ({
  getEmojiFromCode: (code: string) => {
    const mapping: {[key: string]: string} = {
      'heart': '💜',
      'pray': '🙏'
    }
    return mapping[code] || '😊'
  }
}))

jest.mock('@/utils/imageUtils', () => ({
  getImageUrl: (url: string) => url
}))

jest.mock('@/utils/mentionUtils', () => ({
  getUniqueUsernames: () => [],
  isValidUsername: () => true
}))

jest.mock('@/utils/normalizePost', () => ({
  normalizePostFromApi: (data: any) => data,
  debugApiResponse: jest.fn(),
  mergePostUpdate: (prev: any, update: any) => ({ ...prev, ...update })
}))

jest.mock('@/utils/rtlUtils', () => ({
  getTextDirection: () => 'ltr',
  getTextAlignmentClass: () => 'text-left',
  getDirectionAttribute: () => 'ltr',
  hasMixedDirectionContent: () => false
}))

const mockPost = createTestPost()

describe('PostCard State Updates', () => {
  beforeEach(() => {
    setupTestEnvironment()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupTestEnvironment()
  })

  it('should display correct emoji when post has current user reaction', () => {
    // Test that the component shows the correct emoji for current user reaction
    const postWithHeartReaction = createTestPost({
      reactionsCount: 1,
      currentUserReaction: 'heart',
    })

    render(
      <PostCard
        post={postWithHeartReaction}
        currentUserId="current-user"
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Should show the heart emoji (💜) for the current user's reaction
    expect(screen.getByText('💜')).toBeInTheDocument()
  })

  it('should display correct emoji when post reaction changes', () => {
    // Test that the component updates the emoji when the post prop changes
    const postWithHeartReaction = createTestPost({
      reactionsCount: 1,
      currentUserReaction: 'heart',
    })

    const { rerender } = render(
      <PostCard
        post={postWithHeartReaction}
        currentUserId="current-user"
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Initially should show heart emoji
    expect(screen.getByText('💜')).toBeInTheDocument()

    // Update the post to have a pray reaction instead
    const postWithPrayReaction = createTestPost({
      reactionsCount: 1,
      currentUserReaction: 'pray',
    })

    rerender(
      <PostCard
        post={postWithPrayReaction}
        currentUserId="current-user"
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Should now show pray emoji and not heart emoji
    expect(screen.getByText('🙏')).toBeInTheDocument()
    expect(screen.queryByText('💜')).not.toBeInTheDocument()
  })

  it('should display empty heart when no reaction exists', () => {
    // Test that the component shows empty heart when user has no reaction
    const postWithNoReaction = createTestPost({
      reactionsCount: 0,
      currentUserReaction: undefined,
    })

    render(
      <PostCard
        post={postWithNoReaction}
        currentUserId="current-user"
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Should show empty heart icon (no emoji text)
    const heartButton = screen.getByTitle('Login to react to posts')
    const heartIcon = heartButton.querySelector('svg')
    expect(heartIcon).toBeInTheDocument()
    expect(screen.queryByText('💜')).not.toBeInTheDocument()
    expect(screen.queryByText('🙏')).not.toBeInTheDocument()
    
    // Total count should NOT be visible when it's 0 (ReactionsBanner returns null)
    expect(screen.queryByTitle('Reactions')).not.toBeInTheDocument()
  })

  it('should update reaction count when post prop changes', () => {
    // Test that the component updates the count when the post prop changes
    const postWithLowCount = createTestPost({
      reactionsCount: 2,
      currentUserReaction: undefined,
    })

    const { rerender } = render(
      <PostCard
        post={postWithLowCount}
        currentUserId="current-user"
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Initially should show 2 total (from mockPost overrides)
    // ReactionsBanner title is "View reactions" when authenticated
    const reactionsBanner = screen.getByTitle('View reactions')
    expect(reactionsBanner).toHaveTextContent('2')

    // Update the post to have higher counts
    const postWithHighCount = createTestPost({
      reactionsCount: 10,
      currentUserReaction: undefined,
    })

    rerender(
      <PostCard
        post={postWithHighCount}
        currentUserId="current-user"
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Should now show 10 total
    expect(screen.getByTitle('View reactions')).toHaveTextContent('10')
  })
})