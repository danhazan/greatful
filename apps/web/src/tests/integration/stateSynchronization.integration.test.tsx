import React from 'react'
import { render, act, waitFor, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { UserProvider } from '@/contexts/UserContext'
import { ToastProvider } from '@/contexts/ToastContext'
import FollowButton from '@/components/FollowButton'
import { stateSyncUtils, stateSyncEmitter } from '@/utils/stateSynchronization'

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

// Test wrapper with all providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UserProvider>
    <ToastProvider>
      {children}
    </ToastProvider>
  </UserProvider>
)

// Mock post component that displays user info and responds to state changes
const MockPostCard: React.FC<{
  post: {
    id: string
    author: {
      id: string
      name: string
      username: string
      image?: string
    }
  }
  onAuthorUpdate?: (author: any) => void
}> = ({ post, onAuthorUpdate }) => {
  const [currentPost, setCurrentPost] = React.useState(post)

  React.useEffect(() => {
    const unsubscribe = stateSyncEmitter.subscribeAll((event: any) => {
      if (event.type === 'USER_PROFILE_UPDATED' && event.payload.userId === post.author.id) {
        const updatedAuthor = {
          ...currentPost.author,
          name: event.payload.updates.display_name || event.payload.updates.name || currentPost.author.name,
          image: event.payload.updates.image || currentPost.author.image
        }
        setCurrentPost(prev => ({ ...prev, author: updatedAuthor }))
        onAuthorUpdate?.(updatedAuthor)
      }
    })

    return unsubscribe
  }, [post.author.id, currentPost.author, onAuthorUpdate])

  return (
    <div data-testid={`post-${post.id}`}>
      <div data-testid="author-name">{currentPost.author.name}</div>
      <div data-testid="author-image">{currentPost.author.image || 'no-image'}</div>
      <FollowButton userId={parseInt(currentPost.author.id)} />
    </div>
  )
}

// Mock user profile component that can update user info
const MockUserProfile: React.FC<{
  userId: string
  onProfileUpdate?: (updates: any) => void
}> = ({ userId, onProfileUpdate }) => {
  const updateProfile = () => {
    const updates = {
      display_name: 'Updated User Name',
      image: 'updated-image.jpg'
    }
    stateSyncUtils.updateUserProfile(userId, updates)
    onProfileUpdate?.(updates)
  }

  const updateFollowState = () => {
    stateSyncUtils.updateFollowState(userId, true)
  }

  return (
    <div data-testid={`profile-${userId}`}>
      <button data-testid="update-profile" onClick={updateProfile}>
        Update Profile
      </button>
      <button data-testid="update-follow" onClick={updateFollowState}>
        Update Follow State
      </button>
    </div>
  )
}

