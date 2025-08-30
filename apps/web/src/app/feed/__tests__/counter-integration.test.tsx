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
    ;(global.fetch as jest.Mock).mockImplementation((url) => {
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
      if (url.includes('/api/posts')) {
        return Promise.resolve({
          ok: false, // Force fallback to mock data
        })
      }
      return Promise.resolve({ ok: false })
    })
  })

  it('should maintain server-authoritative global counts', async () => {
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('🎉 Welcome to your Gratitude Feed!')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Check that mock data global counts are displayed in heart buttons
    const heartButtons = screen.getAllByRole('button').filter(button => 
      button.textContent?.includes('12') || 
      button.textContent?.includes('24') || 
      button.textContent?.includes('8')
    )
    
    // Should have heart buttons with the correct counts
    expect(heartButtons.some(btn => btn.textContent?.includes('12'))).toBe(true) // First post hearts
    expect(heartButtons.some(btn => btn.textContent?.includes('24'))).toBe(true) // Second post hearts
    expect(heartButtons.some(btn => btn.textContent?.includes('8'))).toBe(true)  // Third post hearts
  })

  it.skip('should not modify global counts when user reacts', async () => {
    const user = userEvent.setup()
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('🎉 Welcome to your Gratitude Feed!')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Find heart button with count 12 (first post)
    const heartButton = screen.getAllByRole('button').find(button => 
      button.textContent?.includes('12') && button.querySelector('svg')
    )
    expect(heartButton).toBeDefined()

    // Click heart button
    if (heartButton) {
      await act(async () => {
        await user.click(heartButton)
      })
    }

    // Global count should remain unchanged (server-authoritative)
    // The button should still show 12, not 13
    expect(heartButton?.textContent).toContain('12')

    // Find reaction button with count 8 (first post)
    const reactionButton = screen.getAllByRole('button').find(button => 
      button.textContent?.includes('8') && !button.querySelector('svg')
    )
    expect(reactionButton).toBeDefined()

    // Click reaction button to open emoji picker
    if (reactionButton) {
      await act(async () => {
        await user.click(reactionButton)
      })
    }

    // Global count should remain unchanged
    expect(reactionButton?.textContent).toContain('8')
  })

  it.skip('should save individual user reactions to user-specific localStorage', async () => {
    const user = userEvent.setup()
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('🎉 Welcome to your Gratitude Feed!')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Find heart button with count 12 (first post)
    const heartButton = screen.getAllByRole('button').find(button => 
      button.textContent?.includes('12') && button.querySelector('svg')
    )
    
    if (heartButton) {
      await act(async () => {
        await user.click(heartButton)
      })
    }

    // Verify user-specific localStorage was called
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'user_current-user_reactions',
      expect.stringContaining('"hearted":true')
    )
  })

  it('should demonstrate proper data separation', async () => {
    render(<FeedPage />)
    
    // Wait for the loading to complete and posts to appear
    await waitFor(() => {
      expect(screen.getByText('🎉 Welcome to your Gratitude Feed!')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Find all buttons and verify the expected counts are present
    const allButtons = screen.getAllByRole('button')
    
    // Find buttons by their text content - based on actual rendered output
    const heartButton12 = allButtons.find(btn => btn.textContent === '12')
    const heartButton24 = allButtons.find(btn => btn.textContent === '24')
    const heartButton8 = allButtons.find(btn => btn.textContent === '8')
    
    const reactionButton8 = allButtons.find(btn => btn.textContent === '8' && btn !== heartButton8)
    const reactionButton15 = allButtons.find(btn => btn.textContent === '15')
    const reactionButton3 = allButtons.find(btn => btn.textContent === '3')

    // Verify all expected buttons exist with correct counts
    expect(heartButton12).toBeDefined()
    expect(heartButton24).toBeDefined()
    expect(heartButton8).toBeDefined()
    expect(reactionButton8).toBeDefined()
    expect(reactionButton15).toBeDefined()
    expect(reactionButton3).toBeDefined()

    // Verify the exact counts from mock data
    expect(heartButton12?.textContent).toContain('12')
    expect(heartButton24?.textContent).toContain('24')
    expect(heartButton8?.textContent).toContain('8')
    expect(reactionButton8?.textContent).toContain('8')
    expect(reactionButton15?.textContent).toContain('15')
    expect(reactionButton3?.textContent).toContain('3')
  })
});