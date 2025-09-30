import React from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { useStateSynchronization, usePostStateSynchronization, useFollowButtonSynchronization } from '@/hooks/useStateSynchronization'
import { stateSyncUtils } from '@/utils/stateSynchronization'

// Mock components for testing
const TestComponent: React.FC<{
  onUserProfileUpdate?: (userId: string, updates: any) => void
  onFollowStateChange?: (userId: string, isFollowing: boolean) => void
  onPostUpdate?: (postId: string, updates: any) => void
  onNotificationCountChange?: (count: number) => void
}> = ({ onUserProfileUpdate, onFollowStateChange, onPostUpdate, onNotificationCountChange }) => {
  useStateSynchronization({
    handlers: {
      onUserProfileUpdate,
      onFollowStateChange,
      onPostUpdate,
      onNotificationCountChange
    }
  })

  return <div data-testid="test-component">Test Component</div>
}

const PostTestComponent: React.FC<{
  post: any
  onPostUpdate: (updatedPost: any) => void
}> = ({ post, onPostUpdate }) => {
  usePostStateSynchronization(post, onPostUpdate)
  return <div data-testid="post-component">Post Component</div>
}

const FollowButtonTestComponent: React.FC<{
  userId: string
  onFollowStateChange: (isFollowing: boolean) => void
}> = ({ userId, onFollowStateChange }) => {
  useFollowButtonSynchronization(userId, onFollowStateChange)
  return <div data-testid="follow-button-component">Follow Button Component</div>
}

describe('useStateSynchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any remaining listeners
    jest.clearAllTimers()
  })

  describe('useStateSynchronization hook', () => {
    it('should handle user profile updates', async () => {
      const onUserProfileUpdate = jest.fn()
      
      render(
        <TestComponent onUserProfileUpdate={onUserProfileUpdate} />
      )

      // Emit a user profile update event
      act(() => {
        stateSyncUtils.updateUserProfile('user123', {
          display_name: 'Updated Name',
          image: 'new-image.jpg'
        })
      })

      await waitFor(() => {
        expect(onUserProfileUpdate).toHaveBeenCalledWith('user123', {
          display_name: 'Updated Name',
          image: 'new-image.jpg'
        })
      })
    })

    it('should handle follow state changes', async () => {
      const onFollowStateChange = jest.fn()
      
      render(
        <TestComponent onFollowStateChange={onFollowStateChange} />
      )

      // Emit a follow state change event
      act(() => {
        stateSyncUtils.updateFollowState('user456', true)
      })

      await waitFor(() => {
        expect(onFollowStateChange).toHaveBeenCalledWith('user456', true)
      })
    })

    it('should handle post updates', async () => {
      const onPostUpdate = jest.fn()
      
      render(
        <TestComponent onPostUpdate={onPostUpdate} />
      )

      // Emit a post update event
      act(() => {
        stateSyncUtils.updatePost('post789', {
          content: 'Updated content',
          heartsCount: 5
        })
      })

      await waitFor(() => {
        expect(onPostUpdate).toHaveBeenCalledWith('post789', {
          content: 'Updated content',
          heartsCount: 5
        })
      })
    })

    it('should handle notification count changes', async () => {
      const onNotificationCountChange = jest.fn()
      
      render(
        <TestComponent onNotificationCountChange={onNotificationCountChange} />
      )

      // Emit a notification count change event
      act(() => {
        stateSyncUtils.updateNotificationCount(3)
      })

      await waitFor(() => {
        expect(onNotificationCountChange).toHaveBeenCalledWith(3)
      })
    })
  })

  describe('usePostStateSynchronization hook', () => {
    it('should update post when author profile changes', async () => {
      const mockPost = {
        id: 'post123',
        content: 'Test post',
        author: {
          id: 'user123',
          name: 'Original Name',
          display_name: 'Original Name',
          username: 'original_user',
          image: 'original-image.jpg'
        }
      }

      const onPostUpdate = jest.fn()
      
      render(
        <PostTestComponent post={mockPost} onPostUpdate={onPostUpdate} />
      )

      // Emit a user profile update for the post author
      act(() => {
        stateSyncUtils.updateUserProfile('user123', {
          display_name: 'Updated Author Name',
          image: 'updated-image.jpg'
        })
      })

      await waitFor(() => {
        expect(onPostUpdate).toHaveBeenCalledWith({
          ...mockPost,
          author: {
            ...mockPost.author,
            name: 'Updated Author Name',
            display_name: 'Updated Author Name',
            image: 'updated-image.jpg'
          }
        })
      })
    })

    it('should not update post when different user profile changes', async () => {
      const mockPost = {
        id: 'post123',
        content: 'Test post',
        author: {
          id: 'user123',
          name: 'Original Name',
          display_name: 'Original Name',
          username: 'original_user',
          image: 'original-image.jpg'
        }
      }

      const onPostUpdate = jest.fn()
      
      render(
        <PostTestComponent post={mockPost} onPostUpdate={onPostUpdate} />
      )

      // Emit a user profile update for a different user
      act(() => {
        stateSyncUtils.updateUserProfile('user456', {
          display_name: 'Different User Name'
        })
      })

      // Should not be called since it's a different user
      await waitFor(() => {
        expect(onPostUpdate).not.toHaveBeenCalled()
      })
    })
  })

  describe('useFollowButtonSynchronization hook', () => {
    it('should update follow state for correct user', async () => {
      const onFollowStateChange = jest.fn()
      
      render(
        <FollowButtonTestComponent 
          userId="user123" 
          onFollowStateChange={onFollowStateChange} 
        />
      )

      // Emit a follow state change for the correct user
      act(() => {
        stateSyncUtils.updateFollowState('user123', true)
      })

      await waitFor(() => {
        expect(onFollowStateChange).toHaveBeenCalledWith(true)
      })
    })

    it('should not update follow state for different user', async () => {
      const onFollowStateChange = jest.fn()
      
      render(
        <FollowButtonTestComponent 
          userId="user123" 
          onFollowStateChange={onFollowStateChange} 
        />
      )

      // Emit a follow state change for a different user
      act(() => {
        stateSyncUtils.updateFollowState('user456', true)
      })

      // Should not be called since it's a different user
      await waitFor(() => {
        expect(onFollowStateChange).not.toHaveBeenCalled()
      })
    })
  })

  describe('multiple components synchronization', () => {
    it('should synchronize state across multiple components', async () => {
      const onUserProfileUpdate1 = jest.fn()
      const onUserProfileUpdate2 = jest.fn()
      const onFollowStateChange1 = jest.fn()
      const onFollowStateChange2 = jest.fn()
      
      render(
        <div>
          <TestComponent 
            onUserProfileUpdate={onUserProfileUpdate1}
            onFollowStateChange={onFollowStateChange1}
          />
          <TestComponent 
            onUserProfileUpdate={onUserProfileUpdate2}
            onFollowStateChange={onFollowStateChange2}
          />
        </div>
      )

      // Emit events that should reach both components
      act(() => {
        stateSyncUtils.updateUserProfile('user123', { display_name: 'New Name' })
        stateSyncUtils.updateFollowState('user456', false)
      })

      await waitFor(() => {
        // Both components should receive the user profile update
        expect(onUserProfileUpdate1).toHaveBeenCalledWith('user123', { display_name: 'New Name' })
        expect(onUserProfileUpdate2).toHaveBeenCalledWith('user123', { display_name: 'New Name' })
        
        // Both components should receive the follow state change
        expect(onFollowStateChange1).toHaveBeenCalledWith('user456', false)
        expect(onFollowStateChange2).toHaveBeenCalledWith('user456', false)
      })
    })
  })
})