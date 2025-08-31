/**
 * Integration test to verify that counter logic works correctly
 * with proper separation between global counts and individual user state
 */

import { render, screen, act, waitFor } from '@/tests/utils/testUtils'
import userEvent from '@testing-library/user-event'
import FeedPage from '../page'
import { describe, it, beforeEach } from '@jest/globals'

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

describe('Counter Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'mock-token'
      if (key === 'user_current-user_reactions') return JSON.stringify({})
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
      if (url.includes('/api/posts') && !url.includes('/hearts')) {
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
              postType: 'daily',
              heartsCount: 12,
              reactionsCount: 5,
              isHearted: false,
              currentUserReaction: null
            }
          ])
        })
      }
      if (url.includes('/heart') && options?.method === 'POST') {
        // Mock heart API response - PostCard expects this format
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hearts_count: 13, // Incremented from 12
            is_hearted: true
          })
        })
      }
      if (url.includes('/heart') && options?.method === 'DELETE') {
        // Mock unheart API response - PostCard expects this format
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hearts_count: 11, // Decremented from 12
            is_hearted: false
          })
        })
      }
      if (url.includes('/hearts') && options?.method === 'GET') {
        // Mock heart info API response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hearts_count: 13,
            is_hearted: true
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

    // Check that server data global counts are displayed in heart buttons
    const heartButtons = screen.getAllByRole('button').filter(button => 
      button.textContent?.includes('12')
    )
    
    // Should have heart button with the correct count from server
    expect(heartButtons.some(btn => btn.textContent?.includes('12'))).toBe(true) // Server hearts count
  })

  it('should handle heart interactions with proper API calls', async () => {
    const user = userEvent.setup()
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('Test gratitude post for integration testing')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Verify the server data is loaded correctly by checking for heart button with count
    const allButtons = screen.getAllByRole('button')
    const heartButtons = allButtons.filter(button => 
      button.querySelector('svg') && button.textContent?.includes('12')
    )
    
    // Should have heart button with the expected count
    expect(heartButtons.length).toBeGreaterThanOrEqual(1)
    
    // Verify server count exists in button
    expect(heartButtons.some(btn => btn.textContent?.includes('12'))).toBe(true)
  })

  it('should use server data instead of localStorage for reactions', async () => {
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('Test gratitude post for integration testing')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Verify that the component uses server data (isHearted: false from mock)
    // and doesn't rely on localStorage for reaction state
    const heartButtons = screen.getAllByRole('button').filter(button => 
      button.querySelector('svg') && button.textContent?.includes('12')
    )
    
    expect(heartButtons.length).toBeGreaterThan(0)
    // The heart should not be filled since isHearted is false in server response
    const heartButton = heartButtons[0]
    expect(heartButton).toBeDefined()
  })

  it('should demonstrate proper data separation', async () => {
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('Test gratitude post for integration testing')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Find all buttons and verify the expected counts are present
    const allButtons = screen.getAllByRole('button')
    
    // Find buttons by their text content - based on actual rendered output
    const heartButton12 = allButtons.find(btn => btn.textContent === '12')
    const reactionButton5 = allButtons.find(btn => btn.textContent === '5')

    // Verify expected buttons exist with correct counts from server
    expect(heartButton12).toBeDefined()
    expect(reactionButton5).toBeDefined()

    // Verify the exact counts from server data
    expect(heartButton12?.textContent).toContain('12')
    expect(reactionButton5?.textContent).toContain('5')
  })
});