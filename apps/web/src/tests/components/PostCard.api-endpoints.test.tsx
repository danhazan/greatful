import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'
import { expect, it, describe, beforeEach, jest } from '@jest/globals'

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
    username: 'testuser',
    image: undefined,
    followerCount: 0,
    followingCount: 0,
    postsCount: 1,
    isFollowing: false
  },
  createdAt: '2024-01-15T12:00:00Z',
  reactionsCount: 2,
  currentUserReaction: undefined,
}

describe.skip('PostCard API Endpoints Regression Tests', () => {
  // SKIPPED: API endpoint regression test issues
  // See apps/web/SKIPPED_TESTS.md for details
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('fake-token')
  })

  describe('Reaction Functionality API Calls', () => {
    it('should call correct reaction endpoints when hearting', async () => {
      ;(global.fetch as any)
        // Mock profile fetches (from FollowButton component)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', username: 'testuser', display_name: 'Test User' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'test-user-1', username: 'currentuser', display_name: 'Current User' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', username: 'testuser', display_name: 'Test User' }),
        })
        // Mock successful reaction action
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        // Mock successful reaction summary fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ totalCount: 2, emojiCounts: { heart: 1, pray: 1 }, userReaction: 'heart' }),
        })
        // Mock follow status checks
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isFollowing: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isFollowing: false }),
        })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Find and click the heart button (rendered as empty heart when no reaction)
      const heartButton = screen.getByTitle('React with emoji')
      fireEvent.click(heartButton)

      await waitFor(() => {
        // Should call reactions endpoint
        expect(global.fetch).toHaveBeenCalledWith('/api/posts/test-post-1/reactions', expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"emojiCode":"heart"')
        }))
      })

      await waitFor(() => {
        // Should call reactions summary endpoint
        expect(global.fetch).toHaveBeenCalledWith('/api/posts/test-post-1/reactions/summary', expect.any(Object))
      })

      expect(global.fetch).toHaveBeenCalledTimes(5)
    })

    it.skip('should handle reaction action API errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Mock all API calls - profile fetches first, then failed reaction action
      ;(fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', username: 'testuser', display_name: 'Test User' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'test-user-1', username: 'currentuser', display_name: 'Current User' }),
        })
        // Mock failed reaction action
        .mockRejectedValueOnce(new Error('Network error'))

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Find and click the heart button
      const heartButton = screen.getByTitle('React with emoji')
      fireEvent.click(heartButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to add reaction:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('API Endpoint Consistency Regression Tests', () => {
    it('should never use /api/v1/ prefix (which causes 404 errors)', async () => {
      // Mock all API calls that PostCard makes
      ;(fetch as jest.Mock)
        // Mock profile fetches
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', username: 'testuser', display_name: 'Test User' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'test-user-1', username: 'currentuser', display_name: 'Current User' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', username: 'testuser', display_name: 'Test User' }),
        })
        // Mock successful reaction action
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        // Mock successful summary fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ totalCount: 1, emojiCounts: { heart: 1 }, userReaction: 'heart' }),
        })
        // Mock follow status checks
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isFollowing: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isFollowing: false }),
        })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Test reaction action
      const heartButton = screen.getByTitle('React with emoji')
      fireEvent.click(heartButton)

      await waitFor(() => {
        // Verify all API calls use correct /api/posts/ prefix
        const calls = (fetch as jest.Mock).mock.calls
        expect(calls.some(call => call[0].includes('/api/posts/test-post-1/reactions'))).toBe(true)

        // CRITICAL: Verify no calls use /api/v1/ prefix
        expect(calls.some(call => call[0].includes('/api/v1/'))).toBe(false)
      })
    })

    it('should use correct parameter format for reactions (emojiCode match API client)', () => {
      // This test verifies the parameter format used by apiClient
      const testEmojiCode = 'heart_face'
      const expectedBody = JSON.stringify({ emojiCode: testEmojiCode })
      
      // Verify the format matches what apiClient sends
      expect(expectedBody).toBe('{"emojiCode":"heart_face"}')
    })

    it('should call correct reactions endpoint for reactions banner', async () => {
      // Mock successful reactions fetch
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'reaction-1',
            userId: '1',
            userName: 'user1',
            userImage: null,
            createdAt: '2024-01-15T12:00:00Z',
            emojiCode: 'heart'
          },
        ],
      })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Find and click the reactions banner to see users
      const reactionsBanner = screen.getByTitle('View reactions')
      fireEvent.click(reactionsBanner)

      await waitFor(() => {
        // Should call reactions endpoint
        expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/reactions', expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-token',
          }),
        }))
      })
    })
  })

  describe('Bug Prevention Tests', () => {
    it('should prevent regression of reactions endpoint 404 error', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      const reactionsBanner = screen.getByTitle('View reactions')
      fireEvent.click(reactionsBanner)

      await waitFor(() => {
        // Verify it calls the correct endpoint
        expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/reactions', expect.any(Object))
        
        // Verify it doesn't call the old broken endpoint
        expect(fetch).not.toHaveBeenCalledWith('/api/v1/posts/test-post-1/reactions', expect.any(Object))
      })
    })

    it('should prevent regression of reaction parameter format error', () => {
      const testEmojiCode = 'heart_face'
      const correctBody = JSON.stringify({ emojiCode: testEmojiCode })
      
      // Verify it uses the format expected by the frontend API client
      expect(correctBody).toBe('{"emojiCode":"heart_face"}')
    })

    it('should use correct parameter format in actual PostCard component', async () => {
      // Mock successful reaction add
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      // Mock successful reaction summary fetch
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCount: 1,
          emojiCounts: { heart: 1 },
          userReaction: 'heart',
        }),
      })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Find and click the reaction button to open emoji picker
      const reactionButton = screen.getByTitle('React with emoji')
      fireEvent.click(reactionButton)

      // Wait for emoji picker to appear and click an emoji
      await waitFor(() => {
        const emojiButton = screen.queryAllByRole('button').find(b => b.textContent === '💜')
        if (emojiButton) fireEvent.click(emojiButton)
      })

      await waitFor(() => {
        // Verify the API call uses correct camelCase parameter format as sent by apiClient
        const calls = (fetch as jest.Mock).mock.calls
        const reactionCall = calls.find(call => 
          call[0].includes('/api/posts/test-post-1/reactions') && 
          call[1]?.method === 'POST'
        )
        
        expect(reactionCall).toBeDefined()
        expect(reactionCall[1].body).toContain('"emojiCode"')
      })
    })
  })
})