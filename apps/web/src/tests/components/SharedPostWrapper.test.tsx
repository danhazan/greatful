import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { useRouter } from 'next/navigation'
import SharedPostWrapper from '@/components/SharedPostWrapper'
import * as authUtils from '@/utils/auth'
import { createMockRouter } from '../mocks/nextNavigationMock'

// Mock the router
jest.mock('next/navigation', () => require('../mocks/nextNavigationMock').mockNavigation)

// Mock the auth utilities
jest.mock('@/utils/auth', () => ({
  isAuthenticated: jest.fn(),
  getAccessToken: jest.fn(),
}))

var mockRequestRaw: any | undefined
jest.mock('@/utils/apiClient', () => {
  const fn = jest.fn()
  mockRequestRaw = fn
  return {
    apiClient: {
      requestRaw: fn,
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      invalidateTags: jest.fn(),
      invalidateCache: jest.fn(),
      clearCache: jest.fn(),
      setViewerScope: jest.fn(),
      getViewerScope: jest.fn(() => 'anon'),
      getCurrentUserProfile: jest.fn(() => Promise.resolve({ id: 'current-user-123' })),
      getPosts: jest.fn(),
      getUserPosts: jest.fn(),
      getUserProfile: jest.fn(),
      getFollowStatus: jest.fn(),
      toggleFollow: jest.fn(),
      getNotifications: jest.fn(),
      getBatchFollowStatuses: jest.fn(),
      invalidateUserPosts: jest.fn(),
      invalidatePostDetails: jest.fn(),
      invalidateFeed: jest.fn(),
      invalidateProfile: jest.fn(),
      invalidatePostAuthorGraph: jest.fn(),
      patchTaggedQuery: jest.fn(),
      invalidateRelatedCache: jest.fn(),
    },
  }
})

// Mock fetch for any remaining raw fetches
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRouter = createMockRouter({ push: mockPush })

const mockPost = {
  id: 'test-post-1',
  content: 'Test gratitude post content',
  author: {
    id: '1',
    name: 'Test User',
    image: 'https://example.com/avatar.jpg',
  },
  createdAt: '2025-01-08T10:00:00Z',
  reactionsCount: 3,
  currentUserReaction: undefined,
}

describe('SharedPostWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(false)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue(null)
    })

    it('should show authentication notice', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.getByText('Join to interact with this post!')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Log In')).toBeInTheDocument()
      expect(screen.getByText('Sign Up')).toBeInTheDocument()
    })

    it('should show counters but disable interactions', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        // Reaction button should have dimmed styling
        const reactionButton = screen.getByTitle('React with emoji')
        expect(reactionButton).toHaveClass('text-gray-400')
        expect(reactionButton).not.toBeDisabled()
      })
    })

    it('should have a non-clickable reactions banner', async () => {
      const postWithReactions = { ...mockPost, reactionsCount: 5, reactionEmojiCodes: ['heart_eyes'] }
      render(<SharedPostWrapper post={postWithReactions} />)
      
      await waitFor(() => {
        // The banner should be present but not as a button
        const reactionsDisplay = screen.getByTitle('Reactions')
        expect(reactionsDisplay.tagName).toBe('DIV')
        expect(reactionsDisplay).not.toHaveAttribute('role', 'button')
      })
    })

    it('should not redirect to login when trying to interact', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.getByText('Join to interact with this post!')).toBeInTheDocument()
      })
      
      // Click reaction button — should not redirect
      const reactionButton = screen.getByTitle('React with emoji')
      expect(reactionButton).not.toBeDisabled()
      fireEvent.click(reactionButton)
      
      // Wait a bit to ensure no redirect happens
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should show Send as Message in share modal but disabled', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.getByText('Join to interact with this post!')).toBeInTheDocument()
      })
      
      // Open share modal
      const shareButton = screen.getByTitle('Share this post')
      fireEvent.click(shareButton)
      
      await waitFor(() => {
        const sendAsMessageButton = screen.getByText('Send as Message').closest('button')
        expect(sendAsMessageButton).toBeInTheDocument()
        expect(sendAsMessageButton).toBeDisabled()
        expect(sendAsMessageButton).toHaveAttribute('aria-disabled', 'true')
      })
      
      // Clicking it should not change view to user search
      const sendAsMessageButton = screen.getByText('Send as Message').closest('button')
      if (sendAsMessageButton) fireEvent.click(sendAsMessageButton)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(screen.queryByPlaceholderText('Search users to send to...')).not.toBeInTheDocument()
    })

    it('should render location as non-interactive text', async () => {
      const postWithLocation = { ...mockPost, location: 'Paris, France' }
      render(<SharedPostWrapper post={postWithLocation} />)
      
      await waitFor(() => {
        const locationDisplay = screen.getByTitle('Paris, France')
        expect(locationDisplay.tagName).toBe('DIV')
        expect(locationDisplay).not.toHaveClass('hover:text-purple-600')
        expect(locationDisplay).toHaveClass('cursor-default')
      })
    })
  })

  describe('when user is authenticated', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue('mock-token')

      // Mock requestRaw for user-specific post data fetch
      mockRequestRaw!.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-post-1',
            current_user_reaction: null,
            reactions_count: 3,
            author_id: '1',
          }),
        })
      )
    })

    it('should not show authentication notice', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Join to interact with this post!')).not.toBeInTheDocument()
      })
    })

    it('should enable interactions', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        // Should not show authentication notice
        expect(screen.queryByText('Join to interact with this post!')).not.toBeInTheDocument()
        
        // Should not have disabled login titles
        expect(screen.queryByTitle('Login to react to posts')).not.toBeInTheDocument()
      })
    })

    it('should fetch user-specific data on mount', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(mockRequestRaw!).toHaveBeenCalledWith(
          '/posts/test-post-1',
        )
      })
    })

    it('should handle heart interaction', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Join to interact with this post')).not.toBeInTheDocument()
      })
      
      // Find reaction button by title
      let reactionButton: HTMLElement | null = null
      await waitFor(() => {
        reactionButton = screen.getByTitle('React with emoji')
        expect(reactionButton).toBeInTheDocument()
      })
      
      if (reactionButton) {
        fireEvent.click(reactionButton)
        expect(reactionButton).toBeInTheDocument()
      }
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue('mock-token')
    })

    it('should handle API errors gracefully', async () => {
      mockRequestRaw!.mockRejectedValue(new Error('API Error'))
      
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        // Should still render the post even if API calls fail
        expect(screen.getByText('Test gratitude post content')).toBeInTheDocument()
      })
    })

    it('should handle API errors without showing auth notice', async () => {
      mockRequestRaw!.mockRejectedValue(new Error('API Error'))
      
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        // Auth state derived from UserContext, not from API call success
        expect(screen.queryByText('Join to interact with this post!')).not.toBeInTheDocument()
        // Post content should still render
        expect(screen.getByText('Test gratitude post content')).toBeInTheDocument()
      })
    })
  })
})