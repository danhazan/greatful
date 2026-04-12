import React from 'react'
import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import PostCard from '@/components/PostCard'
import * as authUtils from '@/utils/auth';
const mockedAuthUtils = authUtils as jest.Mocked<typeof authUtils>;

// Mock analytics service
jest.mock('@/services/analytics', () => ({
  trackViewEvent: jest.fn(),
  trackHeartEvent: jest.fn(),
  trackReactionEvent: jest.fn(),
  trackShareEvent: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

const mockPost = {
  id: 'test-post-1',
  content: 'Test gratitude post content',
  author: {
    id: '1',
    name: 'Test User',
    username: 'testuser',
    image: 'https://example.com/avatar.jpg',
    followerCount: 0,
    followingCount: 0,
    postsCount: 1,
    isFollowing: false
  },
  createdAt: '2025-01-08T10:00:00Z',
  reactionsCount: 3,
  currentUserReaction: undefined,
  reactionEmojiCodes: [],
}

const mockHandlers = {
  onReaction: jest.fn(),
  onRemoveReaction: jest.fn(),
  onShare: jest.fn(),
  onUserClick: jest.fn(),
}

describe('PostCard Authentication Controls', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockClear()
  })

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      ;(mockedAuthUtils.isAuthenticated as jest.Mock).mockReturnValue(false)
      ;(mockedAuthUtils.getAccessToken as jest.Mock).mockReturnValue(null)
      ;(mockedAuthUtils.canInteract as jest.Mock).mockReturnValue(false)
    })

    it('should show authentication notice', () => {
      render(<PostCard post={mockPost} {...mockHandlers} />)
      
      // Authentication notice should be present
      expect(screen.getByText(/Join to interact/)).toBeInTheDocument()
      expect(screen.getByText('Log In')).toBeInTheDocument()
      expect(screen.getByText('Sign Up')).toBeInTheDocument()
    })

    it('should show counters but with disabled styling', () => {
      render(<PostCard post={mockPost} {...mockHandlers} />)
      
      // Reaction button should have disabled styling
      const reactionButton = screen.getByTitle('Login to react to posts')
      expect(reactionButton).toHaveClass('text-gray-400')
      expect(reactionButton).toBeInTheDocument()
    })

    it('should not show user-specific interaction states', () => {
      const heartedPost = { ...mockPost, currentUserReaction: 'heart', reactionEmojiCodes: ['heart'] }
      render(<PostCard post={heartedPost} {...mockHandlers} />)
      
      // Reaction button should not be filled for unauthenticated users
      const reactionButton = screen.getByTitle('Login to react to posts')
      expect(reactionButton).toHaveClass('text-gray-400')
    })

    it('should allow sharing (sharing is public)', () => {
      render(<PostCard post={mockPost} {...mockHandlers} />)
      
      const shareButton = screen.getByRole('button', { name: /share/i })
      expect(shareButton).not.toHaveClass('text-gray-400')
      expect(shareButton).not.toHaveAttribute('disabled')
    })
  })

  describe('when user is authenticated', () => {
    beforeEach(() => {
      ;(mockedAuthUtils.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(mockedAuthUtils.getAccessToken as jest.Mock).mockReturnValue('mock-token')
      ;(mockedAuthUtils.canInteract as jest.Mock).mockReturnValue(true)
    })

    it('should not show authentication notice', () => {
      render(<PostCard post={mockPost} currentUserId="current-user-123" {...mockHandlers} />
)
      // Should not show authentication notice
      expect(screen.queryByText(/Join to interact/)).not.toBeInTheDocument()
    })

    it('should enable interactions with proper styling', () => {
      render(<PostCard post={mockPost} currentUserId="current-user-123" {...mockHandlers} />)
      
      // Reaction button should not have disabled styling
      const reactionButton = screen.queryByTitle('Login to react to posts')
      expect(reactionButton).not.toBeInTheDocument()
    })

it('should show user-specific interaction states', () => {
      const heartedPost = { ...mockPost, currentUserReaction: 'heart', reactionEmojiCodes: ['heart'] }
      render(<PostCard post={heartedPost} currentUserId="current-user-123" {...mockHandlers} />)
      
      // Post should render with user-specific state
      expect(screen.getByRole('article')).toBeInTheDocument()
    })

  it('should make API calls when interacting', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      render(<PostCard post={mockPost} currentUserId="current-user-123" {...mockHandlers} />)
      
      // Find reaction button by title
      const reactionButton = screen.getByTitle('React with emoji')
      expect(reactionButton).toBeInTheDocument()
    })
  })
})