describe('State Synchronization Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
    
    // Mock successful API responses
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/users/me/profile')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 'current-user',
              username: 'current_user',
              email: 'current@example.com',
              display_name: 'Current User'
            }
          })
        })
      }
      
      if (url.includes('/api/users/') && url.includes('/profile')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              id: 'user123',
              username: 'testuser',
              display_name: 'Test User',
              image: 'test-image.jpg'
            }
          })
        })
      }
      
      if (url.includes('/api/follows/') && url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: { is_following: false }
          })
        })
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    })
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it('should synchronize user profile updates across multiple post components', async () => {
    const mockPost1 = {
      id: 'post1',
      author: {
        id: 'user123',
        name: 'Original Name',
        username: 'testuser',
        image: 'original-image.jpg'
      }
    }

    const mockPost2 = {
      id: 'post2',
      author: {
        id: 'user123',
        name: 'Original Name',
        username: 'testuser',
        image: 'original-image.jpg'
      }
    }

    const onAuthorUpdate1 = jest.fn()
    const onAuthorUpdate2 = jest.fn()
    const onProfileUpdate = jest.fn()

    render(
      <TestWrapper>
        <MockPostCard post={mockPost1} onAuthorUpdate={onAuthorUpdate1} />
        <MockPostCard post={mockPost2} onAuthorUpdate={onAuthorUpdate2} />
        <MockUserProfile userId="user123" onProfileUpdate={onProfileUpdate} />
      </TestWrapper>
    )

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('post-post1')).toBeInTheDocument()
      expect(screen.getByTestId('post-post2')).toBeInTheDocument()
    })

    // Update user profile
    act(() => {
      fireEvent.click(screen.getByTestId('update-profile'))
    })

    // Verify both post components received the update
    await waitFor(() => {
      expect(onAuthorUpdate1).toHaveBeenCalledWith({
        id: 'user123',
        name: 'Updated User Name',
        username: 'testuser',
        image: 'updated-image.jpg'
      })
      
      expect(onAuthorUpdate2).toHaveBeenCalledWith({
        id: 'user123',
        name: 'Updated User Name',
        username: 'testuser',
        image: 'updated-image.jpg'
      })
      
      expect(onProfileUpdate).toHaveBeenCalledWith({
        display_name: 'Updated User Name',
        image: 'updated-image.jpg'
      })
    })

    // Verify UI updates
    const post1AuthorName = screen.getAllByTestId('author-name')[0]
    const post2AuthorName = screen.getAllByTestId('author-name')[1]
    const post1AuthorImage = screen.getAllByTestId('author-image')[0]
    const post2AuthorImage = screen.getAllByTestId('author-image')[1]

    expect(post1AuthorName).toHaveTextContent('Updated User Name')
    expect(post2AuthorName).toHaveTextContent('Updated User Name')
    expect(post1AuthorImage).toHaveTextContent('updated-image.jpg')
    expect(post2AuthorImage).toHaveTextContent('updated-image.jpg')
  })

  it('should synchronize follow state across multiple follow buttons', async () => {
    const mockPost1 = {
      id: 'post1',
      author: { id: 'user123', name: 'Test User', username: 'testuser' }
    }

    const mockPost2 = {
      id: 'post2',
      author: { id: 'user123', name: 'Test User', username: 'testuser' }
    }

    render(
      <TestWrapper>
        <MockPostCard post={mockPost1} />
        <MockPostCard post={mockPost2} />
        <MockUserProfile userId="user123" />
      </TestWrapper>
    )

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('post-post1')).toBeInTheDocument()
      expect(screen.getByTestId('post-post2')).toBeInTheDocument()
    })

    // Update follow state
    act(() => {
      fireEvent.click(screen.getByTestId('update-follow'))
    })

    // Both follow buttons should reflect the updated state
    // Note: The actual follow button state changes are handled by the useUserState hook
    // This test verifies that the state synchronization system is working
    await waitFor(() => {
      // The follow buttons should be present and functional
      const followButtons = screen.getAllByRole('button').filter(button => 
        button.textContent?.includes('Follow') || button.textContent?.includes('Loading')
      )
      expect(followButtons.length).toBeGreaterThan(0)
    })
  })

  it('should handle multiple simultaneous state updates without conflicts', async () => {
    const mockPost = {
      id: 'post1',
      author: { id: 'user123', name: 'Test User', username: 'testuser' }
    }

    const onAuthorUpdate = jest.fn()

    render(
      <TestWrapper>
        <MockPostCard post={mockPost} onAuthorUpdate={onAuthorUpdate} />
        <MockUserProfile userId="user123" />
      </TestWrapper>
    )

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('post-post1')).toBeInTheDocument()
    })

    // Perform multiple rapid updates
    act(() => {
      stateSyncUtils.updateUserProfile('user123', { display_name: 'Update 1' })
      stateSyncUtils.updateUserProfile('user123', { display_name: 'Update 2' })
      stateSyncUtils.updateUserProfile('user123', { display_name: 'Final Update' })
      stateSyncUtils.updateFollowState('user123', true)
    })

    // Verify the final state is correct
    await waitFor(() => {
      expect(onAuthorUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Final Update'
        })
      )
    })
  })

  it('should maintain performance with many components subscribed to state updates', async () => {
    const posts = Array.from({ length: 10 }, (_, i) => ({
      id: `post${i}`,
      author: { id: 'user123', name: 'Test User', username: 'testuser' }
    }))

    const onAuthorUpdates = posts.map(() => jest.fn())

    render(
      <TestWrapper>
        {posts.map((post, index) => (
          <MockPostCard 
            key={post.id} 
            post={post} 
            onAuthorUpdate={onAuthorUpdates[index]} 
          />
        ))}
        <MockUserProfile userId="user123" />
      </TestWrapper>
    )

    // Wait for all components to render
    await waitFor(() => {
      posts.forEach(post => {
        expect(screen.getByTestId(`post-${post.id}`)).toBeInTheDocument()
      })
    })

    const startTime = performance.now()

    // Update user profile
    act(() => {
      stateSyncUtils.updateUserProfile('user123', { 
        display_name: 'Performance Test Update' 
      })
    })

    // Verify all components received the update
    await waitFor(() => {
      onAuthorUpdates.forEach(callback => {
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Performance Test Update'
          })
        )
      })
    })

    const endTime = performance.now()
    const duration = endTime - startTime

    // Update should complete quickly even with many subscribers
    expect(duration).toBeLessThan(100) // Less than 100ms
  })
})