/**
 * Integration tests for post page authentication behavior
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import PostPage from '@/app/post/[id]/page'
import { UserProvider } from '@/contexts/UserContext'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// Mock fetch
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRouter = {
  push: mockPush,
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <UserProvider>
      {children}
    </UserProvider>
  </ToastProvider>
)

describe('PostPage Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(global.fetch as jest.Mock).mockClear()
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
    mockPush.mockClear()
  })

  describe('Non-authenticated users', () => {
    beforeEach(() => {
      // No token in localStorage
      mockLocalStorage.getItem.mockReturnValue(null)
    })

    it('should allow viewing post page without authentication', async () => {
      // Mock successful post fetch without auth
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/posts/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'test-post-1',
              content: 'Test post content',
              author: {
                id: '1',
                name: 'Test User',
                username: 'testuser'
              },
              createdAt: '2024-01-01T00:00:00Z',
              postType: 'daily',
              heartsCount: 5,
              reactionsCount: 2,
              isHearted: false
            })
          })
        }
        return Promise.reject(new Error('Unexpected fetch call'))
      })

      render(
        <TestWrapper>
          <PostPage params={{ id: 'test-post-1' }} />
        </TestWrapper>
      )

      // Should not redirect to login
      expect(mockPush).not.toHaveBeenCalledWith('/auth/login')

      // Should show loading initially
      expect(screen.getByText('Loading post...')).toBeInTheDocument()

      // Wait for component to load
      await waitFor(() => {
        expect(screen.queryByText('Loading post...')).not.toBeInTheDocument()
      })

      // Should show "Back to Home" for non-authenticated users
      await waitFor(() => {
        const backLink = screen.getByText('← Back to Home')
        expect(backLink).toBeInTheDocument()
        expect(backLink.closest('a')).toHaveAttribute('href', '/')
      })
    })

    it('should show authentication notice in PostCard for non-authenticated users', async () => {
      // Mock successful post fetch
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/posts/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'test-post-1',
              content: 'Test post content',
              author: {
                id: '1',
                name: 'Test User',
                username: 'testuser'
              },
              createdAt: '2024-01-01T00:00:00Z',
              postType: 'daily',
              heartsCount: 5,
              reactionsCount: 2,
              isHearted: false
            })
          })
        }
        return Promise.reject(new Error('Unexpected fetch call'))
      })

      render(
        <TestWrapper>
          <PostPage params={{ id: 'test-post-1' }} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading post...')).not.toBeInTheDocument()
      })

      // Should show authentication notice
      await waitFor(() => {
        expect(screen.getByText('Join to interact with this post')).toBeInTheDocument()
        expect(screen.getByText('Log In')).toBeInTheDocument()
        expect(screen.getByText('Sign Up')).toBeInTheDocument()
      })
    })
  })

  describe('Authenticated users', () => {
    beforeEach(() => {
      // Mock token in localStorage
      mockLocalStorage.getItem.mockReturnValue('mock-token')
    })

    it('should fetch user profile and show "Back to Feed" for authenticated users', async () => {
      // Mock user profile fetch
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              id: 1,
              username: 'testuser',
              display_name: 'Test User',
              email: 'test@example.com'
            }
          })
        })
        // Mock post fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'test-post-1',
            content: 'Test post content',
            author: {
              id: '1',
              name: 'Test User',
              username: 'testuser'
            },
            createdAt: '2024-01-01T00:00:00Z',
            postType: 'daily',
            heartsCount: 5,
            reactionsCount: 2,
            isHearted: false
          })
        })

      render(
        <TestWrapper>
          <PostPage params={{ id: 'test-post-1' }} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading post...')).not.toBeInTheDocument()
      })

      // Should show "Back to Feed" for authenticated users
      await waitFor(() => {
        const backLink = screen.getByText('← Back to Feed')
        expect(backLink).toBeInTheDocument()
        expect(backLink.closest('a')).toHaveAttribute('href', '/feed')
      })

      // Should not show authentication notice
      expect(screen.queryByText('Join to interact with this post')).not.toBeInTheDocument()
    })

    it('should handle invalid token gracefully', async () => {
      // Mock failed user profile fetch (invalid token)
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        })
        // Mock successful post fetch (should still work without auth)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'test-post-1',
            content: 'Test post content',
            author: {
              id: '1',
              name: 'Test User',
              username: 'testuser'
            },
            createdAt: '2024-01-01T00:00:00Z',
            postType: 'daily',
            heartsCount: 5,
            reactionsCount: 2,
            isHearted: false
          })
        })

      render(
        <TestWrapper>
          <PostPage params={{ id: 'test-post-1' }} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading post...')).not.toBeInTheDocument()
      })

      // Should clear invalid token
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('access_token')

      // Should show "Back to Home" since user is not authenticated
      await waitFor(() => {
        const backLink = screen.getByText('← Back to Home')
        expect(backLink).toBeInTheDocument()
        expect(backLink.closest('a')).toHaveAttribute('href', '/')
      })
    })
  })

  describe('Post access errors', () => {
    it('should show appropriate error for private posts', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      // Mock post fetch returning 403 (private post)
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'This post is private' })
      })

      render(
        <TestWrapper>
          <PostPage params={{ id: 'private-post' }} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading post...')).not.toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText('This post is private')).toBeInTheDocument()
        expect(screen.getByText('This post is private and can only be viewed by the author.')).toBeInTheDocument()
        expect(screen.getByText('Log In')).toBeInTheDocument()
      })
    })

    it('should show appropriate error for non-existent posts', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      // Mock post fetch returning 404
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Post not found' })
      })

      render(
        <TestWrapper>
          <PostPage params={{ id: 'non-existent-post' }} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading post...')).not.toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText('Post not found')).toBeInTheDocument()
        expect(screen.getByText('This post may have been deleted or you may not have permission to view it.')).toBeInTheDocument()
        expect(screen.getByText('Back to Home')).toBeInTheDocument()
      })
    })
  })
})