/**
 * Notification User Resolver - Centralized username extraction for all notification types.
 * 
 * This utility eliminates the need to manually update notification routes for each new
 * notification type. It automatically detects and extracts usernames from any notification
 * structure using common patterns.
 */

interface NotificationData {
  // Reaction notifications
  reactor_username?: string
  
  // Share notifications  
  sharer_username?: string
  
  // Mention notifications
  author_username?: string
  
  // Like notifications
  liker_username?: string
  
  // Follow notifications
  follower_username?: string
  
  // Comment notifications
  commenter_username?: string
  
  // Generic username fields (for future notification types)
  sender_username?: string
  username?: string
  user_name?: string
  
  // Other data
  [key: string]: any
}

interface NotificationUser {
  id?: number | string
  username?: string
  profile_image_url?: string
}

interface Notification {
  from_user?: NotificationUser | null
  data?: NotificationData
  type?: string
}

/**
 * Extracts username from notification using intelligent pattern matching.
 * 
 * Priority order:
 * 1. from_user.username (preferred when available)
 * 2. Notification-type-specific username fields
 * 3. Generic username fields
 * 4. 'Unknown User' fallback
 */
export function extractNotificationUsername(notification: Notification): string {
  // First priority: from_user relation
  if (notification.from_user?.username) {
    return notification.from_user.username
  }
  
  // Second priority: notification-type-specific fields
  const data = notification.data
  if (!data) {
    return 'Unknown User'
  }
  
  // Try notification-type-specific fields first
  const typeSpecificFields = [
    data.reactor_username,    // reactions
    data.sharer_username,     // shares
    data.author_username,     // mentions
    data.liker_username,      // likes
    data.follower_username,   // follows
    data.commenter_username,  // comments
  ]
  
  for (const username of typeSpecificFields) {
    if (username && typeof username === 'string' && username.trim() !== '') {
      return username
    }
  }
  
  // Try generic username fields
  const genericFields = [
    data.sender_username,
    data.username,
    data.user_name,
  ]
  
  for (const username of genericFields) {
    if (username && typeof username === 'string' && username.trim() !== '') {
      return username
    }
  }
  
  // Try any field ending with 'username' (for future notification types)
  for (const [key, value] of Object.entries(data)) {
    if (key.endsWith('username') && typeof value === 'string' && value.trim() !== '') {
      return value
    }
  }
  
  return 'Unknown User'
}

/**
 * Extracts user ID from notification using intelligent pattern matching.
 */
export function extractNotificationUserId(notification: Notification): string {
  // First priority: from_user relation
  if (notification.from_user?.id) {
    return String(notification.from_user.id)
  }
  
  // Second priority: try to extract from username fields by removing '_username' suffix
  const data = notification.data
  if (!data) {
    return 'unknown'
  }
  
  // Look for corresponding ID fields
  const idFields = [
    data.reactor_id || data.reactor_user_id,
    data.sharer_id || data.sharer_user_id,
    data.author_id || data.author_user_id,
    data.liker_id || data.liker_user_id,
    data.follower_id || data.follower_user_id,
    data.commenter_id || data.commenter_user_id,
    data.sender_id || data.sender_user_id,
    data.user_id,
  ]
  
  for (const id of idFields) {
    if (id !== undefined && id !== null) {
      return String(id)
    }
  }
  
  // Fallback: use username as ID
  const username = extractNotificationUsername(notification)
  return username !== 'Unknown User' ? username : 'unknown'
}

/**
 * Extracts user image from notification.
 */
export function extractNotificationUserImage(notification: Notification): string | undefined {
  return notification.from_user?.profile_image_url || undefined
}

/**
 * Creates a complete fromUser object for notification display.
 */
export function resolveNotificationUser(notification: Notification) {
  return {
    id: extractNotificationUserId(notification),
    name: extractNotificationUsername(notification),
    image: extractNotificationUserImage(notification)
  }
}

/**
 * Validates that a notification has proper username data.
 * Useful for testing and debugging.
 */
export function validateNotificationUserData(notification: Notification): {
  isValid: boolean
  hasFromUser: boolean
  hasUsernameInData: boolean
  detectedUsername: string
  issues: string[]
} {
  const issues: string[] = []
  const hasFromUser = !!notification.from_user?.username
  const detectedUsername = extractNotificationUsername(notification)
  const hasUsernameInData = detectedUsername !== 'Unknown User'
  
  if (!hasFromUser && !hasUsernameInData) {
    issues.push('No username found in from_user or data fields')
  }
  
  if (detectedUsername === 'Unknown User') {
    issues.push('Username resolved to "Unknown User" - check notification data structure')
  }
  
  if (!notification.data) {
    issues.push('No data object found in notification')
  }
  
  return {
    isValid: hasFromUser || hasUsernameInData,
    hasFromUser,
    hasUsernameInData,
    detectedUsername,
    issues
  }
}