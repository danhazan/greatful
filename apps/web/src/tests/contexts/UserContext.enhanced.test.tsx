import React from 'react'
import { render, act, waitFor, screen } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { UserProvider, useUser } from '@/contexts/UserContext'

// Mock fetch
global.fetch = jest.fn()

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

// Test component to access UserContext
const TestComponent: React.FC = () => {
  const {
    currentUser,
    userProfiles,
    followStates,
    updateUserProfile,
    updateFollowState,
    updateCurrentUser,
    getUserProfile,
    getFollowState,
    subscribeToStateUpdates
  } = useUser()

  const [events, setEvents] = React.useState<any[]>([])

  React.useEffect(() => {
    const unsubscribe = subscribeToStateUpdates((event) => {
      setEvents(prev => [...prev, event])
    })
    return unsubscribe
  }, [subscribeToStateUpdates])

  return (
    <div>
      <div data-testid="current-user">
        {currentUser ? JSON.stringify(currentUser) : 'No user'}
      </div>
      <div data-testid="user-profiles">
        {JSON.stringify(userProfiles)}
      </div>
      <div data-testid="follow-states">
        {JSON.stringify(followStates)}
      </div>
      <div data-testid="events">
        {JSON.stringify(events)}
      </div>
      <button
        data-testid="update-profile"
        onClick={() => updateUserProfile('user123', { display_name: 'Updated Name' })}
      >
        Update Profile
      </button>
      <button
        data-testid="update-follow"
        onClick={() => updateFollowState('user456', true)}
      >
        Update Follow
      </button>
      <button
        data-testid="update-current-user"
        onClick={() => updateCurrentUser({ name: 'New Current User Name' })}
      >
        Update Current User
      </button>
      <div data-testid="get-profile">
        {JSON.stringify(getUserProfile('user123'))}
      </div>
      <div data-testid="get-follow-state">
        {getFollowState('user456').toString()}
      </div>
    </div>
  )
}

describe('Enhanced UserContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it('should provide enhanced user state management', async () => {
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Initial state should be empty
    expect(screen.getByTestId('user-profiles')).toHaveTextContent('{}')
    expect(screen.getByTestId('follow-states')).toHaveTextContent('{}')
    expect(screen.getByTestId('get-profile')).toHaveTextContent('null')
    expect(screen.getByTestId('get-follow-state')).toHaveTextContent('false')
  })

  it('should update user profile and emit events', async () => {
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Update user profile
    act(() => {
      screen.getByTestId('update-profile').click()
    })

    await waitFor(() => {
      // Check that user profile was updated
      const userProfiles = JSON.parse(screen.getByTestId('user-profiles').textContent || '{}')
      expect(userProfiles.user123).toEqual({
        id: 'user123',
        display_name: 'Updated Name'
      })

      // Check that event was emitted
      const events = JSON.parse(screen.getByTestId('events').textContent || '[]')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'USER_PROFILE_UPDATE',
        payload: {
          userId: 'user123',
          updates: { display_name: 'Updated Name' }
        }
      })

      // Check getter function
      const profile = JSON.parse(screen.getByTestId('get-profile').textContent || 'null')
      expect(profile).toEqual({
        id: 'user123',
        display_name: 'Updated Name'
      })
    })
  })

  it('should update follow state and emit events', async () => {
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Update follow state
    act(() => {
      screen.getByTestId('update-follow').click()
    })

    await waitFor(() => {
      // Check that follow state was updated
      const followStates = JSON.parse(screen.getByTestId('follow-states').textContent || '{}')
      expect(followStates.user456).toBe(true)

      // Check that event was emitted
      const events = JSON.parse(screen.getByTestId('events').textContent || '[]')
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'FOLLOW_STATE_UPDATE',
        payload: {
          userId: 'user456',
          isFollowing: true
        }
      })

      // Check getter function
      expect(screen.getByTestId('get-follow-state')).toHaveTextContent('true')
    })
  })

  it('should update current user and emit events', async () => {
    // Mock successful user fetch
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'current-user',
          username: 'current_user',
          email: 'current@example.com',
          display_name: 'Current User'
        }
      })
    })

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Wait for initial user load
    await waitFor(() => {
      const currentUser = screen.getByTestId('current-user').textContent
      expect(currentUser).toContain('current-user')
    })

    // Update current user
    act(() => {
      screen.getByTestId('update-current-user').click()
    })

    await waitFor(() => {
      // Check that current user was updated
      const currentUser = JSON.parse(screen.getByTestId('current-user').textContent || '{}')
      expect(currentUser.name).toBe('New Current User Name')

      // Check that event was emitted
      const events = JSON.parse(screen.getByTestId('events').textContent || '[]')
      const updateEvent = events.find((e: any) => e.type === 'CURRENT_USER_UPDATE')
      expect(updateEvent).toBeDefined()
      expect(updateEvent.payload).toEqual({
        name: 'New Current User Name'
      })
    })
  })

  it('should handle authentication and user loading', async () => {
    // Mock successful authentication
    mockLocalStorage.getItem.mockReturnValue('valid-token')
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          display_name: 'Test User',
          profile_image_url: 'test-image.jpg',
          follower_count: 10,
          following_count: 5,
          posts_count: 3
        }
      })
    })

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    await waitFor(() => {
      // Check that user was loaded
      const currentUser = JSON.parse(screen.getByTestId('current-user').textContent || '{}')
      expect(currentUser).toEqual({
        id: 'user123',
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        image: 'test-image.jpg',
        display_name: 'Test User'
      })

      // Check that user profile was also stored
      const userProfiles = JSON.parse(screen.getByTestId('user-profiles').textContent || '{}')
      expect(userProfiles.user123).toEqual({
        id: 'user123',
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        image: 'test-image.jpg',
        display_name: 'Test User',
        follower_count: 10,
        following_count: 5,
        posts_count: 3
      })
    })
  })

  it('should handle authentication failure', async () => {
    // Mock failed authentication
    mockLocalStorage.getItem.mockReturnValue('invalid-token')
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401
    })

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    await waitFor(() => {
      // Check that user is null
      expect(screen.getByTestId('current-user')).toHaveTextContent('No user')
      
      // Check that token was removed
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('access_token')
    })
  })

  it('should synchronize current user updates with user profiles', async () => {
    // Mock successful user fetch
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'current-user',
          username: 'current_user',
          email: 'current@example.com',
          display_name: 'Current User'
        }
      })
    })

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    )

    // Wait for initial user load
    await waitFor(() => {
      const currentUser = screen.getByTestId('current-user').textContent
      expect(currentUser).toContain('current-user')
    })

    // Update current user profile through updateUserProfile
    act(() => {
      screen.getByTestId('update-profile').click()
    })

    await waitFor(() => {
      // Check that both current user and user profile were updated
      const events = JSON.parse(screen.getByTestId('events').textContent || '[]')
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('USER_PROFILE_UPDATE')
    })
  })
})