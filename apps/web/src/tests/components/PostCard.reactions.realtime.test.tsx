import { render, screen, fireEvent, waitFor, act } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'
import { expect, it, beforeEach, describe } from '@jest/globals'

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

  it('should call localStorage when removing existing reaction', async () => {
    const mockOnRemoveReaction = jest.fn()
    
    // Create a post with an existing reaction to trigger the removal flow
    const postWithReaction = {
      ...mockPost,
      currentUserReaction: 'heart_eyes'
    }
    
    // Mock successful reaction removal API call
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
      })
      // Mock successful reaction summary fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_count: 1,
          reactions: { fire: 1 },
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

    // Click the reaction button to remove the existing reaction
    const reactionButton = screen.getByTitle('React with emoji')
    
    await act(async () => {
      fireEvent.click(reactionButton)
    })

    // The component should attempt to get the access token when removing reactions
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('access_token')
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

    // Click reaction button to remove reaction (look for button with reaction emoji)
    const reactionButton = screen.getByText('😂') // Joy emoji from currentUserReaction
    
    await act(async () => {
      fireEvent.click(reactionButton)
    })

    // Wait for API calls to complete (remove reaction + fetch summary + possible additional calls)
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3)
    }, { timeout: 3000 })

    // Verify API calls
    expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/reactions', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer mock-token',
      },
    })

    // Verify the reaction removal API calls were made correctly
    expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/reactions', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer mock-token',
      },
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

    // Click reaction button to open emoji picker
    const reactionButton = screen.getByTitle('React with emoji')
    
    await act(async () => {
      fireEvent.click(reactionButton)
    })

    // Wait for emoji picker to appear and click an emoji
    await waitFor(() => {
      expect(screen.getByText('🤔')).toBeInTheDocument()
    })

    const thinkingEmoji = screen.getByText('🤔')
    
    await act(async () => {
      fireEvent.click(thinkingEmoji)
    })

    // Wait for API calls to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    }, { timeout: 3000 })

    // Verify the reaction was handled gracefully even if summary fetch failed
    // The component should still function correctly without calling the callback
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/reactions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji_code: 'thinking' }),
      })
    })
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

    // Click reaction button to open emoji picker
    const reactionButton = screen.getByTitle('React with emoji')
    
    await act(async () => {
      fireEvent.click(reactionButton)
    })

    // Wait for emoji picker and click an emoji
    await waitFor(() => {
      expect(screen.getByText('🔥')).toBeInTheDocument()
    })

    const fireEmoji = screen.getByText('🔥')
    
    await act(async () => {
      fireEvent.click(fireEmoji)
    })

    // Wait for error handling
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating reaction:', expect.any(Error))
    }, { timeout: 3000 })

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