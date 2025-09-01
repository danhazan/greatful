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
    // Try to use follower_id first, fallback to fromUser.id, then fromUser.name
    const userId = notification.data?.follower_id || notification.fromUser?.id
    if (userId) {
      return {
        type: 'user',
        url: `/profile/${userId}`,
        shouldCloseDropdown: true
      }
    } else if (notification.fromUser?.name) {
      // Fallback to username-based URL (though this might not work with current routing)
      return {
        type: 'user',
        url: `/profile/${notification.fromUser.name}`,
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
 * Get user profile link from username
 */
export function getUserProfileLink(username: string): string {
  return `/profile/${username}`
}

/**
 * Get post link from post ID
 */
export function getPostLink(postId: string): string {
  return `/post/${postId}`
}