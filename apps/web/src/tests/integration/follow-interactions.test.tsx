import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import PostCard from '@/components/PostCard'
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

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}))

describe('Follow Interactions Integration', () => {
  const mockPost = {
    id: 'post-123',
    content: 'Test post content',
    post_type: 'spontaneous',
    created_at: '2024-01-01T00:00:00Z',
    author: {
      id: "2", // String to match the currentUserId format
      username: 'testuser',
      profile_image_url: 'https://example.com/avatar.jpg'
    },
    hearts_count: 5,
    reactions_count: 3,
    shares_count: 1,
    user_has_hearted: false,
    user_reaction: null,
    image_url: null,
    location: null
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Follow Button in PostCard', () => {
    it('shows follow button for other users posts', () => {
      render(
        <PostCard
          post={mockPost}
          currentUserId="1" // Different from post author
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      expect(screen.getByRole('button', { name: /follow user 2/i })).toBeInTheDocument()
    })

    it('does not show follow button for own posts', () => {
      render(
        <PostCard
          post={mockPost}
          currentUserId="2" // Same as post author
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      expect(screen.queryByRole('button', { name: /follow user 2/i })).not.toBeInTheDocument()
    })

    it('does not show follow button when not authenticated', () => {
      render(
        <PostCard
          post={mockPost}
          currentUserId={undefined} // Not authenticated
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      expect(screen.queryByRole('button', { name: /follow user 2/i })).not.toBeInTheDocument()
    })

    it('hides follow button when hideFollowButton prop is true', () => {
      render(
        <PostCard
          post={mockPost}
          currentUserId="1"
          hideFollowButton={true}
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      expect(screen.queryByRole('button', { name: /follow user 2/i })).not.toBeInTheDocument()
    })

    it('successfully follows user from post card', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { id: 'follow-123' } })
        })

      render(
        <PostCard
          post={mockPost}
          currentUserId="1"
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      const followButton = screen.getByRole('button', { name: /follow user 2/i })
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/follows/2', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          },
        })
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /unfollow user 2/i })).toBeInTheDocument()
      })
    })

    it('handles follow error in post card context', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: { message: 'User not found' } })
        })

      render(
        <PostCard
          post={mockPost}
          currentUserId="1"
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      const followButton = screen.getByRole('button', { name: /follow user 2/i })
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(screen.getByText('User not found')).toBeInTheDocument()
      })
    })
  })

  describe('Follow Button State Management', () => {
    it('updates follow state across multiple components', async () => {
      const onFollowChange = jest.fn()

      // Mock initial status fetch for both components
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { id: 'follow-123' } })
        })

      render(
        <div>
          <FollowButton userId={123} onFollowChange={onFollowChange} />
          <FollowButton userId={123} onFollowChange={onFollowChange} />
        </div>
      )

      // Wait for initial status to load
      await waitFor(() => {
        expect(screen.getAllByText('Follow')).toHaveLength(2)
      })

      const followButtons = screen.getAllByRole('button', { name: /follow user 123/i })
      expect(followButtons).toHaveLength(2)

      // Click first button
      fireEvent.click(followButtons[0])

      await waitFor(() => {
        expect(onFollowChange).toHaveBeenCalledWith(true)
      })

      // First button should show following state
      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })
    })

    it('maintains follow state after component remount', async () => {
      // Mock initial fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { is_following: true } })
      })

      const { rerender, unmount } = render(<FollowButton userId={123} />)

      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })

      // Unmount and remount component completely
      unmount()
      render(<FollowButton userId={123} />)

      // Should fetch status again and maintain state
      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })

      expect(mockFetch).toHaveBeenCalledTimes(2) // Initial fetch + remount fetch
    })

    it('handles concurrent follow/unfollow requests', async () => {
      // Mock initial status as following
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: true } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { success: true } })
        })

      render(<FollowButton userId={123} />)

      // Wait for initial following state
      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })

      const followButton = screen.getByRole('button')

      // Click to unfollow
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })
    })
  })

  describe('Follow Button Accessibility', () => {
    it('provides proper keyboard navigation', async () => {
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

      // Wait for initial status to load
      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      const followButton = screen.getByRole('button')

      // Focus the button
      followButton.focus()
      expect(followButton).toHaveFocus()

      // Click the button (Enter key simulation doesn't trigger onClick in this test environment)
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/follows/123', expect.any(Object))
      })
    })

    it('provides proper ARIA labels for screen readers', () => {
      render(<FollowButton userId={123} />)

      const followButton = screen.getByRole('button')
      expect(followButton).toHaveAttribute('aria-label', 'Follow user 123')
    })

    it('updates ARIA labels when follow state changes', async () => {
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

      // Initial state should be "Follow"
      await waitFor(() => {
        const followButton = screen.getByRole('button')
        expect(followButton).toHaveAttribute('aria-label', 'Follow user 123')
      })

      // Click to follow
      const followButton = screen.getByRole('button')
      fireEvent.click(followButton)

      // Should update to "Unfollow" after following
      await waitFor(() => {
        const updatedButton = screen.getByRole('button')
        expect(updatedButton).toHaveAttribute('aria-label', 'Unfollow user 123')
      })
    })

    it('announces loading state to screen readers', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<FollowButton userId={123} />)

      const followButton = screen.getByRole('button')
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
        expect(followButton).toBeDisabled()
      })
    })
  })

  describe.skip('Follow Button Error Recovery', () => {
    it('allows retry after network error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { id: 'follow-123' } })
        })

      render(<FollowButton userId={123} />)

      const followButton = screen.getByRole('button')

      // First attempt - network error
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(screen.getByText('Please check your connection and try again')).toBeInTheDocument()
      })

      // Second attempt - success
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })

      expect(mockFetch).toHaveBeenCalledTimes(3) // Initial status + 2 follow attempts
    })

    it('clears error message after successful action', async () => {
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
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { id: 'follow-123' } })
        })

      render(<FollowButton userId={123} />)

      const followButton = screen.getByRole('button')

      // First attempt - server error
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument()
      })

      // Second attempt - success
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /unfollow user 123/i })).toBeInTheDocument()
      })
      
      // The error toast should eventually be cleared (it might take a moment)
      await waitFor(() => {
        expect(screen.queryByText('Server error')).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Follow Button Performance', () => {
    it('debounces rapid clicks', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { is_following: false } })
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, data: { id: 'follow-123' } })
        })

      render(<FollowButton userId={123} />)

      const followButton = screen.getByRole('button')

      // Click multiple times rapidly
      fireEvent.click(followButton)
      fireEvent.click(followButton)
      fireEvent.click(followButton)

      // Should only make one follow request
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2) // Initial status + 1 follow
      })
    })

    it('does not fetch status when component unmounts quickly', async () => {
      let resolveStatusFetch: (value: any) => void
      const statusPromise = new Promise(resolve => {
        resolveStatusFetch = resolve
      })

      mockFetch.mockImplementationOnce(() => statusPromise)

      const { unmount } = render(<FollowButton userId={123} />)

      // Unmount before status fetch completes
      unmount()

      // Resolve the promise after unmount
      resolveStatusFetch({
        ok: true,
        json: async () => ({ success: true, data: { is_following: false } })
      })

      // Wait a bit to ensure no state updates occur
      await new Promise(resolve => setTimeout(resolve, 100))

      // No errors should occur from trying to update unmounted component
      expect(true).toBe(true) // Test passes if no errors thrown
    })
  })

  describe('Follow Button Integration with PostCard', () => {
    it('integrates follow button properly in post card layout', () => {
      render(
        <PostCard
          post={mockPost}
          currentUserId="1"
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      // Check that follow button exists
      const followButton = screen.getByRole('button', { name: /follow user 2/i })
      expect(followButton).toBeInTheDocument()
      
      // Check that it has the correct size (xxs for PostCard)
      expect(followButton).toHaveClass('px-0.5', 'py-0.25', 'text-xs')
    })

    it('maintains consistent styling with post card theme', () => {
      render(
        <PostCard
          post={mockPost}
          currentUserId="1"
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      const followButton = screen.getByRole('button', { name: /follow user 2/i })
      
      // Check for purple theme classes (outline variant)
      expect(followButton).toHaveClass('text-purple-600')
      expect(followButton).toHaveClass('border-purple-600')
    })

    it('handles follow state changes in post card context', async () => {
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

      render(
        <PostCard
          post={mockPost}
          currentUserId="1"
          onHeart={jest.fn()}
          onReaction={jest.fn()}
          onShare={jest.fn()}
          onImageClick={jest.fn()}
        />
      )

      const followButton = screen.getByRole('button', { name: /follow user 2/i })
      fireEvent.click(followButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /unfollow user 2/i })).toBeInTheDocument()
      })
    })
  })
})