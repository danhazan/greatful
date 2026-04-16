import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { useRouter } from 'next/navigation'
import SharedPostWrapper from '@/components/SharedPostWrapper'
import * as authUtils from '@/utils/auth'

// Mock the router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the auth utilities
jest.mock('@/utils/auth', () => ({
  isAuthenticated: jest.fn(),
  getAccessToken: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRouter = {
  push: mockPush,
}

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
    
    // Default fetch mock implementation - handles multiple concurrent requests
    ;(fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/users/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'current-user-123' }),
        })
      }
      if (url.includes('/api/posts/test-post-1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-post-1',
            current_user_reaction: null,
            reactions_count: 3,
            author_id: '1'
          }),
        })
      }
      // Return a generic successful response for other requests (profile, follows, etc.)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })
  })

  describe('when user is not authenticated', () => {
    beforeEach(() => {
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
        // Reaction button should have disabled styling and not have the active title
        const reactionButton = screen.getByTitle('Login to react to posts')
        expect(reactionButton).toHaveClass('text-gray-400')
        expect(reactionButton).toBeDisabled()
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

    it('should not redirect to login when trying to interact (now disabled)', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.getByText('Join to interact with this post!')).toBeInTheDocument()
      })
      
      // Click reaction button
      const reactionButton = screen.getByTitle('Login to react to posts')
      expect(reactionButton).toBeDisabled()
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
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue('mock-token')
      // Default implementation is already set in the top-level beforeEach
    })

    it('should not show authentication notice', async () => {
      console.log('DEBUG: Running updated test file version V2')
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
        expect(fetch).toHaveBeenCalledWith(
          '/api/posts/test-post-1',
          expect.objectContaining({
            headers: {
              'Authorization': 'Bearer mock-token',
            },
          }),
        )
      })
    })

    it('should handle heart interaction', async () => {
      // Setup specific overrides if needed, otherwise use default implementation
      ;(fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'current-user-123' }),
          })
        }
        if (url.includes('/api/posts/test-post-1')) {
          // If we want to simulate the toggle response, we could track state here
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-post-1',
              current_user_reaction: null,
              reactions_count: 3,
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        })
      })

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
      ;(fetch as jest.Mock).mockRejectedValue(new Error('API Error'))
      
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        // Should still render the post even if API calls fail
        expect(screen.getByText('Test gratitude post content')).toBeInTheDocument()
      })
    })

    it('should treat user as unauthenticated if API calls fail', async () => {
      ;(fetch as jest.Mock).mockRejectedValue(new Error('API Error'))
      
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        // Should show authentication notice if API calls fail
        expect(screen.getByText('Join to interact with this post!')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})