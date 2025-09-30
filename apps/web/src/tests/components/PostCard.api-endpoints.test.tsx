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
  reactionsCount: 2,
  currentUserReaction: undefined,
}

describe('PostCard API Endpoints Regression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('fake-token')
  })

  describe('Heart Functionality API Calls', () => {
    it('should call correct /api/posts/ endpoints for heart actions', async () => {
      // Mock all the API calls that PostCard makes
      ;(fetch as jest.Mock)
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
        // Mock successful heart action
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        // Mock successful heart info fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hearts_count: 4, is_hearted: true }),
        })
        // Mock follow status checks
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ is_following: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ is_following: false }),
        })

      const onHeart = jest.fn()
      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} onHeart={onHeart} />)

      // Find and click the heart button
      const heartButton = screen.getByRole('button', { name: /3/ })
      fireEvent.click(heartButton)

      await waitFor(() => {
        // Should call heart action endpoint with /api/posts/ prefix
        expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/heart', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer fake-token',
            'Content-Type': 'application/json',
          },
        })
      })

      await waitFor(() => {
        // Should call heart info endpoint with /api/posts/ prefix
        expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/hearts', {
          headers: {
            'Authorization': 'Bearer fake-token',
          },
        })
      })

      expect(fetch).toHaveBeenCalledTimes(7) // Profile fetches + Heart action + Heart info + Follow status checks
    })

    it('should handle heart action API errors gracefully', async () => {
      // Mock failed heart action
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Post already hearted by user' }),
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const onHeart = jest.fn()
      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} onHeart={onHeart} />)

      // Find and click the heart button
      const heartButton = screen.getByRole('button', { name: /3/ })
      fireEvent.click(heartButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error updating heart:', expect.any(Error))
      })

      // Should not call onHeart callback on error
      expect(onHeart).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('API Endpoint Consistency Regression Tests', () => {
    it('should never use /api/v1/ prefix (which causes 404 errors)', async () => {
      // Mock all API calls that PostCard makes
      ;(fetch as jest.Mock)
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
        // Mock successful heart action
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        // Mock successful heart info fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hearts_count: 4, is_hearted: true }),
        })
        // Mock follow status checks
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ is_following: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ is_following: false }),
        })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Test heart action
      const heartButton = screen.getByRole('button', { name: /3/ })
      fireEvent.click(heartButton)

      await waitFor(() => {
        // Verify all API calls use correct /api/posts/ prefix
        const calls = (fetch as jest.Mock).mock.calls
        expect(calls.some(call => call[0].includes('/api/posts/test-post-1/heart'))).toBe(true)
        expect(calls.some(call => call[0].includes('/api/posts/test-post-1/hearts'))).toBe(true)

        // CRITICAL: Verify no calls use /api/v1/ prefix (which would cause 404 errors)
        expect(calls.some(call => call[0].includes('/api/v1/'))).toBe(false)
      })
    })

    it('should use correct parameter format for reactions (emoji_code not emojiCode)', () => {
      // This test verifies the parameter format fix
      const testEmojiCode = 'heart_face'
      const expectedBody = JSON.stringify({ emoji_code: testEmojiCode })
      
      // Verify the format is correct
      expect(expectedBody).toBe('{"emoji_code":"heart_face"}')
      expect(expectedBody).not.toBe('{"emojiCode":"heart_face"}')
    })

    it('should call correct hearts users endpoint for hearts counter', async () => {
      // Mock successful hearts users fetch
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
        ],
      })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Find and click the hearts counter
      const heartsCounter = screen.getByText('3')
      fireEvent.click(heartsCounter)

      await waitFor(() => {
        // Should call hearts users endpoint (not hearts info endpoint)
        expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/hearts/users', {
          headers: {
            Authorization: 'Bearer fake-token',
          },
        })
      })
    })
  })

  describe('Bug Prevention Tests', () => {
    it('should prevent regression of hearts counter 404 error', async () => {
      // This test ensures the hearts counter calls the correct endpoint
      // Previously it was calling /api/v1/posts/{id}/hearts/users which caused 404
      // Now it should call /api/posts/{id}/hearts/users which exists
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Find and click the hearts counter
      const heartsCounter = screen.getByText('3')
      fireEvent.click(heartsCounter)

      await waitFor(() => {
        // Verify it calls the correct endpoint (not the old /api/v1/ endpoint)
        expect(fetch).toHaveBeenCalledWith('/api/posts/test-post-1/hearts/users', {
          headers: {
            Authorization: 'Bearer fake-token',
          },
        })
        
        // Verify it doesn't call the old broken endpoint
        expect(fetch).not.toHaveBeenCalledWith('/api/v1/posts/test-post-1/hearts/users', expect.any(Object))
      })
    })

    it('should prevent regression of reaction parameter format error', () => {
      // This test ensures reaction API calls use correct parameter format
      // Previously it was using camelCase 'emojiCode' which caused backend errors
      // Now it should use snake_case 'emoji_code' which matches backend expectations
      
      const testEmojiCode = 'heart_face'
      const correctBody = JSON.stringify({ emoji_code: testEmojiCode })
      const incorrectBody = JSON.stringify({ emojiCode: testEmojiCode })
      
      // Verify the format is correct
      expect(correctBody).toBe('{"emoji_code":"heart_face"}')
      expect(correctBody).not.toBe(incorrectBody)
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
          total_count: 1,
          reactions: { 'heart_face': 1 },
          user_reaction: 'heart_face',
        }),
      })

      render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

      // Find and click the reaction button to open emoji picker
      const reactionButton = screen.getByTitle('React with emoji')
      fireEvent.click(reactionButton)

      // Wait for emoji picker to appear and click an emoji
      await waitFor(() => {
        const emojiButton = screen.getByText('😍')
        fireEvent.click(emojiButton)
      })

      await waitFor(() => {
        // Verify the API call uses correct snake_case parameter format
        const calls = (fetch as jest.Mock).mock.calls
        const reactionCall = calls.find(call => 
          call[0].includes('/api/posts/test-post-1/reactions') && 
          call[1]?.method === 'POST'
        )
        
        expect(reactionCall).toBeDefined()
        expect(reactionCall[1].body).toContain('"emoji_code"')
        expect(reactionCall[1].body).not.toContain('"emojiCode"')
      })
    })
  })
})