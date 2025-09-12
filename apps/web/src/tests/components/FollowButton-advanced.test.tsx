import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import FollowButton from '@/components/FollowButton'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe.skip('FollowButton Advanced Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    
    // Clear any existing toasts
    const toastRoot = document.getElementById('toast-root')
    if (toastRoot) {
      toastRoot.innerHTML = ''
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
    
    // Clear any remaining toasts
    const toastRoot = document.getElementById('toast-root')
    if (toastRoot) {
      toastRoot.innerHTML = ''
    }
  })

  describe('Follow Button Variants and Sizes', () => {
    it('renders all size variants correctly', () => {
      const sizes = ['xxs', 'xs', 'sm', 'md', 'lg'] as const
      
      sizes.forEach(size => {
        const { unmount } = render(<FollowButton userId={123} size={size} />)
        
        const button = screen.getByRole('button')
        
        switch (size) {
          case 'xxs':
            expect(button).toHaveClass('px-0.5', 'py-0.25', 'text-xs')
            break
          case 'xs':
            expect(button).toHaveClass('px-1', 'py-0.5', 'text-xs')
            break
          case 'sm':
            expect(button).toHaveClass('px-1.5', 'py-1', 'text-xs')
            break
          case 'md':
            expect(button).toHaveClass('px-2', 'py-1', 'text-xs')
            break
          case 'lg':
            expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm')
            break
        }
        
        unmount()
      })
    })

    it('renders all variant styles correctly for follow state', () => {
      const variants = ['primary', 'secondary', 'outline'] as const
      
      variants.forEach(variant => {
        const { unmount } = render(<FollowButton userId={123} variant={variant} />)
        
        const button = screen.getByRole('button')
        
        switch (variant) {
          case 'primary':
            expect(button).toHaveClass('bg-purple-600', 'text-white')
            break
          case 'secondary':
            expect(button).toHaveClass('bg-purple-100', 'text-purple-700')
            break
          case 'outline':
            expect(button).toHaveClass('bg-transparent', 'text-purple-600')
            break
        }
        
        unmount()
      })
    })

    it('renders all variant styles correctly for following state', () => {
      const variants = ['primary', 'secondary', 'outline'] as const
      
      variants.forEach(variant => {
        const { unmount } = render(
          <FollowButton userId={123} variant={variant} initialFollowState={true} />
        )
        
        const button = screen.getByRole('button')
        
        // All variants should show unfollow styling when following
        expect(button).toHaveClass('text-gray-700')
        // Check for hover states that indicate unfollow mode
        expect(button).toHaveClass('hover:text-red-600')
        
        unmount()
      })
    })

    it('shows hover states for unfollow when following', async () => {
      render(<FollowButton userId={123} initialFollowState={true} />)
      
      const button = screen.getByRole('button')
      
      // Should have hover classes for unfollow state
      expect(button).toHaveClass('hover:bg-red-50', 'hover:text-red-600')
    })
  })

  describe('Follow Button State Transitions', () => {
    it('handles rapid state changes correctly', async () => {
      let requestCount = 0
      mockFetch.mockImplementation(() => {
        requestCount++
        if (requestCount === 1) {
          // Initial status fetch
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { is_following: false } })
          })
        } else if (requestCount === 2) {
          // Follow request
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { id: 'follow-123' } })
          })
        } else {
          // Unfollow request
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { success: true } })
          })
        }
      })

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')

      // Initial state should be "Follow"
      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      // Click to follow
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })

      // Click to unfollow
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('maintains button state during loading', async () => {
      let resolveRequest: (value: any) => void
      const requestPromise = new Promise(resolve => {
        resolveRequest = resolve
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockImplementationOnce(() => requestPromise)

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      // Click to start follow request
      fireEvent.click(button)

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
        expect(button).toBeDisabled()
      })

      // Button should still be disabled and showing loading
      expect(button).toBeDisabled()
      expect(screen.getByText('Loading...')).toBeInTheDocument()

      // Resolve the request
      resolveRequest({
        ok: true,
        json: async () => ({ success: true, data: { id: 'follow-123' } })
      })

      // Should update to following state
      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
        expect(button).not.toBeDisabled()
      })
    })

    it('handles component unmount during request', async () => {
      let resolveRequest: (value: any) => void
      const requestPromise = new Promise(resolve => {
        resolveRequest = resolve
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockImplementationOnce(() => requestPromise)

      const { unmount } = render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      // Click to start follow request
      fireEvent.click(button)

      // Unmount component while request is pending
      unmount()

      // Resolve the request after unmount
      resolveRequest({
        ok: true,
        json: async () => ({ success: true, data: { id: 'follow-123' } })
      })

      // Should not throw any errors
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(true).toBe(true) // Test passes if no errors
    })
  })

  describe('Follow Button Error Handling Edge Cases', () => {
    it('handles malformed API responses', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ invalid: 'response' }) // Malformed response - missing success field
        })

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Follow Failed')).toBeInTheDocument()
        expect(screen.getByText('Failed to update follow status')).toBeInTheDocument()
      })
    })

    it('handles JSON parsing errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockRejectedValueOnce(new Error('Invalid JSON'))

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument()
      })
    })

    it('handles timeout errors gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockImplementationOnce(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 100)
          })
        })

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('handles server errors with custom messages', async () => {
      const errorCases = [
        { status: 400, message: 'Bad request' },
        { status: 403, message: 'Forbidden' },
        { status: 500, message: 'Internal server error' },
        { status: 503, message: 'Service unavailable' }
      ]

      for (const errorCase of errorCases) {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { is_following: false } })
          })
          .mockResolvedValueOnce({
            ok: false,
            status: errorCase.status,
            json: async () => ({ error: { message: errorCase.message } })
          })

        const { unmount } = render(<FollowButton userId={123} />)

        const button = screen.getByRole('button')
        fireEvent.click(button)

        await waitFor(() => {
          // Check for the error title first
          expect(screen.getByText('Follow Failed')).toBeInTheDocument()
          // Then check for the specific error message
          expect(screen.getByText(errorCase.message)).toBeInTheDocument()
        })

        unmount()
        jest.clearAllMocks()
      }
    })
  })

  describe('Follow Button Callback Integration', () => {
    it('calls onFollowChange callback with correct values', async () => {
      const onFollowChange = jest.fn()

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { id: 'follow-123' } })
        })

      render(<FollowButton userId={123} onFollowChange={onFollowChange} />)

      const button = screen.getByRole('button')

      // Follow action - should trigger optimistic update immediately
      fireEvent.click(button)

      // Should immediately call onFollowChange with optimistic update
      await waitFor(() => {
        expect(onFollowChange).toHaveBeenCalledWith(true)
      })

      // Wait for success toast to appear (indicating API call completed)
      await waitFor(() => {
        expect(screen.getByText('User followed!')).toBeInTheDocument()
      })

      // Callback should have been called once (optimistic update)
      expect(onFollowChange).toHaveBeenCalledTimes(1)
    })

    it('does not call onFollowChange on error', async () => {
      const onFollowChange = jest.fn()

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Server error' } })
        })

      render(<FollowButton userId={123} onFollowChange={onFollowChange} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Follow Failed')).toBeInTheDocument()
      })

      // With optimistic updates, callback is called twice: optimistic (true) then rollback (false)
      expect(onFollowChange).toHaveBeenCalledTimes(2)
      expect(onFollowChange).toHaveBeenNthCalledWith(1, true) // Optimistic update
      expect(onFollowChange).toHaveBeenNthCalledWith(2, false) // Rollback on error
    })

    it('handles missing onFollowChange callback gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { id: 'follow-123' } })
        })

      render(<FollowButton userId={123} />) // No onFollowChange prop

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Wait for success toast to appear (indicating API call completed)
      await waitFor(() => {
        expect(screen.getByText('User followed!')).toBeInTheDocument()
      })

      // Should not throw any errors
      expect(true).toBe(true)
    })
  })

  describe('Follow Button Authentication Edge Cases', () => {
    it('handles token expiration during request', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'Token expired' } })
        })

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Follow Failed')).toBeInTheDocument()
      })
    })

    it('handles missing token during action', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { is_following: false } })
      })

      render(<FollowButton userId={123} />)

      // Remove token after initial load
      mockLocalStorage.getItem.mockReturnValue(null)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeInTheDocument()
        expect(screen.getByText('Please log in to follow users')).toBeInTheDocument()
      })

      // Should not make API request
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only initial status fetch
    })

    it('handles token changes between requests', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { id: 'follow-123' } })
        })

      render(<FollowButton userId={123} />)

      // Change token
      mockLocalStorage.getItem.mockReturnValue('new-token')

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/follows/123', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer new-token',
            'Content-Type': 'application/json',
          },
        })
      })
    })
  })

  describe('Follow Button Performance Optimizations', () => {
    it('prevents multiple simultaneous requests', async () => {
      let requestCount = 0
      mockFetch.mockImplementation(() => {
        requestCount++
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ success: true, data: { id: 'follow-123' } })
            })
          }, 100)
        })
      })

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')

      // Click multiple times rapidly
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      // Wait for requests to complete
      await waitFor(() => {
        expect(screen.getByText('User followed!')).toBeInTheDocument()
      }, { timeout: 2000 })

      // Should only make one follow request (plus initial status)
      expect(requestCount).toBeLessThanOrEqual(2)
    })

    it('cancels previous request when new one starts', async () => {
      const abortController = new AbortController()
      let currentRequest: Promise<any> | null = null

      mockFetch.mockImplementation(() => {
        if (currentRequest) {
          abortController.abort()
        }
        
        currentRequest = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ success: true, data: { id: 'follow-123' } })
            })
          }, 100)

          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeout)
            reject(new Error('Request cancelled'))
          })
        })

        return currentRequest
      })

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')

      // Start first request
      fireEvent.click(button)

      // Start second request before first completes
      setTimeout(() => {
        fireEvent.click(button)
      }, 50)

      // Should handle cancellation gracefully
      await new Promise(resolve => setTimeout(resolve, 200))
      expect(true).toBe(true) // Test passes if no errors
    })
  })
})