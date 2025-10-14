import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@/tests/utils/testUtils'
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

describe('FollowButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    
    // Default mock for all API calls that useUserState makes
    mockFetch.mockImplementation((url) => {
      if (url.includes('/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
        })
      }
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ is_following: false }),
        })
      }
      if (url.includes('/follows/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        })
      }
      // Default fallback
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Initial Rendering', () => {
    it('renders follow button with default state', async () => {
      render(<FollowButton userId={123} />)
      
      expect(screen.getByRole('button')).toBeInTheDocument()
      
      // Wait for the component to finish loading
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })
      
      expect(screen.getByLabelText('Follow user 123')).toBeInTheDocument()
    })

    it('renders following button when initially following', async () => {
      // Mock follow status as true
      mockFetch.mockImplementation((url) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      })
      
      render(<FollowButton userId={123} initialFollowState={true} />)
      
      // The component should immediately show following state due to initialFollowState
      expect(screen.getByText(/Following/)).toBeInTheDocument()
      expect(screen.getByLabelText('Unfollow user 123')).toBeInTheDocument()
    })

    it('applies custom className', async () => {
      render(<FollowButton userId={123} className="custom-class" />)
      
      // Wait for component to load
      await waitFor(() => {
        const button = screen.getByRole('button')
        expect(button).toHaveClass('custom-class')
      })
    })

    it('renders different sizes correctly', async () => {
      const { rerender } = render(<FollowButton userId={123} size="xxs" />)
      
      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveClass('px-2', 'py-0.5', 'text-xs')
      })

      rerender(<FollowButton userId={123} size="xs" />)
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveClass('px-2', 'py-1', 'text-xs')
      })

      rerender(<FollowButton userId={123} size="sm" />)
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveClass('px-2', 'py-1', 'text-xs')
      })

      rerender(<FollowButton userId={123} size="md" />)
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1.5', 'text-sm')
      })

      rerender(<FollowButton userId={123} size="lg" />)
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveClass('px-3', 'py-2', 'text-sm')
      })
    })

    it('renders different follow states correctly', async () => {
      // Test not following state
      const { unmount } = render(<FollowButton userId={123} initialFollowState={false} />)
      
      // Wait for component to load
      await waitFor(() => {
        const button = screen.getByRole('button')
        expect(button).toHaveClass('bg-transparent')
        expect(button).toHaveClass('text-purple-600')
      })
      unmount()

      // Mock follow status as true for following state
      mockFetch.mockImplementation((url) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '456', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      })

      // Test following state with fresh component
      render(<FollowButton userId={456} initialFollowState={true} />)
      
      await waitFor(() => {
        const followingButton = screen.getByRole('button')
        expect(followingButton).toHaveClass('bg-purple-600')
        expect(followingButton).toHaveClass('text-white')
      })
    })
  })

  describe('Follow Status Fetching', () => {
    it('fetches initial follow status on mount', async () => {
      // Reset mocks and set up specific expectations
      mockFetch.mockClear()
      
      // Mock the API calls that useUserState makes
      mockFetch.mockImplementation((url) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      })

      render(<FollowButton userId={123} />)

      await waitFor(() => {
        // Check that the API was called (useUserState fetches user data)
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/users/me/profile'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token',
            }),
          })
        )
      })

      await waitFor(() => {
        // Check that the follow status API was also called
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/follows/123/status'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token',
            }),
          })
        )
      })

      await waitFor(() => {
        expect(screen.getByText(/Following/)).toBeInTheDocument()
      })
    })

    it('handles fetch error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<FollowButton userId={123} />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Should still render the button with initial state
      expect(screen.getByText('Follow me!')).toBeInTheDocument()
    })

    it('does not fetch status when no token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      render(<FollowButton userId={123} />)

      // Wait a bit to ensure no fetch is made
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Follow/Unfollow Actions', () => {
    it('successfully follows a user', async () => {
      const onFollowChange = jest.fn()
      
      // Mock initial not-following state, then successful follow
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: false }),
          })
        }
        if (url.includes('/follows/123') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<FollowButton userId={123} onFollowChange={onFollowChange} initialFollowState={false} />)

      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Should make follow request
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/follows/123'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json',
            }),
          })
        )
      })

      // Should show success toast
      await waitFor(() => {
        expect(screen.getByText('User followed!')).toBeInTheDocument()
      })
      
      // Should call the callback
      await waitFor(() => {
        expect(onFollowChange).toHaveBeenCalledWith(true)
      })
    })

    it('successfully unfollows a user', async () => {
      const onFollowChange = jest.fn()
      
      // Mock initial following state, then successful unfollow
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: true }),
          })
        }
        if (url.includes('/follows/123') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<FollowButton userId={123} onFollowChange={onFollowChange} initialFollowState={true} />)

      // Component should immediately show following state due to initialFollowState
      expect(screen.getByText(/Following/)).toBeInTheDocument()

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Should make unfollow request
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/follows/123'),
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json',
            }),
          })
        )
      })

      // Should show success toast
      await waitFor(() => {
        expect(screen.getByText('User unfollowed!')).toBeInTheDocument()
      })
      
      // Should call the callback
      await waitFor(() => {
        expect(onFollowChange).toHaveBeenCalledWith(false)
      })
    })

    it('handles authentication error', async () => {
      // Mock successful initial load, then 401 on follow action
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: false }),
          })
        }
        if (url.includes('/follows/123') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<FollowButton userId={123} />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Should make the API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/follows/123'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      // Button should remain in not-following state after error
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })
    })

    it('handles user not found error', async () => {
      // Mock successful initial load, then 404 on follow action
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: false }),
          })
        }
        if (url.includes('/follows/123') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: async () => ({ error: 'User not found' }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<FollowButton userId={123} />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Should make the API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/follows/123'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      // Button should remain in not-following state after error
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })
    })

    it('handles conflict error (already following)', async () => {
      // Mock successful initial load, then 409 on follow action
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: false }),
          })
        }
        if (url.includes('/follows/123') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: async () => ({ error: 'Follow relationship already exists' }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<FollowButton userId={123} />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Should make the API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/follows/123'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      // Button should remain in not-following state after error
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })
    })

    it('handles validation error (self-follow)', async () => {
      // Mock successful initial load, then 422 on follow action
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: false }),
          })
        }
        if (url.includes('/follows/123') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 422,
            json: async () => ({ error: 'Cannot follow yourself' }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<FollowButton userId={123} />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Should make the API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/follows/123'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      // Button should remain in not-following state after error
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })
    })

    it('handles network error', async () => {
      // Mock successful initial load, then network error on follow action
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: false }),
          })
        }
        if (url.includes('/follows/123') && options?.method === 'POST') {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<FollowButton userId={123} />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Should attempt the API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/follows/123'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      // Button should remain in not-following state after error
      await waitFor(() => {
        expect(screen.getByText('Follow me!')).toBeInTheDocument()
      })
    })

    it('handles missing token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Please log in to follow users')).toBeInTheDocument()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('handles server errors gracefully without crashing', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ is_following: false })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Server error' } })
        })

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      
      await act(async () => {
        fireEvent.click(button)
      })

      // Wait for the error handling to complete - component should not crash
      await waitFor(() => {
        // Button should still be rendered and functional
        expect(button).toBeInTheDocument()
        expect(button).not.toBeDisabled()
      })
    })

    it('handles network errors gracefully without crashing', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ is_following: false })
        })
        .mockRejectedValueOnce(new Error('Network error'))

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      
      await act(async () => {
        fireEvent.click(button)
      })

      // Wait for the error handling to complete - component should not crash
      await waitFor(() => {
        // Button should still be rendered and functional
        expect(button).toBeInTheDocument()
        expect(button).not.toBeDisabled()
      })
    })

    it('handles authentication errors by showing appropriate state', async () => {
      // Mock no access token
      mockLocalStorage.getItem.mockReturnValue(null)

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      
      await act(async () => {
        fireEvent.click(button)
      })

      // Component should handle the authentication error gracefully
      // Button should still be rendered
      expect(button).toBeInTheDocument()
      
      // Verify no API call was made since there's no token
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/follow'),
        expect.any(Object)
      )
    })
  })

  describe('Loading States', () => {
    it('disables button during loading', async () => {
      mockFetch.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, data: {} })
        }), 100)
      }))

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toBeDisabled()
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })
    })

    it('shows loading spinner during request', async () => {
      mockFetch.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, data: {} })
        }), 100)
      }))

      render(<FollowButton userId={123} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('button')).toContainHTML('animate-spin')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<FollowButton userId={123} />)
      
      expect(screen.getByLabelText('Follow user 123')).toBeInTheDocument()
    })

    it('updates ARIA label when following state changes', async () => {
      // Mock initial following state
      mockFetch.mockImplementation((url) => {
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: '123', username: 'testuser', display_name: 'Test User' }),
          })
        }
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ is_following: true }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<FollowButton userId={123} initialFollowState={true} />)

      // Component should immediately show correct ARIA label due to initialFollowState
      expect(screen.getByLabelText('Unfollow user 123')).toBeInTheDocument()
    })

    it('has focus styles', () => {
      render(<FollowButton userId={123} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-purple-500')
    })
  })
})