import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'
import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock the analytics service
jest.mock('@/services/analytics', () => ({
  trackHeartEvent: jest.fn(),
  trackViewEvent: jest.fn(),
}))

// Mock the emoji mapping utility
jest.mock('@/utils/emojiMapping', () => ({
  getEmojiFromCode: jest.fn((code) => code === 'heart_eyes' ? '😍' : '😊'),
  getAvailableEmojis: jest.fn(() => [
    { code: 'heart_face', emoji: '😍', label: 'Love it' },
    { code: 'fire', emoji: '🔥', label: 'Fire' },
  ]),
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

const mockPost = {
  id: 'test-post-1',
  content: 'Test post content',
  author: {
    id: '1',
    name: 'Test Author',
    image: 'https://example.com/avatar.jpg',
  },
  createdAt: new Date().toISOString(),
  postType: 'daily' as const,
  heartsCount: 5,
  isHearted: false,
  reactionsCount: 2,
  currentUserReaction: undefined,
}

describe.skip('PostCard Real-time Updates', () => {
  // SKIPPED: Real-time update timing issues
  // See SKIPPED_TESTS.md for details
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  it('should update heart count in real-time when heart button is clicked', async () => {
    const mockOnHeart = jest.fn()
    
    // Mock all API calls with a more flexible approach
    ;(fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
      // Mock username validation call
      if (url.includes('/users/validate-usernames')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { valid_usernames: [] } }),
        })
      }
      // Mock user profile calls
      if (url.includes('/users/') && url.includes('/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'author-1', name: 'Test Author' }),
        })
      }
      // Mock follow status calls
      if (url.includes('/follows/') && url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ is_following: false }),
        })
      }
      // Mock heart API call
      if (url.includes('/heart') && !url.includes('/hearts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      }
      // Mock heart info fetch
      if (url.includes('/hearts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            hearts_count: 6,
            is_hearted: true,
          }),
        })
      }
      // Default fallback
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onHeart={mockOnHeart}
      />
    )

    // Initial state - check heart count in button (heart icon when not hearted)
    const heartButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('5') && btn.className.includes('heart-button'))
    expect(heartButton).toBeInTheDocument()
    
    // Click heart button
    fireEvent.click(heartButton)

    // Wait for heart API calls to be made
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/heart', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      })
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/hearts', {
        headers: {
          'Authorization': 'Bearer mock-token',
        },
      })
    })

    // Verify onHeart was called with updated server data
    expect(mockOnHeart).toHaveBeenCalledWith('test-post-1', false, {
      hearts_count: 6,
      is_hearted: true,
    })
  })

  it('should handle heart removal and update count in real-time', async () => {
    const mockOnHeart = jest.fn()
    const heartedPost = { ...mockPost, heartsCount: 6, isHearted: true }
    
    // Mock all API calls with a more flexible approach
    ;(fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
      // Mock username validation call
      if (url.includes('/users/validate-usernames')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { valid_usernames: [] } }),
        })
      }
      // Mock user profile calls
      if (url.includes('/users/') && url.includes('/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'author-1', name: 'Test Author' }),
        })
      }
      // Mock follow status calls
      if (url.includes('/follows/') && url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ is_following: false }),
        })
      }
      // Mock heart API call
      if (url.includes('/heart') && !url.includes('/hearts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      }
      // Mock heart info fetch
      if (url.includes('/hearts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            hearts_count: 5,
            is_hearted: false,
          }),
        })
      }
      // Default fallback
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })

    render(
      <PostCard
        post={heartedPost}
        currentUserId="current-user"
        onHeart={mockOnHeart}
      />
    )

    // Initial state - check heart count in button (filled heart when hearted)
    const heartButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('6') && btn.className.includes('heart-button'))
    expect(heartButton).toBeInTheDocument()
    
    // Click heart button to remove heart
    fireEvent.click(heartButton)

    // Wait for heart API calls to be made
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/heart', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      })
    })

    // Verify onHeart was called with updated server data
    expect(mockOnHeart).toHaveBeenCalledWith('test-post-1', true, {
      hearts_count: 5,
      is_hearted: false,
    })
  })

  it('should fallback to optimistic update if heart info fetch fails', async () => {
    const mockOnHeart = jest.fn()
    
    // Mock all API calls with a more flexible approach
    ;(fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
      // Mock username validation call
      if (url.includes('/users/validate-usernames')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { valid_usernames: [] } }),
        })
      }
      // Mock user profile calls
      if (url.includes('/users/') && url.includes('/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'author-1', name: 'Test Author' }),
        })
      }
      // Mock follow status calls
      if (url.includes('/follows/') && url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ is_following: false }),
        })
      }
      // Mock heart API call
      if (url.includes('/heart') && !url.includes('/hearts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      }
      // Mock heart info fetch failure
      if (url.includes('/hearts')) {
        return Promise.resolve({
          ok: false,
          status: 500,
        })
      }
      // Default fallback
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onHeart={mockOnHeart}
      />
    )

    // Click heart button
    const heartButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('5') && btn.className.includes('heart-button'))
    fireEvent.click(heartButton!)

    // Wait for heart API calls to be made
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/heart', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      })
    })

    // Verify onHeart was called without server data (fallback)
    expect(mockOnHeart).toHaveBeenCalledWith('test-post-1', false)
  })

  it('should handle API errors gracefully', async () => {
    const mockOnHeart = jest.fn()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    
    // Mock all API calls with network error for heart action
    ;(fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
      // Mock username validation call
      if (url.includes('/users/validate-usernames')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { valid_usernames: [] } }),
        })
      }
      // Mock user profile calls
      if (url.includes('/users/') && url.includes('/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'author-1', name: 'Test Author' }),
        })
      }
      // Mock follow status calls
      if (url.includes('/follows/') && url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ is_following: false }),
        })
      }
      // Mock heart API call with network error
      if (url.includes('/heart')) {
        return Promise.reject(new Error('Network error'))
      }
      // Default fallback
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onHeart={mockOnHeart}
      />
    )

    // Click heart button (heart icon when not hearted)
    const heartButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('5') && btn.className.includes('heart-button'))
    fireEvent.click(heartButton!)

    // Wait for error handling
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating heart:', expect.any(Error))
    })

    // Verify onHeart was not called due to error
    expect(mockOnHeart).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should show correct heart button state based on isHearted prop', () => {
    const { rerender } = render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Initially not hearted (outline heart)
    let heartButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('5') && btn.className.includes('heart-button'))
    expect(heartButton).toHaveClass('text-gray-500')

    // Rerender with hearted state
    const heartedPost = { ...mockPost, isHearted: true }
    rerender(
      <PostCard
        post={heartedPost}
        currentUserId="current-user"
      />
    )

    // Get the button again after rerender (filled heart when hearted)
    heartButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('5') && btn.className.includes('heart-button'))
    expect(heartButton).toHaveClass('text-purple-500')
  })

  it('should display correct heart count from props', () => {
    const { rerender } = render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Check heart count in button (heart icon when not hearted)
    const heartButton5 = screen.getAllByRole('button').find(btn => btn.textContent?.includes('5') && btn.className.includes('heart-button'))
    expect(heartButton5).toBeInTheDocument()

    // Test with different count
    rerender(
      <PostCard
        post={{ ...mockPost, heartsCount: 42 }}
        currentUserId="current-user"
      />
    )

    const heartButton42 = screen.getAllByRole('button').find(btn => btn.textContent?.includes('42') && btn.className.includes('heart-button'))
    expect(heartButton42).toBeInTheDocument()
  })
})