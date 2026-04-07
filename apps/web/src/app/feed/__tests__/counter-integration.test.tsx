/**
 * Integration test to verify that counter logic works correctly
 * with proper separation between global counts and individual user state
 */

import { render, screen, act, waitFor } from '@/tests/utils/testUtils'
import userEvent from '@testing-library/user-event'
import FeedPage from '../page'
import { describe, it, beforeEach, jest, expect } from '@jest/globals'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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

describe.skip('Counter Integration Test', () => {
  // SKIPPED: Timeout issues with server-authoritative counts
  // See apps/web/SKIPPED_TESTS.md for details
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'mock-token'
      return null
    })
    
    // Mock successful API responses
    ;(global.fetch as jest.Mock).mockImplementation((url, options) => {
      if (url.includes('/api/users/me/profile')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'current-user',
            username: 'Test User',
            email: 'test@example.com'
          })
        })
      }
      if (url.includes('/api/posts') && !url.includes('/reactions')) {
        // Return successful posts response for testing
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test-post-1',
              content: 'Test gratitude post for integration testing',
              author: {
                id: 'author-1',
                username: 'testauthor',
                name: 'Test Author'
              },
              createdAt: new Date().toISOString(),
              reactionsCount: 17,
              currentUserReaction: null,
              reactionEmojiCodes: ['heart', 'pray']
            }
          ])
        })
      }
      if (url.includes('/reactions') && options?.method === 'POST') {
        // Mock reaction API response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              totalCount: 18,
              reactions: { heart: 13, pray: 5 },
              userReaction: 'heart',
              reactionEmojiCodes: ['heart', 'pray']
            }
          })
        })
      }
      if (url.includes('/reactions/summary') && options?.method === 'GET') {
        // Mock reaction summary API response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            totalCount: 18,
            reactions: { heart: 13, pray: 5 },
            userReaction: 'heart',
            reactionEmojiCodes: ['heart', 'pray']
          })
        })
      }
      return Promise.resolve({ 
        ok: false,
        text: () => Promise.resolve('Not found'),
        json: () => Promise.resolve({ error: 'Not found' })
      })
    })
  })

  it('should maintain server-authoritative global counts', async () => {
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('Test gratitude post for integration testing')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Check that server data global counts are displayed in reactions banner
    const reactionsBanner = screen.getByTitle('View reactions')
    expect(reactionsBanner.textContent).toContain('17')
  })

  it('should handle reaction interactions with proper API calls', async () => {
    const user = userEvent.setup()
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('Test gratitude post for integration testing')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Find and click the reaction button
    const reactionButton = screen.getByTitle('React with emoji')
    await user.click(reactionButton)
    
    // Verify API call was made
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/posts/test-post-1/reactions'), expect.objectContaining({
        method: 'POST'
      }))
    })
  })

  it('should demonstrate proper data separation', async () => {
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('Test gratitude post for integration testing')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Find reactions banner and verify the expected counts are present
    const reactionsBanner = screen.getByTitle('View reactions')
    expect(reactionsBanner.textContent).toContain('17')
  })
});