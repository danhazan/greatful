import React from 'react'
import ClickableUsername from '@/components/ClickableUsername'

interface NotificationUser {
  id: string | number
  name: string
  image?: string
}

interface NotificationData {
  actor_user_id?: string
  actor_username?: string
  [key: string]: any
}

/**
 * Parse notification message and make usernames clickable
 * This ensures consistent behavior across all notification types
 */
export function parseNotificationMessage(
  message: string,
  fromUser?: NotificationUser,
  isBatch?: boolean
): React.ReactNode {
  // For batch notifications, return message as-is since it's already formatted
  if (isBatch || !fromUser) {
    return message
  }

  // Split message by the username to make it clickable
  const username = fromUser.name
  const parts = message.split(username)
  
  if (parts.length === 1) {
    // Username not found in message, return as-is
    return message
  }

  // Reconstruct message with clickable username
  const result: React.ReactNode[] = []
  
  for (let i = 0; i < parts.length; i++) {
    // Add the text part
    if (parts[i]) {
      result.push(parts[i])
    }
    
    // Add clickable username between parts (except after the last part)
    if (i < parts.length - 1) {
      result.push(
        <ClickableUsername
          key={`username-${i}`}
          userId={fromUser.id}
          username={username}
          className="font-medium text-purple-600 hover:text-purple-700 cursor-pointer transition-colors"
        />
      )
    }
  }
  
  return result
}

/**
 * Format notification message with clickable username at the beginning
 * Used for standard notification format: "[Username] [action]"
 */
export function formatNotificationWithClickableUser(
  action: string,
  fromUser: NotificationUser,
  notificationData?: NotificationData
): React.ReactNode {
  // Prefer the new actor fields from notification data
  const actorId = notificationData?.actor_user_id ?? fromUser?.id
  const actorUsername = notificationData?.actor_username ?? fromUser?.name

  return (
    <>
      <ClickableUsername
        userId={actorId}
        username={actorUsername}
        className="font-medium text-purple-600 hover:text-purple-700 cursor-pointer transition-colors"
      />
      {' '}
      {action}
    </>
  )
}

/**
 * Enhanced format function that accepts notification data
 */
export function formatNotificationWithEnhancedData(
  notification: {
    message: string
    fromUser?: NotificationUser
    data?: NotificationData
    isBatch?: boolean
  }
): React.ReactNode {
  if (notification.isBatch || !notification.fromUser) {
    return notification.message
  }

  return formatNotificationWithClickableUser(
    notification.message,
    notification.fromUser,
    notification.data
  )
}