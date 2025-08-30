import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'

// Mock fetch
global.fetch = jest.fn()

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

// Mock analytics
jest.mock('@/services/analytics', () => ({
  trackHeartEvent: jest.fn(),
  trackReactionEvent: jest.fn(),
  trackShareEvent: jest.fn(),
  trackViewEvent: jest.fn(),
}))

const mockPost = {
  id: 'test-post-1',
  content: 'Test post content',
  author: {
    id: '1',
    name: 'testuser',
    image: undefined,
  },
  createdAt: '2024-01-15T12:00:00Z',
  postType: 'text' as const,
  heartsCount: 3,
  isHearted: false,
  reactionsCount: 0,
  currentUserReaction: undefined,
}

describe('PostCard Hearts Counter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('fake-token')
  })

  it('should open hearts viewer when hearts counter is clicked', async () => {
    // Mock follow status fetch (called by FollowButton)
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { is_following: false } })
    })
    
    // Mock successful hearts fetch
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'heart-1',
          userId: '1',
          userName: 'user1',
          userImage: null,
          createdAt: '2024-01-15T12:00:00Z',
        },
        {
          id: 'heart-2',
          userId: '2',
          userName: 'user2',
          userImage: null,
          createdAt: '2024-01-15T11:30:00Z',
        },
      ],
    })

    render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

    // Find and click the hearts counter
    const heartsCounter = screen.getByText('3')
    fireEvent.click(heartsCounter)

    // Wait for the API call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/hearts/users', {
        headers: {
          Authorization: 'Bearer fake-token',
        },
      })
    })

    // Check that hearts viewer opens
    await waitFor(() => {
      expect(screen.getByText(/Hearts \(/)).toBeInTheDocument()
      expect(screen.getByText('user1')).toBeInTheDocument()
      expect(screen.getByText('user2')).toBeInTheDocument()
    })
  })

  it('should handle hearts fetch error gracefully', async () => {
    // Mock failed hearts fetch
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

    // Find and click the hearts counter
    const heartsCounter = screen.getByText('3')
    fireEvent.click(heartsCounter)

    // Wait for the error to be logged
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch hearts:', expect.any(Error))
    })

    // Hearts viewer should not open
    expect(screen.queryByText('Hearts')).not.toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('should show hearts counter with 0 when count is 0', () => {
    const postWithNoHearts = { ...mockPost, heartsCount: 0 }
    render(<PostCard post={postWithNoHearts} onUserClick={jest.fn()} />)

    // Hearts counter should show 0 - find all buttons with "0" and check the first one (hearts)
    const zeroButtons = screen.getAllByText('0')
    expect(zeroButtons).toHaveLength(2) // hearts and reactions
    expect(zeroButtons[0]).toBeInTheDocument() // hearts counter
  })
})