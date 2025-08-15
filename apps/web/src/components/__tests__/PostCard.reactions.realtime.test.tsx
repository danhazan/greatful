import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import PostCard from '../PostCard'

// Mock the analytics service
jest.mock('@/services/analytics', () => ({
  trackReactionEvent: jest.fn(),
  trackViewEvent: jest.fn(),
}))

// Mock the emoji mapping utility
jest.mock('@/utils/emojiMapping', () => ({
  getEmojiFromCode: jest.fn((code) => {
    const mapping: {[key: string]: string} = {
      'heart_eyes': '😍',
      'joy': '😂',
      'thinking': '🤔',
      'fire': '🔥',
      'pray': '🙏'
    }
    return mapping[code] || '😊'
  }),
  getAvailableEmojis: jest.fn(() => [
    { code: 'heart_face', emoji: '😍', label: 'Love it' },
    { code: 'fire', emoji: '🔥', label: 'Fire' },
    { code: 'pray', emoji: '🙏', label: 'Grateful' },
    { code: 'muscle', emoji: '💪', label: 'Strong' },
    { code: 'clap', emoji: '👏', label: 'Applause' },
    { code: 'joy', emoji: '😂', label: 'Funny' },
    { code: 'thinking', emoji: '🤔', label: 'Thinking' },
    { code: 'star', emoji: '⭐', label: 'Amazing' }
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

describe('PostCard Reactions Real-time Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  it('should update reaction count in real-time when emoji is selected', async () => {
    const mockOnReaction = jest.fn()
    
    // Mock successful reaction API call
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'reaction-1', emoji_code: 'joy' }),
      })
      // Mock successful reaction summary fetch with updated count
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_count: 3,
          reactions: { joy: 1, fire: 2 },
          user_reaction: 'joy'
        }),
      })

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
      />
    )

    // Click reaction button to open emoji picker
    const reactionButton = screen.getByRole('button', { name: '2' })
    fireEvent.click(reactionButton)

    // Wait for emoji picker to appear and select an emoji
    // Note: This is a simplified test - in reality we'd need to mock the EmojiPicker component
    // For now, we'll simulate the emoji selection directly
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Verify API calls
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/posts/test-post-1/reactions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emojiCode: 'joy' })
    })

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/posts/test-post-1/reactions/summary', {
      headers: {
        'Authorization': 'Bearer mock-token',
      },
    })

    // Verify onReaction was called with updated server data
    expect(mockOnReaction).toHaveBeenCalledWith('test-post-1', 'joy', {
      total_count: 3,
      reactions: { joy: 1, fire: 2 },
      user_reaction: 'joy'
    })
  })

  it('should handle reaction removal and update count in real-time', async () => {
    const mockOnRemoveReaction = jest.fn()
    const postWithReaction = { 
      ...mockPost, 
      reactionsCount: 3, 
      currentUserReaction: 'joy' 
    }
    
    // Mock successful reaction removal API call
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
      })
      // Mock successful reaction summary fetch with updated count
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_count: 2,
          reactions: { fire: 2 },
          user_reaction: null
        }),
      })

    render(
      <PostCard
        post={postWithReaction}
        currentUserId="current-user"
        onRemoveReaction={mockOnRemoveReaction}
      />
    )

    // Click reaction button to remove reaction
    const reactionButton = screen.getByRole('button', { name: '3' })
    fireEvent.click(reactionButton)

    // Wait for API calls to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Verify API calls
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/posts/test-post-1/reactions', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer mock-token',
      },
    })

    // Verify onRemoveReaction was called with updated server data
    expect(mockOnRemoveReaction).toHaveBeenCalledWith('test-post-1', {
      total_count: 2,
      reactions: { fire: 2 },
      user_reaction: null
    })
  })

  it('should fallback to optimistic update if reaction summary fetch fails', async () => {
    const mockOnReaction = jest.fn()
    
    // Mock successful reaction API call but failed summary fetch
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'reaction-1', emoji_code: 'thinking' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
      />
    )

    // Simulate emoji selection (simplified)
    const reactionButton = screen.getByRole('button', { name: '2' })
    fireEvent.click(reactionButton)

    // Wait for API calls to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Verify onReaction was called without server data (fallback)
    expect(mockOnReaction).toHaveBeenCalledWith('test-post-1', 'thinking')
  })

  it('should handle API errors gracefully', async () => {
    const mockOnReaction = jest.fn()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    
    // Mock failed reaction API call
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
        onReaction={mockOnReaction}
      />
    )

    // Simulate emoji selection (simplified)
    const reactionButton = screen.getByRole('button', { name: '2' })
    fireEvent.click(reactionButton)

    // Wait for error handling
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating reaction:', expect.any(Error))
    })

    // Verify onReaction was not called due to error
    expect(mockOnReaction).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should display correct reaction count from props', () => {
    const { rerender } = render(
      <PostCard
        post={mockPost}
        currentUserId="current-user"
      />
    )

    // Check reaction count in button
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()

    // Test with different count
    rerender(
      <PostCard
        post={{ ...mockPost, reactionsCount: 15 }}
        currentUserId="current-user"
      />
    )

    expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument()
  })

  it('should show current user reaction emoji when user has reacted', () => {
    const postWithUserReaction = {
      ...mockPost,
      currentUserReaction: 'joy',
      reactionsCount: 3
    }

    render(
      <PostCard
        post={postWithUserReaction}
        currentUserId="current-user"
      />
    )

    // Should show the joy emoji (😂) instead of the plus icon
    expect(screen.getByText('😂')).toBeInTheDocument()
  })
})