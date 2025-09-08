import React from 'react'
import { render, screen, waitFor } from '@/tests/utils/testUtils'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import PostCard from '@/components/PostCard'

// Mock the validateUsernames function
jest.mock('@/utils/mentionUtils', () => ({
  ...jest.requireActual('@/utils/mentionUtils'),
}))

// Mock auth utilities
const mockIsAuthenticated = jest.fn(() => true)
const mockCanInteract = jest.fn(() => true)
const mockGetAccessToken = jest.fn(() => 'mock-token')

jest.mock('@/utils/auth', () => ({
  isAuthenticated: mockIsAuthenticated,
  canInteract: mockCanInteract,
  getAccessToken: mockGetAccessToken
}))

// Mock analytics service
jest.mock('@/services/analytics', () => ({
  default: {
    trackViewEvent: jest.fn(),
    trackHeartEvent: jest.fn(),
    trackReactionEvent: jest.fn(),
    trackShareEvent: jest.fn()
  }
}))

// Mock image utils
jest.mock('@/utils/imageUtils', () => ({
  getImageUrl: (url: string) => url
}))

// Mock fetch for username validation
global.fetch = jest.fn()

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('PostCard Mention Validation', () => {
  const mockPost = {
    id: '1',
    content: '@Bob7 @juan',
    author: {
      id: '1',
      name: 'Test User',
      image: 'test-image.jpg'
    },
    createdAt: '2024-01-01T00:00:00Z',
    postType: 'daily' as const,
    heartsCount: 0,
    isHearted: false,
    reactionsCount: 0
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset auth mocks to default values
    mockIsAuthenticated.mockReturnValue(true)
    mockGetAccessToken.mockReturnValue('mock-token')
    
    // Set up localStorage to return a token by default
    localStorageMock.getItem.mockReturnValue('mock-token')
  })

  it('should only highlight usernames that exist in database', async () => {
    // Mock batch validation endpoint
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation((url, options) => {
      if (typeof url === 'string' && url.includes('/api/users/validate-batch')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              valid_usernames: ['Bob7'], // Bob7 exists, juan doesn't
              invalid_usernames: ['juan']
            }
          })
        } as Response)
      }
      
      // Default mock for other requests
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      } as Response)
    })

    render(
      <PostCard 
        post={mockPost} 
        currentUserId="2"
      />
    )

    // Wait for the batch validation to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/validate-batch',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Bob7')
        })
      )
    }, { timeout: 3000 })

    // Check that both mentions are rendered
    expect(screen.getByText(/@Bob7/)).toBeInTheDocument()
    expect(screen.getByText(/@juan/)).toBeInTheDocument()

    // Wait a bit more for the validation to complete and re-render
    await waitFor(() => {
      // Bob7 should have mention styling (purple)
      const bob7Element = screen.getByText('@Bob7')
      expect(bob7Element).toHaveClass('mention', 'text-purple-600')
      
      // juan should NOT have mention styling
      const juanElement = screen.getByText('@juan')
      expect(juanElement).not.toHaveClass('mention')
      expect(juanElement).not.toHaveClass('text-purple-600')
    }, { timeout: 3000 })
  })

  it('should not highlight any usernames when user is not authenticated', async () => {
    // Mock localStorage to return null (no token)
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <PostCard 
        post={mockPost} 
        // No currentUserId provided (unauthenticated)
      />
    )

    // Wait a bit to ensure no validation is triggered
    await new Promise(resolve => setTimeout(resolve, 100))

    // fetch should not be called for unauthenticated users
    expect(global.fetch).not.toHaveBeenCalled()

    // Both mentions should be rendered as plain text without highlighting
    // Verify the content contains the mentions as plain text
    expect(screen.getByText(/@Bob7/)).toBeInTheDocument()
    expect(screen.getByText(/@juan/)).toBeInTheDocument()
    
    // Verify no mention elements with the mention class exist
    const mentionElements = document.querySelectorAll('.mention')
    expect(mentionElements).toHaveLength(0)
  })
})