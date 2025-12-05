import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// Mock the analytics service
jest.mock('@/services/analytics', () => ({
  trackReactionEvent: jest.fn(),
  trackViewEvent: jest.fn(),
  trackHeartEvent: jest.fn(),
  trackShareEvent: jest.fn(),
}))

// Mock the emoji mapping utility
jest.mock('@/utils/emojiMapping', () => ({
  getEmojiFromCode: jest.fn((code) => '😊'),
  getAvailableEmojis: jest.fn(() => []),
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

// Mock the API client
jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
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
  commentsCount: 3,
}

describe('PostCard Comments Button', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render comments button with correct icon and count', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Find the comments button by its count
    const commentsButton = screen.getAllByRole('button').find(btn => 
      btn.textContent?.includes('3') && btn.getAttribute('title')?.includes('comment')
    )
    
    expect(commentsButton).toBeInTheDocument()
    expect(commentsButton?.textContent).toContain('3')
  })

  it('should show 0 when there are no comments', () => {
    const postWithNoComments = {
      ...mockPost,
      commentsCount: 0,
    }

    render(
      <PostCard
        post={postWithNoComments}
        currentUserId="current-user"
      />
    )

    const commentsButton = screen.getAllByRole('button').find(btn => 
      btn.getAttribute('title')?.includes('comment')
    )
    
    expect(commentsButton?.textContent).toContain('0')
  })

  it('should be positioned between reactions and share buttons', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    const buttons = screen.getAllByRole('button')
    
    // Find indices of key buttons
    const reactionButtonIndex = buttons.findIndex(btn => 
      btn.className.includes('rounded-full border-2') || btn.textContent?.includes('😊')
    )
    const commentsButtonIndex = buttons.findIndex(btn => 
      btn.getAttribute('title')?.includes('comment')
    )
    const shareButtonIndex = buttons.findIndex(btn => 
      btn.textContent?.includes('Share')
    )

    // Comments button should be between reactions and share
    expect(commentsButtonIndex).toBeGreaterThan(reactionButtonIndex)
    expect(shareButtonIndex).toBeGreaterThan(commentsButtonIndex)
  })

  it('should have proper styling with purple theme on hover', () => {
    const { isAuthenticated } = require('@/utils/auth')
    isAuthenticated.mockReturnValue(true)

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    const commentsButton = screen.getByTitle('View and add comments')
    
    // When authenticated, should have purple hover styles
    expect(commentsButton.className).toContain('hover:text-purple-500')
    expect(commentsButton.className).toContain('hover:bg-purple-50')
  })

  it('should show ring when there are comments', () => {
    const { isAuthenticated } = require('@/utils/auth')
    isAuthenticated.mockReturnValue(true)

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    const commentsButton = screen.getByTitle('View and add comments')
    
    expect(commentsButton.className).toContain('ring-1 ring-purple-200')
  })

  it('should not show ring when there are no comments', () => {
    const { isAuthenticated } = require('@/utils/auth')
    isAuthenticated.mockReturnValue(true)

    const postWithNoComments = {
      ...mockPost,
      commentsCount: 0,
    }

    render(
      <PostCard
        post={postWithNoComments}
        currentUserId="current-user"
      />
    )

    const commentsButton = screen.getByTitle('View and add comments')
    
    expect(commentsButton.className).not.toContain('ring-1 ring-purple-200')
  })

  it('should have proper accessibility attributes', () => {
    const { isAuthenticated } = require('@/utils/auth')
    isAuthenticated.mockReturnValue(true)

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    const commentsButton = screen.getByTitle('View and add comments')
    
    expect(commentsButton).toHaveAttribute('title', 'View and add comments')
  })

  it('should show login prompt for unauthenticated users', () => {
    const { isAuthenticated } = require('@/utils/auth')
    isAuthenticated.mockReturnValue(false)

    render(
      <PostCard
        post={mockPost}
        currentUserId={undefined}
      />
    )

    const commentsButton = screen.getAllByRole('button').find(btn => 
      btn.getAttribute('title')?.includes('Login to comment')
    )
    
    expect(commentsButton).toHaveAttribute('title', 'Login to comment on posts')
    expect(commentsButton?.className).toContain('text-gray-400')
  })

  it('should have minimum touch target size for mobile', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    const commentsButton = screen.getAllByRole('button').find(btn => 
      btn.getAttribute('title')?.includes('comment')
    )
    
    // Check for min-w-[44px] min-h-[44px] classes for touch targets
    expect(commentsButton?.className).toContain('min-w-[44px]')
    expect(commentsButton?.className).toContain('min-h-[44px]')
  })

  it('should maintain proper spacing with other buttons', () => {
    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Find the toolbar container
    const toolbar = screen.getAllByRole('button')[0].parentElement
    
    // Check for gap classes
    expect(toolbar?.className).toMatch(/gap-\d+/)
  })
})
