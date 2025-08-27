import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  postType: 'daily' as const,
  heartsCount: 5,
  reactionsCount: 3,
  isHearted: false,
  currentUserReaction: undefined,
}

describe('SharedPostWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(fetch as jest.Mock).mockClear()
  })

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(false)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue(null)
    })

    it('should show authentication notice', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.getByText('Join to interact with this post')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Log In')).toBeInTheDocument()
      expect(screen.getByText('Sign Up')).toBeInTheDocument()
    })

    it('should show counters but disable interactions', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        // Heart button should have disabled styling
        const heartButton = screen.getByTitle('Login to like posts')
        expect(heartButton).toHaveClass('text-gray-400')
        
        // Reaction button should have disabled styling
        const reactionButton = screen.getByTitle('Login to react to posts')
        expect(reactionButton).toHaveClass('text-gray-400')
      })
    })

    it('should redirect to login when trying to interact', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.getByText('Join to interact with this post')).toBeInTheDocument()
      })
      
      // Click heart button
      const heartButton = screen.getByTitle('Login to like posts')
      fireEvent.click(heartButton)
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/login')
      })
    })
  })

  describe('when user is authenticated', () => {
    beforeEach(() => {
      ;(authUtils.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(authUtils.getAccessToken as jest.Mock).mockReturnValue('mock-token')
      
      // Mock successful API responses
      ;(fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'current-user-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-post-1',
            is_hearted: false,
            current_user_reaction: null,
            hearts_count: 5,
            reactions_count: 3,
          }),
        })
    })

    it('should not show authentication notice', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Join to interact with this post')).not.toBeInTheDocument()
      })
    })

    it('should enable interactions', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        // Should not show authentication notice
        expect(screen.queryByText('Join to interact with this post')).not.toBeInTheDocument()
        
        // Should not have disabled login titles
        expect(screen.queryByTitle('Login to like posts')).not.toBeInTheDocument()
        expect(screen.queryByTitle('Login to react to posts')).not.toBeInTheDocument()
      })
    })

    it('should fetch user-specific data on mount', async () => {
      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/users/me/profile', {
          headers: {
            'Authorization': 'Bearer mock-token',
          },
        })
        
        expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1', {
          headers: {
            'Authorization': 'Bearer mock-token',
          },
        })
      })
    })

    it('should handle heart interaction', async () => {
      ;(fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'current-user-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-post-1',
            is_hearted: false,
            current_user_reaction: null,
            hearts_count: 5,
            reactions_count: 3,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            hearts_count: 6,
            is_hearted: true,
          }),
        })

      render(<SharedPostWrapper post={mockPost} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Join to interact with this post')).not.toBeInTheDocument()
      })
      
      // Find heart button by looking for buttons that contain heart icon
      const buttons = screen.getAllByRole('button')
      const heartButton = buttons.find(button => {
        const svg = button.querySelector('svg')
        return svg && svg.classList.contains('lucide-heart')
      })
      
      expect(heartButton).toBeInTheDocument()
      
      if (heartButton) {
        fireEvent.click(heartButton)
        
        await waitFor(() => {
          expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/heart', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json',
            },
          })
        })
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
        expect(screen.getByText('Join to interact with this post')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})