/**
 * Notification User Resolver - Centralized username extraction for all notification types.
 * 
 * This utility eliminates the need to manually update notification routes for each new
 * notification type. It automatically detects and extracts usernames from any notification
 * structure using common patterns.
 */

interface NotificationData {
  // Reaction notifications
  reactorUsername?: string
  reactorUserId?: string
  reactorId?: string

  // Share notifications  
  sharerUsername?: string
  sharerUserId?: string
  sharerId?: string

  // Mention notifications
  authorUsername?: string
  authorUserId?: string
  authorId?: string

  // Like notifications
  likerUsername?: string
  likerUserId?: string
  likerId?: string

  // Follow notifications
  followerUsername?: string
  followerUserId?: string
  followerId?: string

  // Comment notifications
  commenterUsername?: string
  commenterUserId?: string
  commenterId?: string

  // Generic username fields (for future notification types)
  senderUsername?: string
  senderUserId?: string
  username?: string
  displayName?: string
  userId?: string | number
  id?: string | number

  // Other data
  [key: string]: any
}

interface NotificationUser {
  id?: number | string
  username?: string
  profileImageUrl?: string
}

interface Notification {
  fromUser?: NotificationUser | null
  from_user?: NotificationUser | null // Legacy
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
  // First priority: fromUser relation
  if (notification.fromUser?.username) {
    return notification.fromUser.username
  }

  // Fallback: legacy from_user
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
    data.reactorUsername,    // reactions
    data.sharerUsername,     // shares
    data.authorUsername,     // mentions
    data.likerUsername,      // likes
    data.followerUsername,   // follows
    data.commenterUsername,  // comments
  ]

  for (const username of typeSpecificFields) {
    if (username && typeof username === 'string' && username.trim() !== '') {
      return username
    }
  }

  // Try generic username fields
  const genericFields = [
    data.senderUsername,
    data.username,
    data.displayName,
  ]

  for (const username of genericFields) {
    if (username && typeof username === 'string' && username.trim() !== '') {
      return username
    }
  }

  // Try any field ending with 'username' or 'Username'
  for (const [key, value] of Object.entries(data)) {
    if ((key.endsWith('username') || key.endsWith('Username')) && typeof value === 'string' && value.trim() !== '') {
      return value
    }
  }

  return 'Unknown User'
}

/**
 * Extracts user ID from notification using intelligent pattern matching.
 */
export function extractNotificationUserId(notification: Notification): string {
  // First priority: fromUser relation
  if (notification.fromUser?.id) {
    return String(notification.fromUser.id)
  }

  // Fallback: legacy from_user
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
    data.reactorUserId || data.reactorId,
    data.sharerUserId || data.sharerId,
    data.authorUserId || data.authorId,
    data.likerUserId || data.likerId,
    data.followerUserId || data.followerId,
    data.commenterUserId || data.commenterId,
    data.senderUsername || data.senderUserId, // Fallback to username for IDs if needed
    data.userId,
    data.id
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
 * After API mapping, the image should be on fromUser.image (frontend format).
 * This function handles both mapped and raw backend formats for compatibility.
 */
export function extractNotificationUserImage(notification: any): string | undefined {
  // Prefer frontend format
  if (notification.fromUser?.profileImageUrl) {
    return notification.fromUser.profileImageUrl
  }

  if (notification.fromUser?.image) {
    return notification.fromUser.image
  }

  // Fallback for raw backend format
  return notification.from_user?.profileImageUrl ||
    notification.from_user?.profile_image_url ||
    notification.from_user?.image ||
    undefined
}

/**
 * Creates a complete fromUser object for notification display.
 * Handles both mapped frontend format and raw backend format.
 */
export function resolveNotificationUser(notification: any) {
  // If already mapped to frontend format, prefer that
  if (notification.fromUser) {
    return notification.fromUser
  }

  // Otherwise, resolve from raw backend format
  const img = notification.from_user?.image ??
    notification.from_user?.profile_image_url ??
    notification.data?.from_user?.image ??
    notification.data?.from_user?.profile_image_url ??
    null

  return {
    id: extractNotificationUserId(notification),
    name: extractNotificationUsername(notification),
    username: notification.from_user?.username ?? undefined,
    image: img,
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
  const hasFromUser = !!(notification.fromUser?.username || notification.from_user?.username)
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