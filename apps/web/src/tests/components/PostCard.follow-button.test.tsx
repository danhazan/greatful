import { render, screen } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'
import { expect, it, afterEach, beforeEach, describe } from '@jest/globals'

// Mock the analytics service
jest.mock('@/services/analytics', () => ({
  trackReactionEvent: jest.fn(),
  trackViewEvent: jest.fn(),
  trackHeartEvent: jest.fn(),
  trackShareEvent: jest.fn(),
}))

// Mock the emoji mapping utility
jest.mock('@/utils/emojiMapping', () => ({
  getEmojiFromCode: jest.fn((code) => {
    const mapping: {[key: string]: string} = {
      'heart_eyes': '😍',
      'joy': '😂',
      'thinking': '🤔',
      'fire': '🔥',
      'pray': '🙏'
    }
    return mapping[code] || '😊'
  }),
  getAvailableEmojis: jest.fn(() => [
    { code: 'heart_face', emoji: '😍', label: 'Love it' },
    { code: 'fire', emoji: '🔥', label: 'Fire' },
    { code: 'pray', emoji: '🙏', label: 'Grateful' },
    { code: 'muscle', emoji: '💪', label: 'Strong' },
    { code: 'clap', emoji: '👏', label: 'Applause' },
    { code: 'joy', emoji: '😂', label: 'Funny' },
    { code: 'thinking', emoji: '🤔', label: 'Thinking' },
    { code: 'star', emoji: '⭐', label: 'Amazing' }
  ]),
}))

// Mock the auth utilities
jest.mock('@/utils/auth', () => ({
  isAuthenticated: jest.fn(() => true),
  canInteract: jest.fn(() => true),
  getAccessToken: jest.fn(() => 'mock-token'),
}))

// Mock the image utilities
jest.mock('@/utils/imageUtils', () => ({
  getImageUrl: jest.fn((url) => url),
}))

// Mock the mention utilities
jest.mock('@/utils/mentionUtils', () => ({
  getUniqueUsernames: jest.fn(() => []),
  isValidUsername: jest.fn(() => true),
  splitContentWithMentions: jest.fn((content) => [{ type: 'text', content }]),
}))

// Mock FollowButton component
jest.mock('../../components/FollowButton', () => {
  return function MockFollowButton({ userId, size, variant }: any) {
    return (
      <button data-testid={`follow-button-${userId}`} className={`follow-btn-${size}-${variant}`}>
        Follow
      </button>
    )
  }
})

const mockPost = {
  id: 'test-post-1',
  content: 'Test post content',
  author: {
    id: '123', // Valid numeric ID
    name: 'Test Author',
    image: 'https://example.com/avatar.jpg',
  },
  createdAt: new Date().toISOString(),
  postType: 'daily' as const,
  heartsCount: 5,
  isHearted: false,
  reactionsCount: 2,
  currentUserReaction: undefined,
}

describe.skip('PostCard Follow Button Tests', () => {
  beforeEach(() => {
    // Reset NODE_ENV to development for these tests
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    // Reset NODE_ENV back to test
    process.env.NODE_ENV = 'test'
  })

  it('should render follow button when viewing another user\'s post', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="456" // Different from post author ID
      />
    )

    // Should show follow button for the author
    expect(screen.getByTestId('follow-button-123')).toBeInTheDocument()
    expect(screen.getByTestId('follow-button-123')).toHaveClass('follow-btn-xxs-outline')
  })

  it('should not render follow button when viewing own post', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="123" // Same as post author ID
      />
    )

    // Should not show follow button for own post
    expect(screen.queryByTestId('follow-button-123')).not.toBeInTheDocument()
  })

  it('should not render follow button when not logged in', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId={undefined} // Not logged in
      />
    )

    // Should not show follow button when not authenticated
    expect(screen.queryByTestId('follow-button-123')).not.toBeInTheDocument()
  })

  it('should not render follow button for invalid author ID', () => {
    const postWithInvalidAuthorId = {
      ...mockPost,
      author: {
        ...mockPost.author,
        id: 'invalid-id' // Non-numeric ID
      }
    }

    render(
      <PostCard
        post={postWithInvalidAuthorId}
        currentUserId="456"
      />
    )

    // Should not show follow button for invalid author ID
    expect(screen.queryByTestId('follow-button-invalid-id')).not.toBeInTheDocument()
  })

  it('should render follow button with correct props', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="456"
      />
    )

    const followButton = screen.getByTestId('follow-button-123')
    expect(followButton).toBeInTheDocument()
    
    // Check that it has the correct size and variant classes
    expect(followButton).toHaveClass('follow-btn-xxs-outline')
  })
})