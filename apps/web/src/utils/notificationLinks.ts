/**
 * Utility functions for generating notification links and handling navigation
 */

export interface NotificationLinkData {
  type: 'post' | 'user' | 'external'
  url: string
  shouldCloseDropdown?: boolean
}

/**
 * Generate appropriate link for a notification based on its type and data
 */
export function generateNotificationLink(notification: {
  type: string
  postId?: string
  fromUser?: {
    id: string
    name: string
  }
  isBatch?: boolean
  data?: any
}): NotificationLinkData | null {
  // For batch notifications, don't navigate - just expand/collapse
  if (notification.isBatch) {
    return null
  }

  // For post-related notifications (reactions, mentions, shares, likes), link to post
  if (notification.postId && ['reaction', 'emoji_reaction', 'mention', 'post_shared', 'share', 'like'].includes(notification.type)) {
    return {
      type: 'post',
      url: `/post/${notification.postId}`,
      shouldCloseDropdown: true
    }
  }

  // For user-related notifications (follows), link to user profile
  if (['new_follower', 'follow'].includes(notification.type)) {
    // Try to use follower_id first, fallback to fromUser.id
    const userId = notification.data?.follower_id || notification.fromUser?.id
    if (userId) {
      return {
        type: 'user',
        url: `/profile/${userId}`,
        shouldCloseDropdown: true
      }
    }
  }

  // Default: no navigation for unknown notification types
  return null
}

/**
 * Handle notification click with proper navigation
 */
export function handleNotificationClick(
  notification: {
    id: string
    type: string
    postId?: string
    fromUser?: {
      id: string
      name: string
    }
    isBatch?: boolean
    read: boolean
    data?: any
  },
  callbacks: {
    markAsRead: (id: string) => void
    toggleBatchExpansion: (id: string) => void
    navigate: (url: string) => void
    closeDropdown: () => void
  }
) {
  // Mark as read if unread
  if (!notification.read) {
    callbacks.markAsRead(notification.id)
  }

  // Handle batch notifications - just expand/collapse
  if (notification.isBatch) {
    callbacks.toggleBatchExpansion(notification.id)
    return
  }

  // Generate link and navigate if available
  const linkData = generateNotificationLink(notification)
  if (linkData) {
    callbacks.navigate(linkData.url)
    if (linkData.shouldCloseDropdown) {
      callbacks.closeDropdown()
    }
  }
}

/**
 * Get user profile link from user ID (preferred) or username
 */
export function getUserProfileLink(userIdOrUsername: string | number): string {
  return `/profile/${userIdOrUsername}`
}

/**
 * Get post link from post ID
 */
export function getPostLink(postId: string): string {
  return `/post/${postId}`
}

/**
 * Navigate to user profile - shared function for consistent behavior
 */
export async function navigateToUserProfile(
  userInfo: { id?: string | number; username?: string },
  navigate: (url: string) => void,
  options: { resolveUsername?: boolean } = { resolveUsername: true }
) {
  // Import the validation function
  const { validProfileId } = await import('./idGuards')
  
  // Try to use ID directly if it's valid
  if (userInfo.id && validProfileId(userInfo.id)) {
    const profileUrl = getUserProfileLink(userInfo.id)
    navigate(profileUrl)
    return
  }

  // If we have a username and resolution is enabled, try to resolve it
  if (userInfo.username && options.resolveUsername) {
    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        console.warn('No access token available for username resolution')
        return
      }

      const response = await fetch(`/api/users/by-username/${encodeURIComponent(userInfo.username)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        if (userData.data && userData.data.id) {
          const profileUrl = getUserProfileLink(userData.data.id)
          navigate(profileUrl)
          return
        }
      }
    } catch (error) {
      console.warn('Failed to resolve username to ID:', error)
    }
  }

  // If all else fails, log a warning and do nothing
  console.warn('Unable to navigate to user profile:', userInfo)
}