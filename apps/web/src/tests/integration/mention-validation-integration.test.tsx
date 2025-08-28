import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import PostCard from '@/components/PostCard'

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

describe('Mention Validation Integration Test', () => {
  const mockPost = {
    id: '1',
    content: '@Bob7 @juan @nonexistent',
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
    
    // Set up localStorage to return a token by default
    localStorageMock.getItem.mockReturnValue('mock-token')
    
    // Mock fetch to simulate API responses
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url.includes('/api/users/username/Bob7')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { id: 1, username: 'Bob7' } })
          } as Response)
        }
        if (url.includes('/api/users/username/juan') || url.includes('/api/users/username/nonexistent')) {
          return Promise.resolve({
            ok: false,
            status: 404
          } as Response)
        }
      }
      return Promise.reject(new Error('Unexpected URL'))
    })
  })

  it('should demonstrate the complete mention validation flow', async () => {
    render(
      <PostCard 
        post={mockPost} 
        currentUserId="2"
      />
    )

    // Initially, all mentions should be rendered as plain text
    expect(screen.getByText('@Bob7')).toBeInTheDocument()
    expect(screen.getByText('@juan')).toBeInTheDocument()
    expect(screen.getByText('@nonexistent')).toBeInTheDocument()

    // Wait for the validation API calls to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/username/Bob7'),
        expect.any(Object)
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/username/juan'),
        expect.any(Object)
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/username/nonexistent'),
        expect.any(Object)
      )
    }, { timeout: 3000 })

    // After validation, only Bob7 should be highlighted (purple)
    await waitFor(() => {
      const bob7Element = screen.getByText('@Bob7')
      const juanElement = screen.getByText('@juan')
      const nonexistentElement = screen.getByText('@nonexistent')
      
      // Bob7 should have mention styling (exists in database)
      expect(bob7Element).toHaveClass('mention', 'text-purple-600')
      
      // juan and nonexistent should NOT have mention styling (don't exist in database)
      expect(juanElement).not.toHaveClass('mention')
      expect(juanElement).not.toHaveClass('text-purple-600')
      expect(nonexistentElement).not.toHaveClass('mention')
      expect(nonexistentElement).not.toHaveClass('text-purple-600')
    }, { timeout: 3000 })
  })
})