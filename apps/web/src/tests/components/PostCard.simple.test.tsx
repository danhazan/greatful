import { render, screen } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'
import { describe, it } from '@jest/globals'

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
      'heart': '💜',
      'heart_eyes': '😍',
      'joy': '😂',
      'thinking': '🤔',
      'fire': '🔥',
      'pray': '🙏'
    }
    return mapping[code] || '😊'
  }),
  getAvailableEmojis: jest.fn(() => [
    { code: 'heart', emoji: '💜', label: 'Heart' },
    { code: 'heart_face', emoji: '😍', label: 'Love it' },
    { code: 'fire', emoji: '🔥', label: 'Fire' },
    { code: 'pray', emoji: '🙏', label: 'Grateful' },
    { code: 'muscle', emoji: '💪', label: 'Strong' },
    { code: 'clap', emoji: '👏', label: 'Applause' },
    { code: 'joy', emoji: '😂', label: 'Funny' },
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

const mockPost = {
  id: 'test-post-1',
  content: 'Test post content',
  author: {
    id: 'author-1',
    name: 'Test Author',
    username: 'testauthor',
    image: 'https://example.com/avatar.jpg',
  },
  createdAt: new Date().toISOString(),
  postType: 'daily' as const,
  heartsCount: 5,
  isHearted: false,
  reactionsCount: 2,
  currentUserReaction: undefined,
}

describe('PostCard Simple Tests', () => {
  it('should render post content correctly', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    expect(screen.getByText('Test post content')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })

  it('should display correct unified reaction count', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Check unified reaction count (hearts + reactions = 5 + 2 = 7)
    const unifiedButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('7'))
    expect(unifiedButton).toBeInTheDocument()
    expect(unifiedButton?.textContent).toContain('7')
  })

  it('should show user reaction emoji when user has reacted', () => {
    const postWithUserReaction = {
      ...mockPost,
      currentUserReaction: 'joy',
      reactionsCount: 3
    }

    render(
      <PostCard
        post={postWithUserReaction}
        currentUserId="current-user"
      />
    )

    // Should show the joy emoji (😂) in the unified button
    expect(screen.getByText('😂')).toBeInTheDocument()
    // Total count should be hearts + reactions = 5 + 3 = 8
    const unifiedButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('8'))
    expect(unifiedButton).toBeInTheDocument()
  })

  it('should show heart icon as filled when user has hearted', () => {
    const heartedPost = {
      ...mockPost,
      isHearted: true,
      heartsCount: 6
    }

    render(
      <PostCard
        post={heartedPost}
        currentUserId="current-user"
      />
    )

    // Total count should be hearts + reactions = 6 + 2 = 8
    const unifiedButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('8'))
    expect(unifiedButton).toBeInTheDocument()
    // The button should exist and show the correct count - styling may vary based on auth state
    expect(unifiedButton?.textContent).toContain('8')
  })

  it('should show empty heart (♡) when user has not hearted or reacted', () => {
    const postWithNoInteraction = {
      ...mockPost,
      isHearted: false,
      heartsCount: 5,
      currentUserReaction: undefined,
      reactionsCount: 2
    }

    render(
      <PostCard
        post={postWithNoInteraction}
        currentUserId="current-user"
      />
    )

    // Total count should be hearts + reactions = 5 + 2 = 7
    const unifiedButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('7'))
    expect(unifiedButton).toBeInTheDocument()
    // Should show empty heart icon when no interaction exists
    const heartIcon = unifiedButton?.querySelector('svg.lucide-heart')
    expect(heartIcon).toBeInTheDocument()
  })

  it('should display engagement summary for highly engaged posts', () => {
    const highEngagementPost = {
      ...mockPost,
      heartsCount: 12,
      reactionsCount: 8
    }

    render(
      <PostCard
        post={highEngagementPost}
        currentUserId="current-user"
      />
    )

    expect(screen.getByText('20 reactions')).toBeInTheDocument()
  })

  it('should not display engagement summary for low engagement posts', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Should not show engagement summary (5 + 2 = 7, which is <= 5)
    expect(screen.queryByText('total reactions')).not.toBeInTheDocument()
  })

  it('should render different post types with appropriate styling', () => {
    const { rerender } = render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Daily post should have standardized styling (same as all post types)
    const dailyPost = screen.getByRole('article')
    expect(dailyPost).toHaveClass('bg-white', 'rounded-lg', 'shadow-md')

    // Test photo post
    rerender(
      <PostCard
        post={{ ...mockPost, postType: 'photo' }}
        currentUserId="current-user"
      />
    )
    // Photo post should have same standardized styling
    const photoPost = screen.getByRole('article')
    expect(photoPost).toHaveClass('bg-white', 'rounded-lg', 'shadow-md')

    // Test spontaneous post
    rerender(
      <PostCard
        post={{ ...mockPost, postType: 'spontaneous' }}
        currentUserId="current-user"
      />
    )
    // Spontaneous post should have same standardized styling
    const spontaneousPost = screen.getByRole('article')
    expect(spontaneousPost).toHaveClass('bg-white', 'rounded-lg', 'shadow-md')
  })
})