import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import PostCard from '../PostCard'

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
    id: 'author-1',
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

describe('PostCard Real-time Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  it('should update heart count in real-time when heart button is clicked', async () => {
    const mockOnHeart = jest.fn()
    
    // Mock successful heart API call
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      // Mock successful heart info fetch with updated count
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hearts_count: 6,
          is_hearted: true,
        }),
      })

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onHeart={mockOnHeart}
      />
    )

    // Initial state - check heart count in button
    const heartButton = screen.getByRole('button', { name: '5' })
    expect(heartButton).toBeInTheDocument()
    
    // Click heart button
    fireEvent.click(heartButton)

    // Wait for API calls to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Verify API calls
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/posts/test-post-1/heart', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
    })

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/posts/test-post-1/hearts', {
      headers: {
        'Authorization': 'Bearer mock-token',
      },
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
    
    // Mock successful unheart API call
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      // Mock successful heart info fetch with updated count
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hearts_count: 5,
          is_hearted: false,
        }),
      })

    render(
      <PostCard
        post={heartedPost}
        currentUserId="current-user"
        onHeart={mockOnHeart}
      />
    )

    // Initial state - check heart count in button
    const heartButton = screen.getByRole('button', { name: '6' })
    expect(heartButton).toBeInTheDocument()
    
    // Click heart button to remove heart
    fireEvent.click(heartButton)

    // Wait for API calls to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Verify API calls
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/posts/test-post-1/heart', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
    })

    // Verify onHeart was called with updated server data
    expect(mockOnHeart).toHaveBeenCalledWith('test-post-1', true, {
      hearts_count: 5,
      is_hearted: false,
    })
  })

  it('should fallback to optimistic update if heart info fetch fails', async () => {
    const mockOnHeart = jest.fn()
    
    // Mock successful heart API call but failed heart info fetch
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onHeart={mockOnHeart}
      />
    )

    // Click heart button
    const heartButton = screen.getByRole('button', { name: '5' })
    fireEvent.click(heartButton)

    // Wait for API calls to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Verify onHeart was called without server data (fallback)
    expect(mockOnHeart).toHaveBeenCalledWith('test-post-1', false)
  })

  it('should handle API errors gracefully', async () => {
    const mockOnHeart = jest.fn()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    
    // Mock failed heart API call
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onHeart={mockOnHeart}
      />
    )

    // Click heart button
    const heartButton = screen.getByRole('button', { name: '5' })
    fireEvent.click(heartButton)

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

    // Initially not hearted
    let heartButton = screen.getByRole('button', { name: '5' })
    expect(heartButton).toHaveClass('text-gray-500')

    // Rerender with hearted state
    const heartedPost = { ...mockPost, isHearted: true }
    rerender(
      <PostCard
        post={heartedPost}
        currentUserId="current-user"
      />
    )

    // Get the button again after rerender
    heartButton = screen.getByRole('button', { name: '5' })
    expect(heartButton).toHaveClass('text-red-500')
  })

  it('should display correct heart count from props', () => {
    const { rerender } = render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Check heart count in button
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()

    // Test with different count
    rerender(
      <PostCard
        post={{ ...mockPost, heartsCount: 42 }}
        currentUserId="current-user"
      />
    )

    expect(screen.getByRole('button', { name: '42' })).toBeInTheDocument()
  })
})