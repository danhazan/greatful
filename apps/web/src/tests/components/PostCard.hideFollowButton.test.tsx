import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import PostCard from '@/components/PostCard'
import { afterEach } from 'node:test'

// Mock the auth utility
jest.mock('@/utils/auth', () => ({
  isAuthenticated: jest.fn(() => true),
  getAccessToken: jest.fn(() => 'mock-token')
}))

// Mock the analytics service
jest.mock('@/services/analytics', () => ({
  trackViewEvent: jest.fn(),
  trackHeartEvent: jest.fn(),
  trackReactionEvent: jest.fn(),
  trackShareEvent: jest.fn()
}))

// Mock the FollowButton component
jest.mock('@/components/FollowButton', () => {
  return function MockFollowButton({ userId }: { userId: number }) {
    return <button data-testid={`follow-button-${userId}`}>Follow</button>
  }
})

// Mock other components
jest.mock('@/components/EmojiPicker', () => {
  return function MockEmojiPicker() {
    return <div data-testid="emoji-picker">Emoji Picker</div>
  }
})

jest.mock('@/components/ReactionViewer', () => {
  return function MockReactionViewer() {
    return <div data-testid="reaction-viewer">Reaction Viewer</div>
  }
})

jest.mock('@/components/HeartsViewer', () => {
  return function MockHeartsViewer() {
    return <div data-testid="hearts-viewer">Hearts Viewer</div>
  }
})

jest.mock('@/components/ShareModal', () => {
  return function MockShareModal() {
    return <div data-testid="share-modal">Share Modal</div>
  }
})

jest.mock('@/components/MentionHighlighter', () => {
  return function MockMentionHighlighter({ content }: { content: string }) {
    return <span>{content}</span>
  }
})

const mockPost = {
  id: '1',
  content: 'Test post content',
  author: {
    id: '2',
    name: 'Test Author',
    image: 'https://example.com/avatar.jpg'
  },
  createdAt: '2023-01-01T00:00:00Z',
  postType: 'daily' as const,
  heartsCount: 5,
  isHearted: false,
  reactionsCount: 3,
  currentUserReaction: undefined
}

describe('PostCard hideFollowButton prop', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
    // Set NODE_ENV to development to allow follow button to show
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv
  })

  it('shows follow button by default when conditions are met', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="1"
        onHeart={jest.fn()}
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Should show follow button since currentUserId (1) !== post.author.id (2)
    expect(screen.getByRole('button', { name: /follow user 2/i })).toBeInTheDocument()
  })

  it('hides follow button when hideFollowButton is true', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="1"
        hideFollowButton={true}
        onHeart={jest.fn()}
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Should not show follow button even though conditions would normally show it
    expect(screen.queryByRole('button', { name: /follow user 2/i })).not.toBeInTheDocument()
  })

  it('does not show follow button for own posts regardless of hideFollowButton', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="2" // Same as post.author.id
        hideFollowButton={false}
        onHeart={jest.fn()}
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Should not show follow button for own posts
    expect(screen.queryByRole('button', { name: /follow user 2/i })).not.toBeInTheDocument()
  })

  it('does not show follow button when not authenticated', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId={undefined} // Not authenticated
        hideFollowButton={false}
        onHeart={jest.fn()}
        onReaction={jest.fn()}
        onRemoveReaction={jest.fn()}
        onShare={jest.fn()}
        onUserClick={jest.fn()}
      />
    )

    // Should not show follow button when not authenticated
    expect(screen.queryByRole('button', { name: /follow user 2/i })).not.toBeInTheDocument()
  })
})