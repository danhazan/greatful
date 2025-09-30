'use client'

import { useEffect, useCallback } from 'react'
import { useStateSyncSubscription, StateSyncEvent } from '@/utils/stateSynchronization'

interface StateSyncHandlers {
  onUserProfileUpdate?: (userId: string, updates: any) => void
  onFollowStateChange?: (userId: string, isFollowing: boolean) => void
  onPostUpdate?: (postId: string, updates: any) => void
  onNotificationCountChange?: (count: number) => void
}

interface UseStateSynchronizationOptions {
  handlers: StateSyncHandlers
  dependencies?: any[]
}

/**
 * Hook for subscribing to global state synchronization events
 * This allows components to stay in sync with state changes from other components
 */
export function useStateSynchronization({
  handlers,
  dependencies = []
}: UseStateSynchronizationOptions): void {
  const handleStateEvent = useCallback((event: StateSyncEvent) => {
    switch (event.type) {
      case 'USER_PROFILE_UPDATED':
        handlers.onUserProfileUpdate?.(event.payload.userId, event.payload.updates)
        break
      case 'FOLLOW_STATE_CHANGED':
        handlers.onFollowStateChange?.(event.payload.userId, event.payload.isFollowing)
        break
      case 'POST_UPDATED':
        handlers.onPostUpdate?.(event.payload.postId, event.payload.updates)
        break
      case 'NOTIFICATION_COUNT_CHANGED':
        handlers.onNotificationCountChange?.(event.payload.count)
        break
    }
  }, [handlers])

  useStateSyncSubscription('ALL', handleStateEvent, dependencies)
}

/**
 * Hook specifically for post components to sync with user profile changes
 */
export function usePostStateSynchronization(
  post: any,
  onPostUpdate: (updatedPost: any) => void
): void {
  useStateSynchronization({
    handlers: {
      onUserProfileUpdate: (userId, updates) => {
        // Update post if it's by the updated user
        if (post.author.id === userId) {
          const updatedPost = {
            ...post,
            author: {
              ...post.author,
              name: updates.display_name || updates.name || post.author.name,
              display_name: updates.display_name || post.author.display_name,
              username: updates.username || post.author.username,
              image: updates.image || post.author.image
            }
          }
          onPostUpdate(updatedPost)
        }
      }
    },
    dependencies: [post.id, post.author.id]
  })
}

/**
 * Hook for follow button components to sync with follow state changes
 */
export function useFollowButtonSynchronization(
  userId: string,
  onFollowStateChange: (isFollowing: boolean) => void
): void {
  useStateSynchronization({
    handlers: {
      onFollowStateChange: (targetUserId, isFollowing) => {
        if (targetUserId === userId) {
          onFollowStateChange(isFollowing)
        }
      }
    },
    dependencies: [userId]
  })
}

/**
 * Hook for notification components to sync with notification count changes
 */
export function useNotificationSynchronization(
  onNotificationCountChange: (count: number) => void
): void {
  useStateSynchronization({
    handlers: {
      onNotificationCountChange
    }
  })
}