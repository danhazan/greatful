import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { UserProvider, useUser } from '@/contexts/UserContext'

// Mock fetch
global.fetch = jest.fn()

// Test component that uses UserContext
function TestComponent() {
  const { currentUser, isLoading } = useUser()
  
  if (isLoading) {
    return <div>Loading...</div>
  }
  
  if (currentUser) {
    return (
      <div>
        <div data-testid="user-id">{currentUser.id}</div>
        <div data-testid="user-name">{currentUser.name}</div>
        <div data-testid="user-email">{currentUser.email}</div>
      </div>
    )
  }
  
  return <div>Not authenticated</div>
}

describe('UserContext Authentication Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
  })

  it('should correctly parse wrapped API response from backend', async () => {
    // Mock localStorage to return a token
    ;(window.localStorage.getItem as jest.Mock).mockReturnValue('mock-token')
    
    // Mock the API response in the format the backend actually returns
    const mockApiResponse = {
      success: true,
      data: {
        id: 123,
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        profile_image_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        created_at: '2023-01-01T00:00:00Z',
        posts_count: 5,
        followers_count: 10,
        following_count: 15
      },
      timestamp: '2023-01-01T00:00:00Z',
      request_id: 'test-request-id'
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    })

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Initially should show loading
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Wait for the user to be loaded
    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('123')
    })

    // Verify all user data is correctly parsed
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User')
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com')

    // Verify the API was called correctly
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me/profile', {
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json'
      }
    })
  })

  it('should handle authentication failure correctly', async () => {
    // Mock localStorage to return a token
    ;(window.localStorage.getItem as jest.Mock).mockReturnValue('invalid-token')
    
    // Mock API response for invalid token
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Wait for the authentication to fail
    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument()
    })

    // Verify the invalid token was removed
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('access_token')
  })

  it('should handle missing token correctly', async () => {
    // Mock localStorage to return no token
    ;(window.localStorage.getItem as jest.Mock).mockReturnValue(null)

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Should show not authenticated without making API call
    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument()
    })

    // Verify no API call was made
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should handle malformed API response correctly', async () => {
    // Mock localStorage to return a token
    ;(window.localStorage.getItem as jest.Mock).mockReturnValue('mock-token')
    
    // Mock malformed API response (missing data field)
    const malformedResponse = {
      success: true,
      // Missing 'data' field
      timestamp: '2023-01-01T00:00:00Z',
      request_id: 'test-request-id'
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => malformedResponse,
    })

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Should handle malformed response gracefully
    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument()
    })

    // Verify the token was removed due to invalid data
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('access_token')
  })
})